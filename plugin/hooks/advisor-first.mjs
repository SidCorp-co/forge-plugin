#!/usr/bin/env node
// Every write of a turn waits for advice, unless the advisor is off. why/advisor-first.md.

import { basename } from "node:path";

import { advisedThisTurn, deny, readEvent, transcript, why, writing } from "./_hook.mjs";

const ev = readEvent();

if (!writing(ev) || process.env.CLAUDE_CODE_DISABLE_ADVISOR_TOOL === "1") process.exit(0);

const records = transcript(ev.transcript_path ?? "");
if (!records || advisedThisTurn(records)) process.exit(0);

const target = ev.tool_input?.file_path ?? ev.tool_input?.notebook_path;
deny(
  `Hold — ${target ? `\`${basename(target)}\`` : "this command"} writes, and advisor() has not run `
    + "this turn.\n\nDo this: call advisor(), then re-send. Its record reaches the transcript about "
    + "one round-trip later, so run any other command before the re-send."
    + why(),
);
