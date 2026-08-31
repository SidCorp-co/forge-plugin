#!/usr/bin/env node
// Advice is only free if it is not forgotten: every write of a turn waits for it. docs/HOOKS.md.

import { basename } from "node:path";

import { advisedThisTurn, deny, readEvent, transcript, writing } from "./_hook.mjs";

const ev = readEvent();

// An order nobody can satisfy is not an order but a wall, so: advisor off, gate off.
if (!writing(ev) || process.env.CLAUDE_CODE_DISABLE_ADVISOR_TOOL === "1") process.exit(0);

const records = transcript(ev.transcript_path ?? "");
if (!records || advisedThisTurn(records)) process.exit(0);

const target = ev.tool_input?.file_path ?? ev.tool_input?.notebook_path;
deny(
  `Hold — ${target ? `\`${basename(target)}\`` : "this command"} writes, and advisor() has not run `
    + "this turn.\n\nIt reads the conversation, sees the approach before it hardens, and costs "
    + "nothing; found after the work, the same point costs the work.\n\n"
    + "Do this: call advisor(), then re-send. Every write in this turn is refused until that call "
    + "reaches the transcript.\n\nThe record of that call reaches the transcript about one "
    + "round-trip later, so the first attempt after it is refused even when you did call: run any "
    + "other command, then re-send.",
);
