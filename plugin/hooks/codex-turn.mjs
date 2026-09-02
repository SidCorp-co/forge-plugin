#!/usr/bin/env node
// Record what a turn changed and ask once per turn and checkout for a second model to read it.

import { hookRecord } from "../src/codex.mjs";
import { askedAlready, readEvent, touched, turnAt, turnRecords } from "./_hook.mjs";

const ev = readEvent();
const at = turnAt(turnRecords(ev.transcript_path ?? "") ?? []);
const told = (root) => askedAlready(ev, `${root} ${at}`, "codex-turn");
const context = hookRecord(ev, touched(ev), told);
if (context) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: context },
    }),
  );
}
