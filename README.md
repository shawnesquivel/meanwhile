# Meanwhile

**Meanwhile, you're earning.** Tasteful single-line sponsors in the *thinking
spinner* of Claude Code & Codex — with a 50% revenue share back to you. Open
source, fully reversible, never reads your code or prompts.

This is a clean-room project (not affiliated with any other product). The
extension only edits the spinner/status display text and restores everything
byte-for-byte on demand.

## Repo layout

```
meanwhile/
  web/         Next.js app + API (the backend, deploys to Vercel)
  extension/   VS Code / Cursor extension (esbuild → VSIX)
  shared/      API contract types imported by both halves
```

## Stack

- **Web/API:** Next.js 16 (App Router) on Vercel
- **DB:** Neon Postgres + Drizzle ORM
- **Auth:** better-auth (web) behind a swappable boundary; the extension uses
  our own opaque-token layer so the web auth provider can change without
  touching the extension
- **Payments:** Stripe Checkout (impression blocks + monthly membership)

## How it works (architecture)

The extension finds compatible surfaces and replaces the random "thinking" verb
with a sponsor line:

| Surface | Target |
|---|---|
| Claude Code panel (VS Code/Cursor) | `…/anthropic.claude-code-*/webview/index.js` (+ CSP relax in `extension.js`) |
| Claude Code terminal CLI | `~/.claude/settings.json` → `statusLine` script + `spinnerVerbs` |
| Codex CLI | PATH wrapper around the `codex` shim |

A local loopback HTTP server (127.0.0.1, token-gated) receives impression/click
events from the injected webview block (its CSP blocks direct backend calls),
then forwards them to the backend. Every edit is backed up and reversible via
**Meanwhile: Restore editor**.

## Develop

```bash
# web
cd web && npm run dev

# extension
cd extension && npm run build      # → dist/extension.js
cd extension && npm run package    # → meanwhile.vsix
```

See `docs/` (added per-milestone) for the full plan.
