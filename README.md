# 🚀 OpenCode Gemini Model Switcher (v2.0)

[![npm version](https://img.shields.io/npm/v/opencode-model-switcher.svg)](https://www.npmjs.com/package/opencode-model-switcher)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![OpenCode Plugin](https://img.shields.io/badge/OpenCode-Plugin-orange.svg)](https://opencode.ai)
[![X (Twitter)](https://img.shields.io/badge/X-@dopesalmon-000000?style=flat&logo=x)](https://x.com/dopesalmon)
[![npm downloads](https://img.shields.io/npm/dw/opencode-model-switcher.svg)](https://www.npmjs.com/package/opencode-model-switcher)

**Intelligent Google Gemini AI model switching with automated account rotation, health tracking, and smart error recovery for OpenCode.**

The **OpenCode Gemini Model Switcher** is a high-performance TypeScript plugin designed to solve the challenges of building reliable AI-powered applications. It provides seamless **account auto-rotation**, **rate-limit management**, and **automated model downgrades** to ensure your Gemini API calls never fail.

---

## 🔥 What You Get

- **🔄 Intelligent Account Rotation** — Automatically cycles through multiple Google accounts based on real-time health and quota availability.
- **🛡️ Severity-Based Resilience** — Implements smart cooldowns: 15 minutes for critical errors (429, 403, Capacity) and 1 minute for transient server warnings (5xx).
- **📉 Automated Model Downgrades** — Smart routing detects capacity issues and falls back from `gemini-2.0-flash-thinking` to `gemini-2.0-flash` or `gemini-1.5-flash` instantly.
- **🌐 Proxy & Fingerprint Support** — Assign unique SOCKS5/HTTP proxies and device identifiers to each account to bypass geographic and anti-bot restrictions.
- **🏥 Self-Healing Health System** — Accounts "heal" over time, recovering health scores (0-100) automatically after successful cooldown periods.
- **⚡ OpenCode Native** — Built specifically as a single-file TypeScript plugin for the OpenCode ecosystem.

---

## 🚀 Installation

<details open>
<summary><b>For Humans</b></summary>

**Option A: Let an LLM do it (Recommended)**

Paste this into any LLM agent (Claude Code, OpenCode, Cursor, etc.):

```text
Install the opencode-model-switcher plugin and initialize account health tracking by following: https://raw.githubusercontent.com/salmenkhelifi1/omo-model-switcher/master/README.md
```

**Option B: Manual setup**

1. **Add the plugin** to `~/.config/opencode/opencode.json`:

   ```json
   {
     "plugin": ["opencode-model-switcher@latest"]
   }
   ```

2. **Initialize Settings**:

   ```bash
   opencode run model_switcher_init
   ```

3. **Verify**:

   ```bash
   opencode run model_switcher_status
   ```

</details>

<details>
<summary><b>For LLM Agents</b></summary>

**Intelligent Routing Integration**

When encountering Gemini errors (429, 403, Capacity), call the `model_switcher_smart_route` tool to select the next healthy candidate.

1. **Check Status**: Use `model_switcher_status` to see current health and cooldowns.
2. **Route**: Call `model_switcher_smart_route` with your `preferred_model`.
3. **Handle Errors**: If an error occurs, the plugin automatically penalizes the account and provides a new route for the next request.

</details>

---

## 🛠 Available Tools

| Tool | Description |
|---|---|
| `model_switcher_smart_route` | **The Brain.** Selects the best candidate based on health, proxies, and model requirements. |
| `model_switcher_status` | **Dashboard.** View all accounts, health scores, and active cooldown timers. |
| `model_switcher_set_account_proxy` | **Network.** Configure custom SOCKS5/HTTP proxies for specific accounts. |
| `model_switcher_reset_health` | **Recovery.** Reset health scores for all accounts to 100 instantly. |
| `model_switcher_update` | **Sync.** Automatically updates OpenCode to use the latest version from npm. |

---

## 🚑 Troubleshooting

<details>
<summary><b>Error 429: Too Many Requests</b></summary>

The plugin will automatically apply a **15-minute cooldown** to the account and route your next request to a healthy peer. No manual action needed.

</details>

<details>
<summary><b>Error 403: Permission Denied</b></summary>

Check your authentication state with `opencode-gemini-auth`. If the account is valid, the plugin treats this as a critical error and rotates to a different token.

</details>

<details>
<summary><b>Model Capacity Exhausted</b></summary>

The plugin will automatically downgrade your request to a lower-tier Gemini model (e.g., from Thinking to Flash) to maintain service availability.

</details>

---

## 🤝 Contributing

We ❤️ contributions! Check out our [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow and safety standards.

---

## 📜 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

## 🌍 Keywords

`gemini-ai`, `google-gemini`, `model-switcher`, `ai-automation`, `opencode-plugin`, `rate-limiting`, `account-rotation`, `api-resilience`, `typescript-plugin`, `ai-routing`.
