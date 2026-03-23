import { type Plugin, tool } from "@opencode-ai/plugin";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

interface AccountInfo {
  email: string;
  id: string;
  quota?: number;
}

interface LastError {
  email: string;
  status: string;
  timestamp: number;
}

async function getActiveAccount(): Promise<string | null> {
  const homeDir = process.env.HOME;
  if (!homeDir) return null;
  const gaPath = path.join(homeDir, ".gemini", "google_accounts.json");
  
  if (!fs.existsSync(gaPath)) return null;
  
  try {
    const data = JSON.parse(fs.readFileSync(gaPath, "utf-8"));
    return data.active || null;
  } catch {
    return null;
  }
}

async function getPendingSignal(): Promise<LastError | null> {
  const homeDir = process.env.HOME;
  if (!homeDir) return null;
  const signalPath = path.join(homeDir, ".gemini", "last_error.json");
  
  if (!fs.existsSync(signalPath)) return null;
  
  try {
    const data = JSON.parse(fs.readFileSync(signalPath, "utf-8"));
    if (Date.now() - data.timestamp < 60000) {
      return data;
    }
    fs.unlinkSync(signalPath);
    return null;
  } catch {
    return null;
  }
}

async function getAllAccounts(): Promise<AccountInfo[]> {
  const homeDir = process.env.HOME;
  if (!homeDir) return [];
  const indexPath = path.join(homeDir, ".antigravity_cockpit", "gemini_accounts.json");
  
  if (!fs.existsSync(indexPath)) return [];
  
  try {
    const data = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
    return data.accounts || [];
  } catch {
    return [];
  }
}

async function getAccountQuota(accountId: string): Promise<number> {
  const homeDir = process.env.HOME;
  if (!homeDir) return 100;
  const accFile = path.join(homeDir, ".antigravity_cockpit", "gemini_accounts", `${accountId}.json`);
  
  if (!fs.existsSync(accFile)) return 100;
  
  try {
    const data = JSON.parse(fs.readFileSync(accFile, "utf-8"));
    const usage = data.gemini_usage_raw || {};
    const buckets = usage.buckets || [];
    
    if (!buckets.length) return 100;
    
    let minFraction = 1.0;
    let foundModel = false;
    
    for (const b of buckets) {
      const model = b.modelId || "";
      if (model.includes("gemini-3")) {
        const f = b.remainingFraction || 1.0;
        if (f < minFraction) {
          minFraction = f;
          foundModel = true;
        }
      }
    }
    
    return foundModel ? minFraction * 100 : 100;
  } catch {
    return 100;
  }
}

async function forceRotateAccount(): Promise<string | null> {
  try {
    const result = execSync('python3 ~/gemini-auto-switch.py --force-rotate', { encoding: 'utf-8' });
    return result.trim();
  } catch (e) {
    console.error("[Model Switcher] Failed to rotate account:", e);
    return null;
  }
}

async function getAllAccountQuotas(): Promise<AccountInfo[]> {
  const accounts = await getAllAccounts();
  const result: AccountInfo[] = [];
  
  for (const acc of accounts) {
    const quota = await getAccountQuota(acc.id);
    result.push({ ...acc, quota });
  }
  
  return result;
}

