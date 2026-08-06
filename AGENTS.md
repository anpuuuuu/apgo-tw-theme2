# AGENTS.md

## Cursor Cloud specific instructions

This is a **Shopify theme** (Savor v2.1.6) — there is no build step, no package manager, and no backend services to run. The only development tool is Shopify CLI.

### Development Environment

- **Node.js 20.x** and **Shopify CLI 3.x** are required
- Install: `npm install -g @shopify/cli @shopify/theme`

### Key Commands

| Command | Purpose |
|---------|---------|
| `shopify theme check --path .` | Lint/validate theme (Liquid, JSON, CSS). Exit code 1 = warnings/errors found. |
| `shopify theme check --path . --output json` | Machine-readable lint output (recommended for CI/automation — avoids interactive pager) |
| `shopify theme dev --store STORE.myshopify.com --path .` | Start local dev server with hot reload connected to a Shopify store |
| `shopify theme push --store STORE.myshopify.com --path .` | Deploy theme to store |

### Authentication

Running `shopify theme dev` or `shopify theme push` requires one of:
1. **Interactive OAuth** — `shopify auth login --store STORE.myshopify.com` (opens browser)
2. **Token-based (CI/headless)** — set `SHOPIFY_CLI_THEME_TOKEN` env var with a Theme Access password or custom app token, plus provide `--store`

### Gotchas

- `shopify theme check` with default (text) output goes through a pager on large themes. Always use `--output json` and redirect to a file when running non-interactively.
- The theme has ~4600 lint offenses (mostly `MatchingTranslations` errors from incomplete locale coverage). This is pre-existing and not a build blocker.
- There are no `node_modules`, no `package.json`, no build/transpilation steps. All JS/CSS assets are plain files served directly by Shopify CDN.
- The `.gitignore` already covers `.shopify/`, `config.yml`, and `node_modules/`.

### Theme Structure

```
assets/       → Static JS/CSS (108 files)
blocks/       → Theme blocks
config/       → settings_schema.json, settings_data.json
layout/       → theme.liquid, password.liquid
locales/      → 51 translation files
sections/     → 128 Liquid sections
snippets/     → 125 Liquid snippets
templates/    → JSON + Liquid page templates
```
