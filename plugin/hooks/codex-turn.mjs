#!/usr/bin/env node
// Record what a turn changed and ask once per turn and checkout for a second model to read it.

import { hookRecord } from "../src/codex.mjs";
import { askedAlready, readEvent, touched, transcript, turnAt } from "./_hook.mjs";

const ev = readEvent();

/* The Stop half is gone; the guard stays until a restart drops the registration with it. */
if (process.argv[2] === "--stop") {
  process.exit(0);
} else {
  const at = turnAt(transcript(ev.transcript_path ?? "") ?? []);
  const told = (root) => askedAlready(ev, `${root} ${at}`, "codex-turn");
  const context = hookRecord(ev, touched(ev), told);
  if (context) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: context },
      }),
    );
  }
}
