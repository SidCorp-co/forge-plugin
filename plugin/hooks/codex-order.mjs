#!/usr/bin/env node
// A second opinion that follows no first opinion is just another first opinion. how/codex-order.md.

import { repoRoot } from "../src/codex.mjs";
import { lastConsultAt } from "../src/codex-log.mjs";
import {
  EXECUTES_STDIN,
  QUOTED,
  advisedThisTurn,
  askedAlready,
  invocations,
  block,
  deny,
  readEvent,
  transcript,
  turnRecords,
  unspentAdvice,
  how,
} from "./_hook.mjs";

/* Command position: the data goes, the rest is read as tokens — an allowlist missed four shapes. */
const HEREDOC = /(^|\s)<<-?\s*(['"]?)(\w+)\2[^\n]*\n[\s\S]*?^\3$/gm;
const TOKENS = /[\s();&|<>"',]+/;
const RUNNER = /(?:^|\/)(?:forge|cli\.mjs)$/;

/* Asking what to type is not a consult. The CLI reads a help flag anywhere in the action, so this
   asks which invocation the flag belongs to: a redirect may precede it, and `| grep -h` is grep's. */
const invoked = (text) =>
  invocations(text).some((one) => {
    const tokens = one.split(TOKENS);
    return (
      tokens.some(
        (token, at) =>
          token === "codex" && tokens[at + 1] === "consult" && RUNNER.test(tokens[at - 1] ?? ""),
      )
      && !tokens.some((flag) => flag === "-h" || flag === "--help")
    );
  });

/* A program's own commands live inside quotes, so a body an interpreter executes is read with the
   quotes left in — where stripping them is what keeps a commit message from being denied. */
const programs = (command) =>
  [...command.matchAll(HEREDOC)]
    .filter((m) => EXECUTES_STDIN.test(command.slice(command.lastIndexOf("\n", m.index) + 1, m.index)))
    .map((m) => m[0]);

const consults = (command) => {
  const text = String(command);
  return [text.replace(HEREDOC, " ").replace(QUOTED, " "), ...programs(text)].some(invoked);
};

const ev = readEvent();
if (
  ev.tool_name !== "Bash"
  || !consults(ev.tool_input?.command)
  || process.env.FORGE_CODEX_DISABLE === "1"
  // An order nobody can satisfy is not an order but a wall, so: advisor off, gate off.
  || process.env.CLAUDE_CODE_DISABLE_ADVISOR_TOOL === "1"
) {
  process.exit(0);
}

const records = turnRecords(ev.transcript_path ?? "");
if (!records) process.exit(0);

/* Either is enough — this turn's advice, or advice no consult spent: a turn holds two consults when
   the commit gate asks, and typing mid-task ends the turn. The whole-file read precedes a refusal. */
if (!advisedThisTurn(records)) {
  const spentAt = lastConsultAt(repoRoot(ev.cwd ?? process.cwd()));
  if (!unspentAdvice(transcript(ev.transcript_path ?? "") ?? [], spentAt)) {
    deny(
      "Consult the built-in advisor before codex, not after.\n\n"
        + "Do this: call advisor(), act on it, then re-run this command with its points in the intent. "
        + "A re-run is what clears this; its record reaches the transcript a few seconds late, so a "
        + "consult sent in the same breath is refused for advice that has arrived."
        + how(),
    );
  }
}

// Its reply is unreadable once the turn moves on, so the intent is the only place it survives.
if (!/advisor/i.test(String(ev.tool_input.command)) && !askedAlready(ev, "codex-intent", "codex-order")) {
  block(
    "The advisor has spoken and this intent does not mention it.\n\n"
      + "Do this: add what it said and what you did about it, then re-run. Asked once per session."
      + how(),
  );
}
