#!/usr/bin/env node
// Record what a turn changed; ask once, at the end, for a second model to read it. Called bare
// for PostToolUse and with `--stop` for Stop. Why `touched()` and not tool_input: docs/HOOKS.md.

import { hookRecord, stopNotice } from "../src/codex.mjs";
import { readEvent, touched } from "./_hook.mjs";

const ev = readEvent();

if (process.argv[2] === "--stop") {
  const notice = stopNotice();
  if (notice) process.stdout.write(`${notice}\n`);
} else {
  const context = hookRecord(ev, touched(ev));
  if (context) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: context },
      }),
    );
  }
}
