// What the advisor said reaches codex only through the intent: its reply is unreadable once the turn
// moves on, and codex has seen none of the conversation. how/codex-order.md.

import {
  EXECUTES_STDIN,
  QUOTED,
  SPAWNS,
  advisedThisTurn,
  askedAlready,
  invocations,
  block,
  turnRecords,
  how, done } from "../_hook.mjs";

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

/* A program's literal is data unless it can reach a shell: a test asserting on the phrase lost an edit. */
const programs = (command) =>
  [...command.matchAll(HEREDOC)]
    .filter((m) => EXECUTES_STDIN.test(command.slice(command.lastIndexOf("\n", m.index) + 1, m.index)))
    .map((m) => m[0])
    .filter((body) => SPAWNS.test(body));

const consults = (command) => {
  const text = String(command);
  return [text.replace(HEREDOC, " ").replace(QUOTED, " "), ...programs(text)].some(invoked);
};

export const run = (ev) => {
  if (
    ev.tool_name !== "Bash"
    || !consults(ev.tool_input?.command)
    || process.env.FORGE_CODEX_DISABLE === "1"
    || process.env.CLAUDE_CODE_DISABLE_ADVISOR_TOOL === "1"
  ) {
    done();
  }

  /* Nothing to carry: a consult with no advisor before it is a consult, and is asked nothing. */
  const records = turnRecords(ev.transcript_path ?? "");
  if (!records || !advisedThisTurn(records)) done();

  if (!/advisor/i.test(String(ev.tool_input.command)) && !askedAlready(ev, "codex-intent", "codex-order")) {
    block(
      "The advisor has spoken and this intent does not mention it.\n\n"
        + "Do this: add what it said and what you did about it, then re-run. Asked once per session."
        + how(),
    );
  }
};
