#!/bin/bash
# M1f end-to-end: install the packaged VSIX into Cursor, open a fresh window
# (a new extension host activates Meanwhile), verify every surface
# side-effect on disk + in the backend DB, then drive a real interactive
# `claude` session in a pty and confirm statusline impressions flow all the
# way into Postgres. Requires:
#   - dev backend on http://127.0.0.1:3100 (npm run dev in web/)
#   - docker postgres `meanwhile-pg` (schema migrated + seeded)
#   - Cursor `cursor` CLI, claude CLI, expect
set -u
cd "$(dirname "$0")/.."

PASS=0; FAIL=0
check() { # name, condition-exit-code
  if [ "$2" -eq 0 ]; then echo "PASS  $1"; PASS=$((PASS+1)); else echo "FAIL  $1"; FAIL=$((FAIL+1)); fi
}

MW="$HOME/.meanwhile"
SETTINGS="$HOME/.claude/settings.json"
PSQL="docker exec meanwhile-pg psql -U meanwhile -d meanwhile -t -A -c"

# --- 0) preconditions ------------------------------------------------------
curl -sf http://127.0.0.1:3100/api/v1/portfolio?surface=cc_webview\&client_id=e2e >/dev/null
check "backend reachable" $?
$PSQL "select 1" >/dev/null 2>&1
check "postgres reachable" $?

# --- 1) point the extension at the dev backend -----------------------------
mkdir -p "$MW"
printf '{\n  "backendBaseUrl": "http://127.0.0.1:3100",\n  "debug": true\n}\n' > "$MW/config.json"
check "dev config written" $?

# Clean slate for assertion freshness (keep device id + backups).
rm -f "$MW/debug.log" "$MW/sponsors.json" "$MW/cli-events.jsonl" "$MW/.statusline-state.json"

# --- 2) package + install into Cursor ---------------------------------------
npm run package >/dev/null 2>&1
check "vsix packaged" $?
cursor --install-extension "$(pwd)/meanwhile.vsix" --force >/dev/null 2>&1
check "vsix installed into Cursor" $?

EVENTS_BEFORE=$($PSQL "select count(*) from event where surface='cc_cli_statusline'")

# --- 3) open a fresh Cursor window: its extension host activates the VSIX ---
cursor --new-window >/dev/null 2>&1
sleep 30

grep -q '"event":"activate"' "$MW/debug.log" 2>/dev/null
check "extension activated in Cursor" $?
test -s "$MW/sponsors.json"
check "sponsor cache written" $?
grep -q '.meanwhile/statusline.mjs' "$SETTINGS" 2>/dev/null
check "claude settings: statusline installed" $?
grep -q '"spinnerVerbs"' "$SETTINGS" 2>/dev/null
check "claude settings: spinner verbs installed" $?
grep -q '"mode": *"replace"' "$SETTINGS" 2>/dev/null
check "spinner verbs use schema object shape" $?
test -f "$MW/cc-webview-state.json"
check "claude webview builds patched" $?
test -f "$MW/codex-cli-state.json"
check "codex shim installed" $?
test -f "$MW/loopback.json"
check "loopback discovery written" $?
LB_PORT=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.env.HOME+"/.meanwhile/loopback.json","utf8")).port)' 2>/dev/null)
curl -sf "http://127.0.0.1:${LB_PORT}/health" | grep -q '"ok":true'
check "loopback /health answers (port $LB_PORT)" $?

# --- 4) real interactive claude session renders the sponsor line -----------
TMPDIR_CC=$(mktemp -d)
expect <<'EOF' >/dev/null 2>&1
set timeout 25
spawn claude
expect {
  -re {bypass|trust|Yes, proceed|No, exit} { send "1\r"; exp_continue }
  timeout {}
}
sleep 12
send "\x03"
sleep 1
send "\x03"
sleep 1
catch { close }
EOF
check "interactive claude session ran" $?

# statusline script should have logged >=1 impression for the session
sleep 2
test -s "$MW/cli-events.jsonl" || grep -q 'cli-events' "$MW/debug.log" 2>/dev/null
EVENTS_FILE_OK=$?
# the extension may have already drained the file on its 30s tick — either
# the file has content now, or the DB count will have moved. Give the drain
# one full tick to fire, then check the authoritative end of the pipe.
sleep 35
EVENTS_AFTER=$($PSQL "select count(*) from event where surface='cc_cli_statusline'")
test "${EVENTS_AFTER:-0}" -gt "${EVENTS_BEFORE:-0}"
DB_MOVED=$?
test $EVENTS_FILE_OK -eq 0 -o $DB_MOVED -eq 0
check "statusline impression captured (file or db)" $?
check "statusline impressions reached postgres ($EVENTS_BEFORE → $EVENTS_AFTER)" $DB_MOVED

rm -rf "$TMPDIR_CC"

# --- 5) leave the Cursor window for manual inspection ------------------------
echo "NOTE: a Cursor window was opened for the test; close it whenever."

echo
echo "RESULT: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