export const ModelSwitcherPlugin: Plugin = async (ctx) => {
  console.log("[Model Switcher] Plugin loaded");
  
  return {
    tool: {
      model_switcher_status: tool({
        description: "Check current model, account status, and quota information",
        args: {},
        async execute() {
          const activeAccount = await getActiveAccount();
          const pendingSignal = await getPendingSignal();
          const accounts = await getAllAccountQuotas();
          
          const lines = [
            "## Model Switcher Status",
            "",
            `**Active Account**: ${activeAccount || "Unknown"}`,
            "",
            pendingSignal 
              ? `⚠️ **RATE LIMIT ACTIVE**: ${pendingSignal.status} on ${pendingSignal.email}`
              : "✅ No pending rate limit signals",
            "",
            "### Account Quotas (Gemini 3)",
            ""
          ];
          
          accounts.sort((a, b) => (b.quota || 0) - (a.quota || 0));
          
          for (const acc of accounts) {
            const emoji = acc.email === activeAccount ? "👉" : "  ";
            const quotaBar = "▓".repeat(Math.floor((acc.quota || 0) / 10)) + "░".repeat(10 - Math.floor((acc.quota || 0) / 10));
            lines.push(`${emoji} ${acc.email}: ${quotaBar} ${acc.quota?.toFixed(1)}%`);
          }
          
          return lines.join("\n");
        },
      }),
      
      model_switcher_rotate: tool({
        description: "Force rotate to the next Google account with highest quota",
        args: {},
        async execute() {
          const result = await forceRotateAccount();
          if (result) {
            const newActive = await getActiveAccount();
            return `✅ Rotated to: ${newActive}\n\n${result}`;
          }
          return "❌ Failed to rotate account";
        },
      }),
      
      model_switcher_recommend: tool({
        description: "Recommend the best model based on task complexity and current system state",
        args: {
          task_complexity: tool.schema.string().describe("Task complexity: simple, medium, or complex"),
        },
        async execute({ task_complexity }) {
          const accounts = await getAllAccountQuotas();
          const activeAccount = await getActiveAccount();
          const pendingSignal = await getPendingSignal();
          
          const currentAcc = accounts.find(a => a.email === activeAccount);
          const currentQuota = currentAcc?.quota || 0;
          
          const lines = [
            "## Model Recommendation",
            "",
            `Task Complexity: **${task_complexity}**`,
            `Current Account: ${activeAccount}`,
            `Current Quota: ${currentQuota.toFixed(1)}%`,
            "",
          ];
          
          let recommended = "google/gemini-3-pro-preview";
          let reason = "";
          
          if (pendingSignal) {
            recommended = "opencode/minimax-m2.5-free";
            reason = "Rate limit detected - using fallback model";
          } else if (currentQuota < 10) {
            recommended = "opencode/minimax-m2.5-free";
            reason = "Low quota (<10%) - using fallback model";
          } else if (task_complexity === "simple") {
            recommended = "opencode/minimax-m2.5-free";
            reason = "Simple task - using fast model";
          } else if (task_complexity === "complex") {
            recommended = "google/gemini-3-pro-preview";
            reason = "Complex task - using best reasoning model";
          }
          
          lines.push(`**Recommended Model**: ${recommended}`);
          lines.push(`**Reason**: ${reason}`);
          
          return lines.join("\n");
        },
      }),
      
      model_switcher_fallback: tool({
        description: "Switch to fallback model (MiniMax or GPT-Nano) when Gemini quota exhausted",
        args: {
          preferred_fallback: tool.schema.string().optional().describe("Preferred fallback: minimax or gpt-nano"),
        },
        async execute({ preferred_fallback }) {
          const accounts = await getAllAccountQuotas();
          const activeAccount = await getActiveAccount();
          
          const allLow = accounts.every(a => (a.quota || 0) < 5);
          
          if (!allLow) {
            return "✅ Accounts still have quota. No fallback needed.";
          }
          
          const fallback = preferred_fallback === "gpt-nano" 
            ? "opencode/gpt-5-nano" 
            : "opencode/minimax-m2.5-free";
          
          return `⚠️ All accounts exhausted!\n\n**Switching to fallback model**: ${fallback}\n\nUse this model for the next requests. The system will automatically switch back to Gemini when quota recovers.`;
        },
      }),
      
      model_switcher_health: tool({
        description: "Run health check on the model switching system",
        args: {},
        async execute() {
          const checks: string[] = [];
          let allHealthy = true;
          
          try {
            const ps = execSync('ps aux | grep -v grep | grep gemini-auto-switch', { encoding: 'utf-8' });
            if (ps.includes("gemini-auto-switch")) {
              checks.push("✅ Auto-switcher is running");
            } else {
              checks.push("❌ Auto-switcher NOT running");
              allHealthy = false;
            }
          } catch {
            checks.push("❌ Auto-switcher NOT running");
            allHealthy = false;
          }
          
          const activeAccount = await getActiveAccount();
          if (activeAccount) {
            checks.push(`✅ Active account: ${activeAccount}`);
          } else {
            checks.push("❌ No active account");
            allHealthy = false;
          }
          
          const checkHomeDir = process.env.HOME;
          if (checkHomeDir) {
            const ocPath = path.join(checkHomeDir, ".gemini", "oauth_creds.json");
            if (fs.existsSync(ocPath)) {
              try {
                const tokens = JSON.parse(fs.readFileSync(ocPath, "utf-8"));
                const expired = tokens.expiry_date && tokens.expiry_date < Date.now();
                if (expired) {
                  checks.push("⚠️ OAuth tokens expired - re-authenticate with 'opencode auth login'");
                } else {
                  checks.push("✅ OAuth tokens valid");
                }
              } catch {
                checks.push("❌ OAuth tokens invalid");
                allHealthy = false;
              }
            } else {
              checks.push("❌ OAuth tokens not found");
              allHealthy = false;
            }
          } else {
            checks.push("❌ OAuth tokens not found");
            allHealthy = false;
          }
          
          const accounts = await getAllAccountQuotas();
          const currentAcc = accounts.find(a => a.email === activeAccount);
          if (currentAcc && currentAcc.quota !== undefined) {
            if (currentAcc.quota < 10) {
              checks.push(`⚠️ Low quota: ${currentAcc.quota.toFixed(1)}% - consider rotating`);
            } else {
              checks.push(`✅ Good quota: ${currentAcc.quota.toFixed(1)}%`);
            }
          }
          
          const result = [
            "## Model Switcher Health Check",
            "",
            ...checks,
            "",
            allHealthy ? "✅ **System Healthy**" : "⚠️ **System Needs Attention**"
          ];
          
          return result.join("\n");
        },
      }),
    },
  };
};

export default ModelSwitcherPlugin;
