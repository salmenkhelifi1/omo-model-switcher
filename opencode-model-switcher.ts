import { type Plugin, tool } from "@opencode-ai/plugin";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface AccountRecord {
  email: string;
  healthScore: number;    // 0–100, decays on errors, recovers over time
  lastErrorAt: number;    // Unix timestamp ms; 0 = never errored
  errorCount: number;
  cooldownUntil: number;  // Unix timestamp ms; 0 = not in cooldown
  proxy?: string;         // Optional SOCKS5/HTTP proxy, e.g. "socks5://127.0.0.1:9050"
  fingerprint?: string;   // Optional device fingerprint identifier
}

interface SwitcherState {
  accounts: AccountRecord[];
  activeFallback?: string | null;
}

interface AccountInfo {
  email: string;
  id: string;
}

interface LastError {
  email: string;
  status: string;
  timestamp: number;
}

type ErrorCategory = "capacity" | "rate_limit" | "server_error" | "auth_expired" | "unknown";

interface DetectedError {
  category: ErrorCategory;
  severity: "critical" | "warning" | "info";
  failingAccount?: string;
  rawMessage: string;
  detectedAt: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_GEMINI_MODELS: readonly string[] = [
  "google/gemini-3-pro",
  "google/gemini-3-flash",
  "google/gemini-3-flash-lite",
  "google/gemini-3-pro-preview",
  "google/gemini-3-flash-preview",
  "google/gemini-3.1-pro-preview",
  "google/gemini-3.1-flash-preview",
  "google/gemini-3.1-flash-lite-preview",
];

// Penalty config by error severity
const COOLDOWN_MS = {
  critical: 15 * 60 * 1000, // 15 minutes for critical errors
  warning: 60 * 1000,       // 1 minute for warnings
  info: 0,                  // No cooldown for info-level
} as const;

const HEALTH_PENALTY = {
  critical: 40,
  warning: 15,
  info: 5,
} as const;

function getGeminiDir(): string | null {
  const home = os.homedir();
  if (!home) {
    console.error("[Model Switcher] os.homedir() returned empty — cannot resolve state path.");
    return null;
  }
  return path.join(home, ".gemini");
}

function getStatePath(): string | null {
  const dir = getGeminiDir();
  return dir ? path.join(dir, "switcher_state.json") : null;
}

function getLegacyAccountsPath(): string | null {
  const dir = getGeminiDir();
  return dir ? path.join(dir, "google_accounts.json") : null;
}

function getSignalPath(): string | null {
  const dir = getGeminiDir();
  return dir ? path.join(dir, "last_error.json") : null;
}

// ─── State Persistence ────────────────────────────────────────────────────────

/** Atomic write using temp-file + rename to prevent corruption on interrupt. */
async function saveSwitcherState(state: SwitcherState): Promise<void> {
  const statePath = getStatePath();
  if (!statePath) return;

  try {
    const dir = path.dirname(statePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tempPath = `${statePath}.${Date.now()}-${Math.random().toString(36).substring(2)}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(state, null, 2), "utf-8");
    fs.renameSync(tempPath, statePath);
  } catch (e) {
    console.error("[Model Switcher] Failed to save state:", e);
  }
}

/** Migrate accounts from legacy google_accounts.json into new state format. */
async function migrateFromLegacy(): Promise<SwitcherState | null> {
  const legacyPath = getLegacyAccountsPath();
  if (!legacyPath || !fs.existsSync(legacyPath)) return null;

  try {
    const data = JSON.parse(fs.readFileSync(legacyPath, "utf-8"));
    const emails = new Set<string>();
    if (data.active) emails.add(data.active);
    if (Array.isArray(data.old)) data.old.forEach((e: string) => emails.add(e));

    if (emails.size === 0) return null;

    const accounts: AccountRecord[] = Array.from(emails).map(email => ({
      email,
      healthScore: 100,
      lastErrorAt: 0,
      errorCount: 0,
      cooldownUntil: 0,
    }));

    const state: SwitcherState = { accounts, activeFallback: null };
    await saveSwitcherState(state);
    console.log(`[Model Switcher] Migrated ${emails.size} account(s) from legacy file.`);
    return state;
  } catch (e) {
    console.error("[Model Switcher] Legacy migration failed:", e);
    return null;
  }
}

/**
 * Heal accounts over time: +5 health per minute since last error.
 * Also clears expired cooldowns.
 * Returns true if any account changed (triggers a save).
 *
 * Fix #4: Uses `> 0` instead of truthy check so `lastErrorAt: 0` is handled correctly.
 */
function healAccounts(state: SwitcherState): boolean {
  let changed = false;
  const now = Date.now();

  for (const acc of state.accounts) {
    if (acc.healthScore < 100 && acc.lastErrorAt > 0) {
      const minsPassed = (now - acc.lastErrorAt) / 60000;
      if (minsPassed >= 1) {
        const minsToHeal = Math.floor(minsPassed);
        const healAmount = minsToHeal * 5;
        const newScore = Math.min(100, acc.healthScore + healAmount);
        
        if (newScore !== acc.healthScore) {
          acc.healthScore = newScore;
          acc.lastErrorAt += minsToHeal * 60000; // Deduct the healed time
          changed = true;
        }
        
        if (acc.healthScore === 100) {
          acc.lastErrorAt = 0;
          changed = true;
        }
      }
    }
    if (acc.cooldownUntil > 0 && acc.cooldownUntil < now) {
      acc.cooldownUntil = 0;
      changed = true;
    }
  }

  return changed;
}

async function loadSwitcherState(): Promise<SwitcherState | null> {
  const statePath = getStatePath();
  if (!statePath) return null;

  if (!fs.existsSync(statePath)) {
    return await migrateFromLegacy();
  }

  try {
    const data = JSON.parse(fs.readFileSync(statePath, "utf-8")) as SwitcherState;
    if (!data.accounts || !Array.isArray(data.accounts)) {
      return await migrateFromLegacy();
    }

    if (healAccounts(data)) {
      await saveSwitcherState(data);
    }

    return data;
  } catch {
    return await migrateFromLegacy();
  }
}

// ─── Account Health ───────────────────────────────────────────────────────────

/**
 * Penalize an account based on error severity.
 * Includes timestamp debounce to prevent double-penalizing the same exact signal.
 */
async function penalizeAccount(email: string, severity: DetectedError["severity"], errorTimestamp: number): Promise<void> {
  const state = await loadSwitcherState();
  if (!state) return;

  const acc = state.accounts.find(a => a.email === email);
  if (acc) {
    if (acc.lastErrorAt === errorTimestamp) {
      return; // Already penalized for this exact signal
    }
    const penalty = HEALTH_PENALTY[severity];
    acc.healthScore = Math.max(0, acc.healthScore - penalty);
    acc.lastErrorAt = errorTimestamp;
    acc.errorCount += 1;
    acc.cooldownUntil = COOLDOWN_MS[severity] > 0
      ? Date.now() + COOLDOWN_MS[severity]
      : 0;
    await saveSwitcherState(state);
  }
}

async function getBestAccount(): Promise<AccountRecord | null> {
  const state = await loadSwitcherState();
  if (!state || state.accounts.length === 0) return null;

  const now = Date.now();
  const available = state.accounts
    .filter(a => a.cooldownUntil === 0 || a.cooldownUntil < now)
    .sort((a, b) => b.healthScore - a.healthScore);

  if (available.length > 0) return available[0];

  // All in cooldown: pick whichever expires soonest
  return [...state.accounts].sort((a, b) => a.cooldownUntil - b.cooldownUntil)[0];
}

// ─── Error Detection ──────────────────────────────────────────────────────────

function classifyError(signal: LastError): DetectedError {
  const msg = signal.status.toLowerCase();

  if (msg.includes("no capacity") || msg.includes("capacity unavailable") || msg.includes("capacity available")) {
    return { category: "capacity", severity: "critical", failingAccount: signal.email, rawMessage: signal.status, detectedAt: signal.timestamp };
  }
  if (msg.includes("429") || msg.includes("rate limit") || msg.includes("quota exceeded") || msg.includes("resource_exhausted")) {
    return { category: "rate_limit", severity: "critical", failingAccount: signal.email, rawMessage: signal.status, detectedAt: signal.timestamp };
  }
  if (msg.includes("500") || msg.includes("503") || msg.includes("internal server")) {
    return { category: "server_error", severity: "warning", failingAccount: signal.email, rawMessage: signal.status, detectedAt: signal.timestamp };
  }
  if (msg.includes("401") || msg.includes("403") || msg.includes("token expired") || msg.includes("permission denied")) {
    return { category: "auth_expired", severity: "critical", failingAccount: signal.email, rawMessage: signal.status, detectedAt: signal.timestamp };
  }

  return { category: "unknown", severity: "info", failingAccount: signal.email, rawMessage: signal.status, detectedAt: signal.timestamp };
}

/**
 * Read a pending error signal from ~/.gemini/last_error.json.
 * This file is written by the Gemini CLI wrapper or an external hook.
 * Signals older than 60s are discarded and deleted.
 */
async function getPendingSignal(): Promise<LastError | null> {
  const signalPath = getSignalPath();
  if (!signalPath || !fs.existsSync(signalPath)) return null;

  try {
    const data = JSON.parse(fs.readFileSync(signalPath, "utf-8")) as LastError;
    if (Date.now() - data.timestamp < 60000) {
      return data;
    }
    try { fs.unlinkSync(signalPath); } catch { /* ignore cleanup errors */ }
    return null;
  } catch {
    return null;
  }
}

// ─── Account Discovery ────────────────────────────────────────────────────────

/**
 * Fix #12: Uses the getLegacyAccountsPath() helper instead of duplicating the path inline.
 */
async function getAllAccounts(): Promise<AccountInfo[]> {
  const legacyPath = getLegacyAccountsPath();
  if (!legacyPath || !fs.existsSync(legacyPath)) return [];

  try {
    const data = JSON.parse(fs.readFileSync(legacyPath, "utf-8"));
    const emails = new Set<string>();
    if (data.active) emails.add(data.active);
    if (Array.isArray(data.old)) data.old.forEach((e: string) => emails.add(e));
    return Array.from(emails).map(email => ({ email, id: email }));
  } catch {
    return [];
  }
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export const ModelSwitcherPlugin: Plugin = async (_ctx) => {
  console.log("[Model Switcher] Plugin loaded (v2.0)");

  return {
    tool: {

      model_switcher_init: tool({
        description: "Initialize the model switcher state from existing Google accounts.",
        args: {},
        async execute() {
          const accounts = await getAllAccounts();
          if (accounts.length === 0) {
            return "⚠️ No accounts found in `~/.gemini/google_accounts.json`. Please sign in first.";
          }

          const state: SwitcherState = {
            accounts: accounts.map(a => ({
              email: a.email,
              healthScore: 100,
              cooldownUntil: 0,
              errorCount: 0,
              lastErrorAt: 0,
            })),
            activeFallback: null,
          };

          // Fix #5: Uses atomic saveSwitcherState instead of raw writeFileSync
          await saveSwitcherState(state);
          return `✅ Model Switcher initialized with **${accounts.length}** account(s):\n${accounts.map(a => `- \`${a.email}\``).join("\n")}`;
        },
      }),

      model_switcher_status: tool({
        description: "Check account health, cooldowns, and proxy/fingerprint configuration.",
        args: {},
        async execute() {
          const state = await loadSwitcherState();
          if (!state || state.accounts.length === 0) {
            return "❌ No state found. Run `model_switcher_init` first.";
          }

          const now = Date.now();
          // Fix #10: Show proxy and fingerprint in status output
          const rows = state.accounts.map(a => {
            const status = a.cooldownUntil > now
              ? `🧊 Cooldown ~${Math.ceil((a.cooldownUntil - now) / 60000)}min`
              : a.healthScore >= 80
                ? "✅ Ready"
                : "⚠️ Degraded";
            const extras = [
              a.proxy ? `proxy: \`${a.proxy}\`` : "",
              a.fingerprint ? `fp: \`${a.fingerprint}\`` : "",
            ].filter(Boolean).join(", ");
            return `| \`${a.email}\` | ${a.healthScore}/100 | ${status} | ${extras || "—"} |`;
          });

