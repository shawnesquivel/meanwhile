#!/bin/sh
# Meanwhile codex shim — prints one sponsor line, then hands off to the real
# codex binary. Installed at ~/.meanwhile/bin/codex; remove that directory
# from PATH (Meanwhile: Restore) and this file is inert.
#
# Failure policy: sponsor logic is best-effort and silenced; codex itself is
# exec'd unconditionally so this shim can never break the CLI.

MW_DIR="$HOME/.meanwhile"

# Banner only for interactive runs; never pollute piped/scripted output.
if [ -t 1 ]; then
  ( node "$MW_DIR/codex-banner.mjs" 2>/dev/null || true )
fi

# Resolve the real codex: first executable named codex on PATH that is not us.
REAL=""
OLDIFS=$IFS
IFS=:
for d in $PATH; do
  case "$d" in
    "$MW_DIR/bin") continue ;;
  esac
  if [ -x "$d/codex" ] && [ ! -d "$d/codex" ]; then
    REAL="$d/codex"
    break
  fi
done
IFS=$OLDIFS

if [ -z "$REAL" ]; then
  echo "meanwhile: real codex not found on PATH" >&2
  exit 127
fi

exec "$REAL" "$@"
