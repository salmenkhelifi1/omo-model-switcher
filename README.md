# 🚀 OpenCode Gemini Model Switcher (v2.0)

[![npm version](https://img.shields.io/badge/npm-v2.0.0-blue.svg)](https://www.npmjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![OpenCode Plugin](https://img.shields.io/badge/OpenCode-Plugin-orange.svg)](https://opencode.ai)

**Intelligent Google Gemini AI model switching with automated account rotation, health tracking, and smart error recovery for OpenCode.**

The **OpenCode Gemini Model Switcher** is a high-performance TypeScript plugin designed to solve the challenges of building reliable AI-powered applications. It provides seamless **account auto-rotation**, **rate-limit management**, and **automated model downgrades** to ensure your Gemini API calls never fail.

---

## 🔥 Key Features

- **🔄 Intelligent Account Rotation** — Automatically cycles through multiple Google accounts based on real-time health and quota availability.
- **🛡️ Severity-Based Resilience** — Implements smart cooldowns: 15 minutes for critical errors (429, 403, Capacity) and 1 minute for transient server warnings (5xx).
- **📉 Automated Model Downgrades** — Smart routing detects capacity issues and falls back from `gemini-2.0-flash-thinking` to `gemini-2.0-flash` or `gemini-1.5-flash` instantly.
- **🌐 Proxy & Fingerprint Support** — Assign unique SOCKS5/HTTP proxies and device identifiers to each account to bypass geographic and anti-bot restrictions.
- **🏥 Self-Healing Health System** — Accounts "heal" over time, recovering health scores (0-100) automatically after successful cooldown periods.
- **⚡ OpenCode Native** — Built specifically as a single-file TypeScript plugin for the OpenCode ecosystem.

---

## 🚀 Quick Setup

### 1. Requirements

- [OpenCode](https://opencode.ai) installed.
- The `opencode-gemini-auth` plugin for Google authentication.
- Your Google accounts and tokens stored in `~/.gemini/`.

### 2. Installation

The plugin is distributed via npm. Install it directly into your OpenCode project:

```bash
opencode plugin add omo-model-switcher@latest
```

### 3. Initialize Settings

Run the initialization tool to set up your account health state:

```bash
opencode run model_switcher_init
```

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

## 🤝 Contributing

We ❤️ contributions! Whether it's a bug fix, a new feature, or an SEO improvement, we welcome your help to make Gemini model switching even better.

1. Check out our [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow.
2. Follow the **Agentic Diamond Standard** for tool definitions.
3. Ensure your code passes `npm run build` (TypeScript type checking).

---

## 📜 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

## 🌍 Keywords

`gemini-ai`, `google-gemini`, `model-switcher`, `ai-automation`, `opencode-plugin`, `rate-limiting`, `account-rotation`, `api-resilience`, `typescript-plugin`, `ai-routing`.