          const signal = await getPendingSignal();
          const errorMsg = signal
            ? `\n\n⚠️ **Last Signal:** ${signal.status}`
            : "";

          return [
            "### ⚡ Model Switcher Status (v2.0)",
            "",
            "| Account | Health | Status | Config |",
            "|:---|:---:|:---:|:---|",
            ...rows,
            errorMsg,
          ].join("\n");
        },
      }),

      model_switcher_smart_route: tool({
        description: "Select the best model and account. Detects active errors and auto-rotates/downgrades.",
        args: {
          preferred_model: tool.schema.string().optional(),
        },
        async execute({ preferred_model }) {
          // Validate model input
          let targetModel = preferred_model ?? "google/gemini-3-pro";
          if (preferred_model && !ALLOWED_GEMINI_MODELS.includes(preferred_model)) {
            return `❌ Unknown model: \`${preferred_model}\`. Allowed models:\n${ALLOWED_GEMINI_MODELS.map(m => `- \`${m}\``).join("\n")}`;
          }

          const signal = await getPendingSignal();
          let bestAcc = await getBestAccount();
          const state = await loadSwitcherState();

          if (!bestAcc) {
            return "❌ No accounts available. Run `model_switcher_init` first.";
          }

          if (state && state.activeFallback) {
            const pinned = state.accounts.find(a => a.email === state.activeFallback);
            if (pinned) {
              bestAcc = pinned;
            }
          }

          let rationale = state?.activeFallback === bestAcc.email 
            ? `Using pinned account: \`${bestAcc.email}\` (Health: ${bestAcc.healthScore}/100)`
            : `Using best account: \`${bestAcc.email}\` (Health: ${bestAcc.healthScore}/100)`;

          if (signal) {
            const error = classifyError(signal);

            if (error.category === "capacity" || error.category === "rate_limit") {
              await penalizeAccount(signal.email, error.severity, signal.timestamp);
              
              if (state?.activeFallback === signal.email) {
                rationale = `⚠️ **Pinned Account at Capacity:** \`${signal.email}\` penalized, but remaining on it due to pin.`;
              } else {
                const newBest = await getBestAccount();
                if (newBest && newBest.email !== signal.email) {
                  bestAcc = newBest;
                  rationale = `⚠️ **Auto-Rotated:** \`${signal.email}\` penalized. Switched to \`${newBest.email}\` (Health: ${newBest.healthScore}/100).`;
                } else {
                  // Same account or no alternative — cascade to a lower model
                  if (targetModel.includes("-pro")) {
                    targetModel = targetModel.replace("-pro", "-flash");
                    rationale = `⚠️ **Auto-Downgraded to Flash:** All accounts at capacity for Pro. Using \`${bestAcc.email}\`.`;
                  } else if (!targetModel.includes("-lite")) {
                    if (targetModel.includes("-flash-preview")) {
                      targetModel = targetModel.replace("-flash-preview", "-flash-lite-preview");
                    } else {
                      targetModel = targetModel.replace("-flash", "-flash-lite");
                    }
                    rationale = `⚠️ **Auto-Downgraded to Flash Lite:** Flash also at capacity. Using \`${bestAcc.email}\`.`;
                  }
                }
              }
            } else if (error.category === "auth_expired") {
              await penalizeAccount(signal.email, error.severity, signal.timestamp);
              return `❌ **Auth Expired** for \`${signal.email}\`. Please refresh your Google credentials.\n\nRun: \`gemini auth login\``;
            } else if (error.category === "server_error") {
              await penalizeAccount(signal.email, error.severity, signal.timestamp);
              rationale = `⚠️ **Server Error** on \`${signal.email}\`. It has been penalized. Retrying with current account.`;
            }

            // Delete the signal after acting on it
            const signalPath = getSignalPath();
            if (signalPath && fs.existsSync(signalPath)) {
              try { fs.unlinkSync(signalPath); } catch {}
            }
          }

          // Write the final routing decision — Fix #1: always uses the final bestAcc value
          const geminiDir = getGeminiDir();
          if (geminiDir) {
            const afPath = path.join(geminiDir, "active_fallback.json");
            fs.writeFileSync(afPath, JSON.stringify({
              active: targetModel,
              email: bestAcc.email,
              proxy: bestAcc.proxy ?? null,
              fingerprint: bestAcc.fingerprint ?? null,
              timestamp: Date.now(),
              rationale,
            }, null, 2));
          }

          return [
            "### ⚡ Smart Route Decision",
            "",
            `- **Model:** \`${targetModel}\``,
            `- **Account:** \`${bestAcc.email}\` (Health: ${bestAcc.healthScore}/100)`,
            bestAcc.proxy ? `- **Proxy:** \`${bestAcc.proxy}\`` : "",
            "",
            rationale,
          ].filter(l => l !== undefined).join("\n");
        },
      }),

      model_switcher_health: tool({
        description: "Run a health check on the model switching system.",
        args: {},
        async execute() {
          const state = await loadSwitcherState();
          const stateInfo = state
            ? `**${state.accounts.length}** account(s) tracked.`
            : "❌ No state file found. Run `model_switcher_init` first.";

          const signal = await getPendingSignal();
          if (!signal) {
            return `✅ System healthy — no active error signals.\n\n${stateInfo}`;
          }

          const error = classifyError(signal);
          return [
            "### 🩺 System Health — Issue Detected",
            "",
            `- **Category:** ${error.category}`,
            `- **Severity:** ${error.severity}`,
            `- **Affected Account:** \`${signal.email}\``,
            `- **Signal:** \`${signal.status}\``,
            `- **Time:** ${new Date(signal.timestamp).toISOString()}`,
            "",
            stateInfo,
          ].join("\n");
        },
      }),

      /**
       * Fix #2: Properly sets the proxy field on the account in the state file.
       * Renamed intent: "set_account_proxy" now actually stores a proxy URL per account.
       */
      model_switcher_set_account_proxy: tool({
        description: "Set or clear a SOCKS5/HTTP proxy for a specific account (e.g. socks5://127.0.0.1:9050).",
        args: {
          email: tool.schema.string(),
          proxy: tool.schema.string().optional(),
        },
        async execute({ email, proxy }) {
          const state = await loadSwitcherState();
          if (!state) return "❌ System not initialized. Run `model_switcher_init` first.";

          const acc = state.accounts.find(a => a.email === email);
          if (!acc) return `❌ Account \`${email}\` not found. Check model_switcher_status.`;

          if (proxy) {
            if (!proxy.startsWith("socks5://") && !proxy.startsWith("http://") && !proxy.startsWith("https://")) {
              return `❌ Invalid proxy format. Use \`socks5://host:port\` or \`http://host:port\`.`;
            }
            acc.proxy = proxy;
          } else {
            delete acc.proxy;
          }

          await saveSwitcherState(state);
          return proxy
            ? `✅ Proxy \`${proxy}\` set for \`${email}\`.`
            : `✅ Proxy cleared for \`${email}\`.`;
        },
      }),

      model_switcher_set_account_fingerprint: tool({
        description: "Set or clear a fingerprint ID for a specific account to avoid cross-account linkage.",
        args: {
          email: tool.schema.string(),
          fingerprint: tool.schema.string().optional(),
        },
        async execute({ email, fingerprint }) {
          const state = await loadSwitcherState();
          if (!state) return "❌ System not initialized. Run `model_switcher_init` first.";

          const acc = state.accounts.find(a => a.email === email);
          if (!acc) return `❌ Account \`${email}\` not found.`;

          if (fingerprint) {
            acc.fingerprint = fingerprint;
          } else {
            delete acc.fingerprint;
          }

          await saveSwitcherState(state);
          return fingerprint
            ? `✅ Fingerprint \`${fingerprint}\` set for \`${email}\`.`
            : `✅ Fingerprint cleared for \`${email}\`.`;
        },
      }),

      model_switcher_pin_account: tool({
        description: "Pin a specific account for the next session, bypassing auto-rotation. Leave email parameter empty to unpin.",
        args: {
          email: tool.schema.string().optional(),
        },
        async execute({ email }) {
          const state = await loadSwitcherState();
          if (!state) return "❌ System not initialized.";

          if (!email) {
            state.activeFallback = null;
            await saveSwitcherState(state);
            return `✅ **Account Unpinned:** Auto-rotation restored.`;
          }

          const acc = state.accounts.find(a => a.email === email);
          if (!acc) return `❌ Account \`${email}\` not found in switcher state.`;

          state.activeFallback = email;
          await saveSwitcherState(state);

          return `✅ **Account Pinned:** \`${email}\` will bypass auto-rotation logic unless downgraded manually.`;
        },
      }),

      model_switcher_reset: tool({
        description: "Reset all account health scores and clear all cooldowns.",
        args: {},
        async execute() {
          const state = await loadSwitcherState();
          if (!state) return "❌ No state found.";

          for (const acc of state.accounts) {
            acc.healthScore = 100;
            acc.errorCount = 0;
            acc.lastErrorAt = 0;
            acc.cooldownUntil = 0;
          }

          await saveSwitcherState(state);
          return `✅ Reset health for **${state.accounts.length}** account(s). All at 100%.`;
        },
      }),

      model_switcher_update: tool({
        description: "Configure your OpenCode to automatically use the latest version of this plugin from npm.",
        args: {},
        async execute() {
          const home = os.homedir();
          const configPath = path.join(home, ".config", "opencode", "opencode.json");

          if (!fs.existsSync(configPath)) {
            return `❌ Could not find OpenCode config at \`${configPath}\`.`;
          }

          try {
            const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
            if (!config.plugin || !Array.isArray(config.plugin)) {
              return "❌ Your `opencode.json` is missing a valid `plugin` array.";
            }

            const pluginName = "omo-model-switcher";
            let updated = false;

            config.plugin = config.plugin.map((p: string) => {
              if (p === pluginName || p.startsWith(`${pluginName}@`)) {
                updated = true;
                return `${pluginName}@latest`;
              }
              return p;
            });

            if (!updated) {
              config.plugin.push(`${pluginName}@latest`);
            }

            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            return `✅ **Update Prepared!** Your config has been set to \`${pluginName}@latest\`.\n\n**Next Step:** Please restart OpenCode to apply the update.`;
          } catch (e) {
            return `❌ Failed to update config: ${e instanceof Error ? e.message : String(e)}`;
          }
        },
      }),

    },
  };
};

export default ModelSwitcherPlugin;
