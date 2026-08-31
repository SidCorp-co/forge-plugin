#!/usr/bin/env node
// Record what a turn changed and ask once for a second model to read it. docs/HOOKS.md.

import { hookRecord } from "../src/codex.mjs";
import { readEvent, touched } from "./_hook.mjs";

const ev = readEvent();

/* The Stop half is gone; the guard stays until a restart drops the registration with it. */
if (process.argv[2] === "--stop") {
  process.exit(0);
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
