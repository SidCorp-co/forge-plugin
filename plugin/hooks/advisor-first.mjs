#!/usr/bin/env node
// Advice is only free if it is not forgotten: every write of a turn waits for it. docs/HOOKS.md.

import { basename } from "node:path";

import { REDIRECT, WRITES, advisedThisTurn, deny, readEvent, settle } from "./_hook.mjs";

const spills = (command) =>
  [...command.matchAll(REDIRECT)].some((one) => !/^\/dev\//.test(one[1].replace(/['"]/gu, "")));

const ev = readEvent();
const ti = ev.tool_input ?? {};
const target = ti.file_path ?? ti.notebook_path;
const command = String(ti.command ?? "");
const writing = ev.tool_name === "Bash" ? WRITES.test(command) || spills(command) : Boolean(target);

// An order nobody can satisfy is not an order but a wall, so: advisor off, gate off.
if (!writing || process.env.CLAUDE_CODE_DISABLE_ADVISOR_TOOL === "1") process.exit(0);

if (settle(ev.transcript_path ?? "", advisedThisTurn)) process.exit(0);

deny(
  `Hold — ${target ? `\`${basename(target)}\`` : "this command"} writes, and advisor() has not run `
    + "this turn.\n\nIt reads the conversation, sees the approach before it hardens, and costs "
    + "nothing; found after the work, the same point costs the work.\n\n"
    + "Do this: call advisor(), then re-send. Every write in this turn is refused until that call "
    + "reaches the transcript, so if you just made it, send again.",
);
