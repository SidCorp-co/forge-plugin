#!/usr/bin/env node
// A second opinion that follows no first opinion is just another first opinion. why/codex-order.md.

import { repoRoot } from "../src/codex.mjs";
import { lastConsultAt } from "../src/codex-log.mjs";
import {
  EXECUTES_STDIN,
  askedAlready,
  block,
  deny,
  readEvent,
  transcript,
  unspentAdvice,
  why,
} from "./_hook.mjs";

/* Command position, as bash-guard reads it: the data is removed, then what is left is read as
   tokens. An allowlist of wrappers was tried first and missed four shapes. why/codex-order.md. */
const HEREDOC = /(^|\s)<<-?\s*(['"]?)(\w+)\2[^\n]*\n[\s\S]*?^\3$/gm;
const QUOTED = /'[^']*'|"(?:[^"\\]|\\.)*"/g;
const TOKENS = /[\s();&|<>"',]+/;
const RUNNER = /(?:^|\/)(?:forge|cli\.mjs)$/;

const invoked = (text) => {
  const tokens = text.split(TOKENS);
  return tokens.some(
    (token, at) => token === "codex" && tokens[at + 1] === "consult" && RUNNER.test(tokens[at - 1] ?? ""),
  );
};

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

const records = transcript(ev.transcript_path ?? "");
if (!records) process.exit(0);

if (!unspentAdvice(records, lastConsultAt(repoRoot(ev.cwd ?? process.cwd())))) {
  deny(
    "Consult the built-in advisor before codex, not after.\n\n"
      + "Do this: call advisor(), act on it, then re-run this command with its points in the intent. "
      + "A re-run is what clears this, not a second advisor call."
      + why(),
  );
}

// Its reply is encrypted and unreadable once the turn moves on, so the intent is the only place its
// content can survive to reach codex. Asked once: this is a judgement, not a fact.
if (!/advisor/i.test(String(ev.tool_input.command)) && !askedAlready(ev, "codex-intent", "codex-order")) {
  block(
    "The advisor has spoken and this intent does not mention it.\n\n"
      + "Do this: add what it said and what you did about it, then re-run. Asked once per session."
      + why(),
  );
}
