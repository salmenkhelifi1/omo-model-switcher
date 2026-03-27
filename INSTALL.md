# Installation Guide

## Prerequisites

Before installing opencode-model-switcher, ensure you have:

1. **OpenCode installed** - <https://opencode.ai/docs>
2. **opencode-gemini-auth plugin** - For Google authentication

## Step-by-Step Installation

### Step 1: Install the Plugin (via npm)

Add the following to your `~/.config/opencode/opencode.json`:

```json
{
  "plugin": [
    "opencode-gemini-auth@latest",
    "omo-model-switcher@latest"
  ]
}
```

### Step 2: Initialize State

Once the plugin is loaded, run the initialization tool to import your existing accounts:

```text
Run model_switcher_init
```

This will read your `~/.gemini/google_accounts.json` and create the new `switcher_state.json` with health tracking enabled.

### Step 3: Verify

Check the status of your accounts:

```text
Run model_switcher_status
```

## Advanced Configuration

### Setting a Proxy

To avoid IP linkage across multiple accounts, set a proxy for each:

```text
Run model_switcher_set_account_proxy with:
email: "user@gmail.com", proxy: "socks5://127.0.0.1:9050"
```

### Setting a Fingerprint

Set a unique device identifier:

```text
Run model_switcher_set_account_fingerprint with:
email: "user@gmail.com", fingerprint: "unique-browser-id-123"
```

## How Rotation Works (V2)

Unlike V1 (which used a simple queue), V2 uses a **Health-First** algorithm:

1. **Health Score**: Every account starts at 100.
2. **Penalties**:
   - `critical` (429/403): -40 health, 15m cooldown.
   - `warning` (500/503): -15 health, 1m cooldown.
3. **Healing**: Accounts recover 5 health points for every minute they spend without an error.
4. **Selection**: `model_switcher_smart_route` always picks the account with the highest health score that is not currently in cooldown.

## Troubleshooting

### "No state found"

Run `model_switcher_init`. The plugin needs to migrate legacy accounts into its new tracking format.

### "System degraded"

Check `model_switcher_status`. You may have too many accounts in cooldown. Wait for them to heal or use `model_switcher_reset` to clear all penalties manually.

### "Manual Override"

If you need to use a specific account regardless of health, use:
`model_switcher_pin_account` with the desired email.
