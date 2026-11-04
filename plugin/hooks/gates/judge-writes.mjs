// Refuse, in a qa judge session alone, the forge/forge-runner calls that write a tracker record
// other than the judge's own verdicts and report, or this machine's local config: a judgement makes
// no probe data and moves no status it has not earned. how/judge-writes.md says why and names the out.

import { readFileSync } from "node:fs";

import { bodiless, deny, done, how, note, noted, ownTranscript, startsAt, unquote, unwrapped, wordsIn } from "../_hook.mjs";
import { isJudgeBrief } from "../../src/brief/judge.mjs";
import { HELP_WORDS } from "../../src/resolve/help-word.mjs";

/* The first record of a subagent's own transcript is its brief, a `user` record whose content is the
   prompt. Read from the head, since it stands at the front however long the run has since grown. */
const HEAD = 1 << 18;
const contentText = (record) => {
  const held = record?.message?.content;
  if (typeof held === "string") return held;
  if (Array.isArray(held)) return held.filter((one) => one?.type === "text").map((one) => String(one.text ?? "")).join("\n");
  return "";
};
const firstPrompt = (path) => {
  if (!path) return "";
  let text = "";
  try {
    text = readFileSync(path, { encoding: "utf8" }).slice(0, HEAD);
  } catch {
    return "";
  }
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line);
      if (record?.type === "user") return contentText(record);
    } catch {
      return "";
    }
  }
  return "";
};

/* A judge session is a subagent whose brief is a judge's, read once and kept: the event names the run
   in `agent_id`, so the memo keys on it and a sibling builder under the same wave is judged apart. The
   master's own calls carry no `agent_id`, so the gate does nothing there. */
const MEMO = "judge-session";
const judgeSession = (ev) => {
  if (!ev.agent_id) return false;
  const kind = `${MEMO}:${ev.agent_id}`;
  const seen = noted(ev, kind);
  if (seen === "y") return true;
  if (seen === "n") return false;
  const yes = isJudgeBrief(firstPrompt(ownTranscript(ev)));
  note(ev, kind, yes ? "y" : "n");
  return yes;
};

/* Tokens of one invocation, quotes off: the readings `startsAt` hands back start at the verb, a leading
   assignment or wrapper already behind them. */
const tokensOf = (said) => wordsIn(said).map((one) => unquote(one));
const base = (token) => String(token).replace(/.*\//u, "");
const flagName = (token) => token.split("=")[0];
const firstWord = (rest) => rest.find((one) => !one.startsWith("-"));

/* `forge doctor` reads with these and writes with every other flag: a read-list, so a config-write
   flag added later is refused without a line changing here (G-13). */
const DOCTOR_READS = new Set(["--full", "--credentials", ...HELP_WORDS]);
const ADVANCE_MOVES = new Set(["--set", "--park", "--drop"]);
const METHOD = /^(?:POST|PUT|PATCH|DELETE)$/iu;

/* Which rule one `forge` invocation breaks, or null where it writes nothing a judge may not. */
const forgeBreaks = (rest) => {
  const sub = firstWord(rest);
  if (sub === undefined) return null;
  if (sub === "new") return "new";
  if (sub === "claim") return "claim";
  if (sub === "doctor") return rest.some((one) => one.startsWith("-") && !DOCTOR_READS.has(flagName(one))) ? "config" : null;
  if (sub === "advance") return rest.some((one) => ADVANCE_MOVES.has(flagName(one))) ? "advance" : null;
  if (sub === "record") {
    const kind = rest[rest.indexOf("record") + 1];
    if (!kind || kind.startsWith("-")) return null;
    return kind === "verdict" ? null : "record";
  }
  return null;
};

/* A requirement-aimed judge's verdicts go to core's requirement verdicts route (ISS-588); there is no
   verb for them as `forge record verdict` is the issue's, so the raw POST is the judge's own verdict
   write and allowed, exactly as the verb is — a bare `requirements` POST is not (FB-53, ISS-57). */
const REQUIREMENT_VERDICTS = /(?:^|\/)requirements\/[^/]+\/verdicts\/?$/u;

/* The first positional after `api` is the path; a value-taking flag's own value never precedes it, so
   the first token with no leading dash is it. */
const apiPath = (rest) => rest.slice(rest.indexOf("api") + 1).find((one) => !one.startsWith("-")) ?? null;

/* `forge-runner api <path>` with a mutating method, written curl's way: `-X POST`, `-XPOST`, or
   `--request POST`. A bare GET names no method and writes nothing. */
const runnerBreaks = (rest) => {
  if (firstWord(rest) !== "api") return null;
  let mutates = false;
  for (let at = 0; at < rest.length && !mutates; at += 1) {
    const token = rest[at];
    if (/^-X(?:POST|PUT|PATCH|DELETE)$/iu.test(token)) mutates = true;
    const name = flagName(token);
    if (name === "-X" || name === "--request") {
      const value = token.includes("=") ? token.split("=")[1] : rest[at + 1];
      if (value && METHOD.test(value)) mutates = true;
    }
  }
  if (!mutates) return null;
  const path = apiPath(rest);
  if (path && REQUIREMENT_VERDICTS.test(path)) return null;
  return "api";
};

const breaksFor = (said) => {
  const tokens = tokensOf(said);
  if (!tokens.length) return null;
  const verb = base(tokens[0]);
  if (verb === "forge") return forgeBreaks(tokens.slice(1));
  if (verb === "forge-runner") return runnerBreaks(tokens.slice(1));
  return null;
};

/* What each refusal says it broke, in the two words a judge reads it by: a record that is the holder's,
   or a local config write. */
const BROKE = {
  config: "it writes this machine's own local configuration, which a judgement never changes",
  new: "it creates a tracker record (a new issue), which is the holder's and not a verdict",
  record: "it writes a tracker record other than a verdict, which belongs to the run that owns the change",
  advance: "it moves the issue's status, which the verdicts earn and the holder applies",
  claim: "it claims a lease, which a judge does not hold",
  api: "it is a raw tracker or configuration write",
};

const ROUTE = "Record this criterion `skipped` with `--why` naming what would settle it, and leave every "
  + "other record and status move for the run that owns the change, which gets it through your report.";
const STANDS = "A qa judge writes only its verdicts (`forge record verdict`) and its report comment "
  + "(`forge comment`).";

export const run = (ev) => {
  if (ev.tool_name !== "Bash") done();
  if (!judgeSession(ev)) done();
  const drop = () => "";
  const text = unwrapped(bodiless(String((ev.tool_input ?? {}).command ?? ""), drop), drop);
  for (const { said } of startsAt(text)) {
    const cause = breaksFor(said);
    if (cause) deny(`Refused — ${ROUTE}\n\n${STANDS} Here ${BROKE[cause]}.${how("judge-writes")}`);
  }
  done();
};
