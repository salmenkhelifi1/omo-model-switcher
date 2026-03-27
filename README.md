# opencode-model-switcher

Intelligent model switching with Google account auto-rotation for OpenCode.

## Features

- **No Antigravity Cockpit required** - Uses OpenCode's built-in auth.
- **Smart Routing** - Automatically detects errors and rotates accounts or downgrades to Flash/Flash-Lite models.
- **Account Health System** - Tracks health scores (0-100) and applies severity-based cooldowns (15m for critical, 1m for warnings).
- **Proxy & Fingerprint Support** - Set unique SOCKS5/HTTP proxies and device fingerprints per account to avoid linkage.
- **Atomic State Management** - Guaranteed data integrity via atomic JSON writes.
- **Zero-Config Migration** - Automatically imports your existing `google_accounts.json`.

## Installation

### 1. Install the Plugin

Add to your OpenCode config `~/.config/opencode/opencode.json`:

```json
{
  "plugin": [
    "opencode-gemini-auth@latest",
    "omo-model-switcher@latest"
  ]
}
```

### 2. Add Commands (Optional)

```json
{
  "command": {
    "model-status": {
      "template": "Run the model_switcher_status tool and report the results.",
      "description": "Check account health and proxies"
    },
    "model-route": {
      "template": "Run the model_switcher_smart_route tool.",
      "description": "Route to the best available account/model"
    },
    "model-health": {
      "template": "Run the model_switcher_health tool.",
      "description": "System health check"
    }
  }
}
```### 🔁 Updating the Plugin

To ensure you always have the latest resilience patterns and model routing logic, run:

```bash
model_switcher_update
```

This command configures your OpenCode to automatically pull the `@latest` version from npm. After running it, restart OpenCode.

---

## Available Tools

| Tool | Description |
| ---- | ----------- |
| `model_switcher_init` | Initialize state from existing accounts |
| `model_switcher_status` | View health scores, cooldowns, and proxies |
| `model_switcher_smart_route` | **Primary Tool**: Selects best account/model |
| `model_switcher_health` | Diagnose active error signals |
| `model_switcher_set_account_proxy` | Set SOCKS5/HTTP proxy for an account |
| `model_switcher_set_account_fingerprint` | Set device fingerprint for an account |
| `model_switcher_pin_account` | Force specific account for next session |
| `model_switcher_reset` | Reset all health scores to 100% |
| `model_switcher_update` | Update plugin to latest version from npm |

## How It Works

The plugin acts as a traffic controller between your request and the Gemini API.

1. **Detection**: It reads `~/.gemini/last_error.json` (written by CLI or hooks).
2. **Analysis**: Classifies errors into `capacity`, `rate_limit`, `auth_expired`, or `server_error`.
3. **Action**:
   - **Rotate**: Penalizes the failing account and switches to the healthiest alternative.
   - **Downgrade**: If all accounts are at capacity for Pro, it switches to Flash or Flash Lite.
   - **Cooldown**: Applies a 1-15 minute "ice box" based on error severity.

## Configuration Files

| File | Purpose |
| ---- | ------- |
| `~/.gemini/switcher_state.json` | **V2 State**: Health, proxies, and error tracking |
| `~/.gemini/active_fallback.json` | Result of the last routing decision |
| `~/.gemini/google_accounts.json` | Legacy account list (used for migration) |
| `~/.gemini/last_error.json` | Error signal input |

## Requirements

- OpenCode AI
- opencode-gemini-auth plugin
- Python 3 (optional, for external automation)

## Contributing

We welcome contributions! Please see our [CONTRIBUTING.md](CONTRIBUTING.md) for local development setup and guidelines.

## License

MIT
