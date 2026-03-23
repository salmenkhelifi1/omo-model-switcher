# opencode-model-switcher

Intelligent model switching with Google account auto-rotation for OpenCode.

## Features

- **Automatic account switching** - Switches to next Google account when rate limit (429) is hit
- **Model fallback chain** - Falls back to MiniMax or GPT-Nano when all accounts exhausted
- **Health check tools** - Built-in tools to monitor system health
- **Quota monitoring** - Tracks quota across all 10 Google accounts
- **Integration** - Works with `gemini-auto-switch.py` and `opencode-gemini-auth` plugin

## Installation

### 1. Install the Plugin

Add to your OpenCode config `~/.config/opencode/opencode.json`:

```json
{
  "plugin": [
    "oh-my-opencode@latest",
    "opencode-gemini-auth@latest",
    "opencode-model-switcher@latest"
  ]
}
```

### 2. Restart OpenCode

```bash
pkill -f opencode && sleep 2 && opencode &
```

### 3. Prerequisites

Ensure you have:
- [opencode-gemini-auth](https://github.com/jenslys/opencode-antigravity-auth) plugin installed
- Multiple Google accounts configured in `~/.antigravity_cockpit/gemini_accounts.json`
- `gemini-auto-switch.py` running (see [gemini-auto-switch repo](https://github.com/salmen7/gemini-auto-switch))

## Available Tools

This plugin provides 5 tools that the AI agent can use:

### 1. `model_switcher_status`
Check current model, account status, and quota information.

```bash
# Usage via AI agent
Call model_switcher_status tool
```

### 2. `model_switcher_rotate`
Force rotate to the next Google account with highest quota.

```bash
# Usage via AI agent
Call model_switcher_rotate tool
```

### 3. `model_switcher_recommend`
Recommend the best model based on task complexity and current system state.

```bash
# Usage via AI agent
Call model_switcher_recommend with task_complexity: "complex"
```

### 4. `model_switcher_fallback`
Switch to fallback model when all accounts exhausted.

```bash
# Usage via AI agent
Call model_switcher_fallback with preferred_fallback: "minimax"
```

### 5. `model_switcher_health`
Run health check on the model switching system.

```bash
# Usage via AI agent
Call model_switcher_health tool
```

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                    MODEL SWITCHER FLOW                           │
└─────────────────────────────────────────────────────────────────┘

Request → Gemini API
         │
         ├─► Success → Continue
         │
         └─► Error 429 (Rate Limit)
                   │
                   ▼
         ┌─────────────────────────┐
         │  opencode-gemini-auth   │
         │  plugin detects 429      │
         │  writes last_error.json  │
         └─────────────────────────┘
                   │
                   ▼
         ┌─────────────────────────┐
         │  gemini-auto-switch.py  │
         │  detects signal (5s)    │
         │  force rotates account  │
         └─────────────────────────┘
                   │
                   ▼
         ┌─────────────────────────┐
         │  gemini-switch.py      │
         │  updates credentials   │
         │  rotates to next       │
         └─────────────────────────┘
                   │
                   ▼
              Retry with new account
```

## Configuration Files

| File | Purpose |
|------|---------|
| `~/.gemini/google_accounts.json` | Active account selector |
| `~/.gemini/oauth_creds.json` | OAuth tokens |
| `~/.gemini/last_error.json` | Rate limit signal |
| `~/.antigravity_cockpit/gemini_accounts.json` | Account index |
| `~/.antigravity_cockpit/gemini_accounts/*.json` | Per-account data |

## Adding to oh-my-opencode Skills

The model-switcher skill is also available as an OpenCode skill:

```
~/.config/opencode/skills/model-switcher/
├── SKILL.md           # Main skill file
└── ARCHITECTURE.md    # Architecture documentation
```

## Troubleshooting

### Auto-switcher not running
```bash
python3 ~/gemini-auto-switch.py &
```

### No accounts found
Make sure you have accounts configured in `~/.antigravity_cockpit/gemini_accounts.json`

### Tokens expired
```bash
opencode auth login
```

## Requirements

- OpenCode AI
- opencode-gemini-auth plugin
- Python 3
- Multiple Google accounts with Gemini quota

## License

MIT
