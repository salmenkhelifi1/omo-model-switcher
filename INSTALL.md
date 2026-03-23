# Installation Guide

## Prerequisites

Before installing opencode-model-switcher, ensure you have:

1. **OpenCode installed** - https://opencode.ai/docs
2. **opencode-gemini-auth plugin** - For Google authentication
3. **Python 3** - For the auto-switcher scripts
4. **Multiple Google accounts** - With Gemini quota

## Step-by-Step Installation

### Step 1: Install Dependencies

First, ensure you have the required plugins:

```bash
# Install opencode-gemini-auth
opencode plugin add opencode-gemini-auth@latest
```

### Step 2: Configure OpenCode

Edit your `~/.config/opencode/opencode.json`:

```json
{
  "plugin": [
    "oh-my-opencode@latest",
    "opencode-gemini-auth@latest",
    "opencode-model-switcher@latest"
  ]
}
```

### Step 3: Set Up Google Accounts

1. Go to https://gemini.google.com/
2. Sign in with multiple Google accounts
3. Run the setup for Antigravity Cockpit (if not already done)

### Step 4: Set Up Auto-Switcher

```bash
# Clone or copy the auto-switcher scripts
# Ensure gemini-auto-switch.py is in your home directory

# Make it executable
chmod +x ~/gemini-auto-switch.py
chmod +x ~/gemini-switch.py

# Start the auto-switcher
python3 ~/gemini-auto-switch.py &

# Add to startup (optional)
# Add to ~/.bashrc or ~/.config/systemd/user/
```

### Step 5: Restart OpenCode

```bash
pkill -f opencode && sleep 2 && opencode &
```

### Step 6: Verify Installation

```bash
# Check that the plugin is loaded
opencode --version

# Run health check
# In OpenCode, ask the AI:
# "Run model_switcher_health tool"
```

## Configuration

### Account Setup

Your accounts should be in `~/.antigravity_cockpit/gemini_accounts.json`:

```json
{
  "accounts": [
    { "id": "gemini_xxx", "email": "account1@gmail.com" },
    { "id": "gemini_yyy", "email": "account2@gmail.com" }
  ]
}
```

### Auto-Switcher Configuration

Edit `~/gemini-auto-switch.py` to adjust settings:

```python
THRESHOLD = 10    # Switch if quota < 10%
CHECK_INTERVAL = 60  # Check every 60 seconds
TARGET_PROJECT = "your-project-id"
```

## Upgrading

```bash
# Update the plugin in opencode.json
# Change version to latest
"opencode-model-switcher@latest"

# Restart OpenCode
pkill -f opencode && sleep 2 && opencode &
```

## Uninstalling

1. Remove from `~/.config/opencode/opencode.json`:
```json
{
  "plugin": [
    "oh-my-opencode@latest",
    "opencode-gemini-auth@latest"
  ]
}
```

2. Restart OpenCode

## Common Issues

### "Plugin not loading"
- Check for TypeScript errors: `npx tsc --noEmit`
- Verify JSON config is valid

### "No accounts found"
- Ensure `~/.antigravity_cockpit/gemini_accounts.json` exists
- Run the Antigravity Cockpit setup

### "Auto-switcher not working"
- Check if running: `ps aux | grep gemini-auto-switch`
- Check logs: `tail ~/.antigravity_cockpit/logs/app.log`

## Support

- GitHub Issues: https://github.com/salmen7/opencode-model-switcher/issues
- Discord: OpenCode community
