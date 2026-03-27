# Contributing to opencode-model-switcher

Thank you for your interest in contributing to the OpenCode Model Switcher! Digital resilience is a community effort, and we welcome your help in making this plugin smarter and more robust.

## How to Contribute

### 1. Setup Local Development

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/salmenkhelifi1/omo-model-switcher.git
   cd omo-model-switcher
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Start Coding**:
   The main logic resides in `opencode-model-switcher.ts`.

### 2. Development Workflow

- **Build/Type-check**: Before submitting a PR, ensure your changes compile without errors:

    ```bash
    npm run build
    ```

- **State Management**: When modifying how health records or switcher state are saved, **always** use the `saveSwitcherState()` helper to ensure atomic writes and prevent corruption.
- **Model Support**: If adding support for new models, update the `ALLOWED_MODELS` array and the downgrade routing logic.

### 3. Commit Guidelines

We recommend using clear, descriptive commit messages. Following [Conventional Commits](https://www.conventionalcommits.org/) (e.g., `feat: Add support for X`, `fix: Resolve health scoring bug`) is preferred.

### 4. Submitting a Pull Request

1. Create a branch for your feature or fix.
2. Commit your changes.
3. Push to your branch and open a PR.
4. Ensure all CI checks pass (including the GitHub Actions release flow where applicable).

## Code Style & Architecture

For a deep dive into the plugin's architecture, state management patterns, and error handling severities, please refer to the [AGENTS.md](AGENTS.md) file. This document serves as the technical source of truth for the project.

---

### Core Principles

- **Resilience First**: Any change should prioritize keeping the user connected to a model even during API outages or rate limits.
- **Privacy-Aware**: Respect account-specific proxies and fingerprints.
- **Atomic Persistence**: Never write directly to JSON files; use the provided atomic helpers.

Happy coding!
