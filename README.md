# ✱ meanwhile

**Get paid while the model thinks.**

Meanwhile replaces the made-up thinking verbs in your AI coding tools
("Discombobulating…", "Percolating…") with one tasteful sponsor line — and
pays you half of every sponsored impression your machine shows.

Built for people who watch spinners professionally.

## How it works

While Claude Code or Codex is working, its spinner displays a random verb.
Meanwhile patches that single display string into a sponsor slot:

| Surface | Where | Mechanism |
| --- | --- | --- |
| Spinner overlay | Claude Code panel in VS Code / Cursor | `webview/index.js` patch + CSP allowance for the local loopback |
| Status line | Claude Code terminal CLI | `~/.claude/settings.json` statusLine script (OSC-8 clickable) |
| Spinner verbs | Claude Code terminal CLI | `spinnerVerbs` override in `settings.json` |
| Startup banner | Codex terminal CLI | PATH shim that prints one line, then `exec`s the real binary |
| Chat waiting state | `/chat` web experiment | The thinking line is the slot, via OpenRouter |

Sponsors prepay fixed-price impression blocks — no auction, no bidding wars.
A block is 1,000 counted impressions (a line must be visibly on screen ~3s to
count; a click consumes 50 impressions of budget). 50% of every counted
event is credited to the signed-in user whose machine showed it.

## The deal

- **Open source, end to end.** The extension, the patchers, and this backend
  are all in this repo. Audit what runs on your machine.
- **Reversible in one click.** Byte-exact backups of everything touched;
  `Meanwhile: Restore` puts every file back exactly as it was.
- **Sponsors, not trackers.** One line of text. No pixels, no fingerprinting,
  and the extension never reads your code, prompts, or completions.
- **50/50, stated plainly.** The split is in the serving code, not a TOS
  footnote.

## Repo layout

```
web/        Next.js app — landing, sponsor portal, dashboard, leaderboard,
            chat experiment, and all APIs (Drizzle + Postgres)
extension/  VS Code extension — service layer, loopback server, and the
            three surface adapters with their patch/restore logic
shared/     The API contract shared by both (types, routes, constants)
```

Key boundaries:

- **Auth is modular.** The web app uses better-auth (email/password today);
  the extension talks only to a provider-agnostic opaque-token layer
  (`/api/v1/ext/auth/*`). Swapping web auth touches one file and one page.
- **Money is integer micro-USD** (`bigint`) everywhere. No floats.
- **CLI tools never talk to the network.** Adapter scripts read a local
  `sponsors.json` the extension maintains and append impression events to a
  local JSONL file the extension drains and ships as authenticated beacons.

## Local development

Prereqs: Node 20+, Docker (for local Postgres).

```bash
# 1. Database
docker run -d --name meanwhile-pg -p 5433:5432 \
  -e POSTGRES_USER=meanwhile -e POSTGRES_PASSWORD=meanwhile \
  -e POSTGRES_DB=meanwhile postgres:16

# 2. Web app
cd web
cp .env.example .env.local   # fill in DATABASE_URL etc.
npm install
npm run db:migrate
npm run db:seed              # house + demo sponsor inventory
npm run dev -- --port 3100

# 3. Extension
cd ../extension
npm install
npm run build                # esbuild -> dist/
npm run package              # -> meanwhile-<version>.vsix
```

Tests:

```bash
cd extension
npm test                     # unit: patchers, settings editor, rc editor
npm run test:harness         # headless integration vs the live backend
./test/e2e-editor.sh         # full VSIX install into Cursor + real claude run
```

Stripe is optional locally — without `STRIPE_SECRET_KEY`, sponsor checkout
activates campaigns instantly so the full serve→credit loop works offline.
Set the key (+ `STRIPE_WEBHOOK_SECRET`) to exercise real Checkout.

## Status

Working today: all three editor/CLI surfaces, the full sponsor checkout →
serve → credit → payout-request loop, the public queue + leaderboard, and
the OpenRouter chat experiment. Payouts are tracked in-app and settled
manually by the operator (this is a personal project, not a fintech).

## A note on taste

The slot is one line of plain text in a UI element that was already showing
nonsense words. If a sponsor line is ever louder than "Flibbertigibbeting…",
that's a bug.
