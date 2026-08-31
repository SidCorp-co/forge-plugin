#!/usr/bin/env node
// A second opinion that follows no first opinion is just another first opinion. docs/HOOKS.md.

import { repoRoot } from "../src/codex.mjs";
import { lastConsultAt } from "../src/codex-log.mjs";
import {
  EXECUTES_STDIN,
  askedAlready,
  block,
  deny,
  readEvent,
  settle,
  unspentAdvice,
} from "./_hook.mjs";

/* Command position, as bash-guard reads it: the data is removed, then what is left is read as
   tokens. An allowlist of wrappers was tried first and missed four shapes. docs/HOOKS.md. */
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

const spentAt = lastConsultAt(repoRoot(ev.cwd ?? process.cwd()));
if (!settle(ev.transcript_path ?? "", (records) => unspentAdvice(records, spentAt))) {
  deny(
    "Consult the built-in advisor before codex, not after.\n\n"
      + "It reads this conversation and costs nothing; codex reads the files and has never seen any "
      + "of it. Backwards, the expensive reviewer pays to rediscover what the free one would say.\n\n"
      + "Do this: call advisor(), act on it, then re-run this command with its points in the intent. "
      + "Advice holds until a consult spends it, so a re-run needs no second call.",
  );
}

// Its reply is encrypted and unreadable once the turn moves on, so the intent is the only place its
// content can survive to reach codex. Asked once: this is a judgement, not a fact.
if (!/advisor/i.test(String(ev.tool_input.command)) && !askedAlready(ev, "codex-intent", "codex-order")) {
  block(
    "The advisor has spoken and this intent does not mention it.\n\n"
      + "Its reply is encrypted and unreadable once the turn moves on, so the intent is the only place "
      + "its content survives — without it, agreement looks independent when it is duplication.\n\n"
      + "Do this: add what it said and what you did about it, then re-run. Asked once per session.",
  );
}
