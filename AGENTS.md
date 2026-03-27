# AGENTS.md — opencode-model-switcher

## Project Overview

OpenCode plugin for intelligent Gemini model switching with Google account auto-rotation and health tracking. Single-file TypeScript plugin (`opencode-model-switcher.ts`) that implements severity-based cooldowns, smart routing, and model downgrades.

## Build & Test Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm run build` | Type-check with `tsc --noEmit` |
| `npm test` | Placeholder |

## Project Structure

```
.
├── opencode-model-switcher.ts   # Main plugin (v2.0 Logic)
├── package.json                 # Dependencies
├── README.md                    # Main docs
├── INSTALL.md                   # Setup guide
└── .github/workflows/release.yml # CI/CD
```

## Code Style

### State Management

- **Atomic Writes**: Use `saveSwitcherState()` for all persistence. It uses a `.tmp` file + rename pattern to prevent corruption.
- **Lazy Healing**: Call `healAccounts()` during state load to recover health scores over time.

### Interfaces

```typescript
interface AccountRecord {
  email: string;
  healthScore: number;    // 0–100
  lastErrorAt: number;    // ms timestamp
  errorCount: number;
  cooldownUntil: number;  // ms timestamp
  proxy?: string;         // e.g. "socks5://..."
  fingerprint?: string;   // browser/device ID
}

interface SwitcherState {
  accounts: AccountRecord[];
  activeFallback?: string | null;
}
```

### Error Handling

- **Severity-Based Cooldowns**:
  - `critical` (429, 403, capacity): 15 min lock
  - `warning` (5xx): 1 min lock
  - `info`: No lock
- **Smart Rotation**: If an error is detected via `~/.gemini/last_error.json`, the plugin penalizes the account and re-routes to the next best candidate.

## File System Patterns

| Path | Purpose | Behavior |
|------|---------|----------|
| `~/.gemini/switcher_state.json` | Persistent state | Read/Write (Atomic) |
| `~/.gemini/active_fallback.json` | Routing result | Write |
| `~/.gemini/last_error.json` | Error signals | Read / Delete (if stale) |
| `~/.gemini/google_accounts.json` | Legacy data | Read only (during migration) |

## Tool Definitions

All tools must return **Clean Markdown**. Use `model_switcher_` prefix.

```typescript
model_switcher_smart_route: tool({
  description: "Select best model/account. Handles rotation and downgrades.",
  args: { preferred_model: tool.schema.string().optional() },
  async execute({ preferred_model }) { ... }
})

model_switcher_update: tool({
  description: "Configure OpenCode to use the latest version of this plugin from npm.",
  args: {},
  async execute() { ... }
})
```

## What NOT to Do

- **Don't** use `fs.writeFileSync` directly on state files. Use the `saveSwitcherState` helper.
- **Don't** assume `os.homedir()` is always available; guard it.
- **Don't** use flat cooldowns for all errors; differentiate between transient and terminal failures.
- **Don't** use `activeIndex` or simple queues. Selection must be health-based.
