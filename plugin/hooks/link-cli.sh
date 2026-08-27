#!/usr/bin/env sh
# The skills tell the agent to run `forge` and `vi-natural`, so both have to be on PATH.
BIN="$HOME/.local/bin"
mkdir -p "$BIN" 2>/dev/null || exit 0
for name in forge vi-natural; do
  ln -sf "$1/bin/$name" "$BIN/$name" 2>/dev/null || true
done
exit 0
