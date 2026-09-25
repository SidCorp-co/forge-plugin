/* `forge codex` — a second opinion from GPT-5 Codex over the gateway's own API, on the files this
   turn changed. docs/cli/codex-the-consult.md.

   Four pieces: the call and what it may read (codex-api.mjs), the log that is both its memory and its
   eval set (codex-log.mjs), the turn's bookkeeping (codex-state.mjs), and this — the verb and the
   hook halves. */
export { afterTouch, ageOf, apartFrom, demandIn, holding, pendingIn, pendingNow, pendingState, stagedIn, statePath }
  from "./codex-state.mjs";
export { reviewed, rounds } from "./codex-rounds.mjs";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { dirname, isAbsolute, resolve } from "node:path";

import { HUMAN_REF } from "../tracker/issues.mjs";
import { repoRoot } from "../git/repo-root.mjs";
import { configPath, userConfig } from "../resolve/config.mjs";
import { INTENT_MS, stdinText } from "../resolve/payload.mjs";
import { budgetMs, codexCheck, fail, projectRecordPattern } from "../resolve/settings.mjs";
import { flags, helpAskedOf, partition, pullRepeated } from "../resolve/flags.mjs";
import { didYouMean } from "../suggest.mjs";
import { PENDING_USAGE, afterTouch, ageOf, clearConsulted, clearableOf, heldSaid, pending, pendingIn,
  readByCodex, readState, stagedApart, stagedReader, turnsOf, updateState } from "./codex-state.mjs";
import { PER_KEY, READ_ISSUE, READ_SPEC, SPARE, TOOLS, checkCommand, checkRow, checkState, scopeFor, specFor } from "./codex-tools.mjs";
import { noDiffIn, reviewSet, shownOf } from "./codex-set.mjs";
import { COMPLEXITY_USAGE, complexity } from "./complexity/complexity.mjs";
import { reviewed } from "./codex-rounds.mjs";
import { anglesInEffect, anglesShown } from "./angles.mjs";
import { EFFORTS, chosenSend, defaultEffort, disagreement, effortVia, incompleteIn, keepsTools,
  modeFor, newFindingsIn, plannedFor, plannedLimits, rungFor, rungLadder } from "./codex-plan.mjs";
import {
  ANGLES,
  askApi,
  bundle,
  cannotCarry,
  divergedFrom,
  inside,
  promptMark,
  withDiffs,
  openingFor, goalsFor,
  roleFor,
  sameFamily,
} from "./codex-api.mjs";
import { gateway, modelBehind, modelSlot } from "../resolve/machine/stores.mjs";
import { masked } from "../tools/services/masked.mjs";
import { EVAL_USAGE, MARKS_USAGE, REPLAY_USAGE, STATS_USAGE, crossingSaid, printEval, printMarks,
  printReplay, printStats } from "./codex-stats.mjs";
import {
  logPath,
  consults,
  hereOf,
  logBytes,
  logConsult,
  logEntries,
  loggedWithMark,
  sentFrom,
  verdictsBy,
} from "./codex-log.mjs";
import {
  numbered,
  historyFor,
  recheckMissed,
  recheckOwed,
  recheckPlan,
  rulingsUnread,
  recheckRange,
  verdictFromRulings,
} from "./log/replies.mjs";
import { LOG_USAGE, VERDICT_USAGE, printLog, verdict } from "./log/verbs.mjs";

const DEFAULT_PATH_RE = "^docs/.*\\.md$";

export const USAGE = [
  "Usage: forge codex <consult|verdict|pending|show|log|stats|eval|marks|replay|complexity> [args]",
  "A second model reviews what this turn changed, streamed over the gateway's own API. The files you",
  "name travel with the prompt; beyond them it reads for itself, over this checkout and any other",
  "you name a file in. Each action's own flags: `forge codex <action> -h`.",
  "",
  "  consult   review the files you name, or what this turn touched; intent on stdin",
  "  verdict   what became of each finding, which is the half of an eval set only you hold",
  "  pending   what this turn touched and has not been consulted on",
  "  show      what is in effect here — model, records, rounds, effort, angles — and from where",
  "  log       past consults, one line each or one whole",
  "  stats     the figures of a window's consults, as one group or --by model or prompt",
  "  eval      stats over two windows: the last 100 answered consults against the 100 before them",
  "  marks     the consult readings `codex eval --against` takes, held on this device, newest first",
  "  replay    which of a window a candidate prompt could be scored against",
  "  complexity  one typed question per issue — which of the five its body claims — proposed, never written; --measure scores it against run minutes",
  "",
  "Every key of the `codex` object is optional and `forge codex show` prints what each resolved to",
  "and from where; `forge doctor` names the files. FORGE_CODEX_DISABLE=1 is the one variable: a",
  "kill switch has to work when the config is what is broken.",
].join("\n");

const CONSULT_USAGE = [
  "Usage: forge codex consult [file|ISS-nn...] [--diff [--base <ref>]] [--send m] [--only s,s]",
  "                           [--verify <risk>]... [--recheck] [--angles a,a] [--effort e]",
  "                           [--rounds n] [--out-of-scope <text>] [--checks <text>] [--allow-echo]",
  "The files you name, or what this turn touched; pipe your intent on stdin.",
  "",
  "  ISS-nn         an issue this consult is about, read off the tracker by the reviewer itself, so",
  "                 nothing of it is copied into the intent. Keys alone review no file",
  "",
  "  --diff         send each file's diff and refuse findings about code this turn did not touch",
  "  --base <ref>   what to diff against; implies --diff. HEAD unless you say otherwise",
  "  --send m       diffs (default) sends each change, bodies sends every file whole; a set holding a",
  "                 path outside this checkout sends bodies unless you name a mode, since a plan or",
  "                 criteria write asks for that path's text. bodies over the whole set earns an",
  "                 approving review, and one too large is refused with the passes",
  "  --only s,s     report only these severities: blocker, major, minor",
  "  --verify <risk>  a named risk to rule on rather than an open review; repeatable",
  "  --recheck      verify the last consult's findings on these files instead of roaming for new ones",
  "  --angles a,a   which angles review this consult: tech, ba, user, ux, debt; tech,debt by default",
  "  --effort e     minimal | low | medium | high, for this consult only",
  "  --rounds n     model calls this consult may make, used as given; wall time is calls times 45s",
  "  --out-of-scope <text>  what the issue put out of scope, in the issue's own words",
  "  --checks <text>  the checks this project runs before the change lands",
  "  --allow-echo   review by a model of this one's own family, which is refused without it",
  "",
  "What a round buys and what a recheck may not do: docs/cli/codex-the-round.md.",
].join("\n");

const SHOW_USAGE = [
  "Usage: forge codex show",
  "Profile, model, records, rounds, effort, angles, check, pending and log, in effect here.",
].join("\n");

/* A pattern that does not compile is worse than no pattern: the gate would throw on every write of
   whatever repository carries it. It is skipped for the next source, and `show` names what resolved. */
/** Compiled the way `recordPattern` below will compile it, and nowhere else's flags: exported so a
 *  write of `codex.pathRe` refuses exactly the patterns this reader would pass over. */
export const compiles = (source) => {
  try {
    new RegExp(source);
    return true;
  } catch {
    return false;
  }
};

const recordPattern = () => {
  const asked = [projectRecordPattern(), { value: userConfig().codex?.pathRe, from: configPath() }];
  const held = asked.find((one) => one.value && compiles(one.value));
  return held ?? { value: DEFAULT_PATH_RE, from: "the built-in default" };
};

export const recordable = (rel) => new RegExp(recordPattern().value).test(rel);

/* A `missing` part with a diff is a deletion, and a change: every `missing` read as unchanged sent a deletion-only review no diffs at all (ISS-703). */
export const unchangedAll = (parts) => parts.length > 0
  && parts.every((part) => part.diff?.unchanged || (part.missing && noDiffIn(part.diff)));

/* A head logged days ago may be gone: a worktree branch deleted, a rebase, another checkout. An
   unreadable one is not an error — the recheck simply carries no diff. */
const readableRef = (root, ref) =>
  spawnSync("git", ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], { cwd: root, encoding: "utf8" }).status === 0;

/* An entry that cannot be tied to code cannot be checked, so an eval over the log needs the commit. */
const commitAt = (root) => {
  const head = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" });
  if (head.status !== 0) return {};
  const changed = spawnSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" });
  return { head: (head.stdout ?? "").trim(), dirty: Boolean((changed.stdout ?? "").trim()) };
};

const BOOLEAN = ["--allow-echo", "--diff", "--recheck"];
const SEVERITIES = ["blocker", "major", "minor"];

const severities = (raw) => {
  if (raw === undefined) return [];
  const asked = raw.split(",").map((one) => one.trim().toLowerCase()).filter(Boolean);
  for (const one of asked) if (!SEVERITIES.includes(one)) fail(didYouMean("severity", one, SEVERITIES));
  return asked;
};

/* Refused rather than defaulted: a caller who typed `--rounds two` asked for something, and a
   consult that silently ran at three would bill them for an answer to a question they did not ask. */
const askedRounds = (raw) => {
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) fail(`codex: --rounds takes an integer of 1 or more, not \`${raw}\`.`);
  return value;
};

/* Repeated `--verify`, then positionals apart from flag values, then the rest — three passes because a flag can carry a value and a file cannot. */
export const consultArgs = (given) => {
  if (given.includes("--bg")) fail("codex: --bg is gone; a consult runs inline, like the advisor.");
  const usage = CONSULT_USAGE;
  const { values: risks, rest: without } = pullRepeated(given, "--verify", "codex consult", { usage });
  const { positionals, flagArgv } = partition(without, BOOLEAN, { verb: "codex consult", usage });
  /* Refused at the parse, not at the read: `-` is every other verb's stdin spelling, and this verb's stdin is its intent rather than a file, so the file reader's answer names the wrong thing. */
  if (positionals.includes("-")) {
    fail("codex: consult takes file paths and `-` is not one — its intent is read from standard "
      + 'input. Pipe it: echo "<what you were doing>" | forge codex consult <file>...');
  }
  const held = flags(flagArgv, "codex consult", BOOLEAN, { usage });
  /* Split here, where the positionals are read: `relsOf` exits on a path neither the tree nor HEAD holds. */
  const keys = positionals.filter((one) => HUMAN_REF.test(one));
  return {
    named: positionals.filter((one) => !keys.includes(one)),
    issues: [...new Set(keys.map((one) => one.toUpperCase()))],
    risks,
    only: severities(held.only),
    allowEcho: Boolean(held["allow-echo"]),
    /* Asking what to diff against is asking for the diff, so `--base` implies `--diff` rather than being silently dropped — one fewer rule to learn and one fewer way to be ignored. Kept apart from `named` because HEAD from `--diff` is this end's guess and a recheck may still improve on it, where a base the caller typed is theirs and is never moved. */
    base: held.base ?? (held.diff ? "HEAD" : null),
    namedBase: held.base ?? null,
    effort: chosenEffort(held.effort),
    cap: askedRounds(held.rounds),
    /* The mode named and not the mode resolved, the set that decides the default being settled well after the flags are. */
    send: chosenSend(held.send),
    recheck: Boolean(held.recheck),
    angles: chosenAngles(held.angles),
    /* The issue's own sentence and the checkout's own command: a scope this end composes moves the boundary the reviewer is judged against. */
    scope: held["out-of-scope"] ?? "",
    checks: held.checks ?? codexCheck()?.command ?? "",
  };
};

/* Said where the round's own cost is said, because otherwise a run learns it by reading the reply for an absence, after it has acted on the review. It judges nothing: declining is what the offer's condition asks for, and the defect was the silence (ISS-1898). docs/cli/codex-the-check.md. */
const CHECK_SAID = {
  ran: (command) => `check ran — \`${command}\`.`,
  cut: (command) => `check cut — \`${command}\` was stopped at its clock, so none of it reached this review.`,
  failed: (command) => `check failed — \`${command}\` gave no answer to reach this review.`,
  declined: (command) => `check declined — \`${command}\` was offered and not run: this review is inspection, not execution.`,
};

const checkSaid = (reach) => {
  const state = checkState(reach);
  return state === "none" ? null : `codex: ${CHECK_SAID[state](checkCommand(reach))}`;
};

/* Everything the run is told once the round is done, in one place: this list is what a run reads to decide whether the review answered, and the check's own word sits in it rather than two thirds of the way down a reply. */
const toldAfter = (held, reach, { left, since, crossing }) => {
  const kinds = held.tools.reduce((seen, one) => ({ ...seen, [one.name]: (seen[one.name] ?? 0) + 1 }), {});
  const spent = Object.entries(kinds).map(([name, n]) => `${name} ${n}`).join(", ");
  if (spent) console.error(`codex: ${held.calls} call(s), tools it ran: ${spent}.`);
  if (checkSaid(reach)) console.error(checkSaid(reach));
  if (held.refused.length) console.error(`codex: refused ${held.refused.length} tool call(s): ${held.refused.join("; ")}.`);
  if (left.length) console.error(`codex: ${left.length} file(s) still pending, recorded ${ageOf(since)}: ${left.join(", ")}.`);
  if (held.stop === "max_tokens") console.error("codex: the reply hit `codex.maxTokens`.");
  if (crossing) console.error(crossingSaid(crossing));
};

/* Read where `show` reads it, and a name not on the list is refused rather than sent, because a role
   the prompt never described would be reviewed by nobody. */
const chosenAngles = (raw) => {
  const { angles } = anglesInEffect(raw);
  for (const one of angles) if (!ANGLES[one]) fail(didYouMean("angle", one, Object.keys(ANGLES)));
  return angles;
};


/* Named rather than clamped: an unknown value would otherwise be sent to the gateway, which accepts
   anything and reports nothing, so the consult would run at a level nobody chose. */
const chosenEffort = (raw) => {
  if (raw === undefined) return undefined;
  if (!EFFORTS.includes(raw)) fail(`codex: --effort takes ${EFFORTS.join(" | ")}, not \`${raw}\`.`);
  return raw;
};

/* The premise is a decorrelated reviewer, so an echo is refused rather than warned about: a warning
   on stderr is read after the tokens are spent. */
const modelFor = (values, path, allowEcho, effort) => {
  const model = rungFor(effort, modelBehind(values));
  if (!model) {
    fail(`codex: no \`codex.rungs.${effort}\` and no ${modelSlot()} slot in ${path} names a model to `
      + "review with. Add a `codex.rungs` entry for that level, or map the slot in the profile.");
  }
  if (sameFamily(model) && !allowEcho) {
    fail(`codex: the ${effort} rung resolves to ${model}, this model's own family — that echoes rather `
      + "than reviews. Point `codex.rungs` or `codex.model` at another family, or pass --allow-echo.");
  }
  return model;
};

/* `${namedBase}~1` is no escape from a base that moved: one commit back is on the other side, so it
   parts from the branch at the same point. The head is the ref that answers there. */
const unmovedSaid = (root, rels, namedBase, parted) => {
  const where = commitAt(root).dirty ? "the files named" : "the tree is clean, so the change is committed";
  const back = parted ? "HEAD~1" : `${namedBase}~1`;
  return `codex: nothing differs from ${namedBase}${parted ? ` since they parted at ${parted.slice(0, 7)}` : ""}`
    + ` in ${rels.join(", ")} — ${where}. Pass --base ${back} to review the last commit.`;
};

/* The model and the channel beside the count, because which of the two carried the level is the one
   thing a reader cannot infer from the level itself. */
const plannedSaid = ({ model, effort, kind, budget, ceiling, lines, clipped }) =>
  `codex: ${budget} call(s) to ${model} at ${effort} effort, on the ${effortVia(model)}, `
  + `for a ${kind} of ${lines} changed line(s)`
  + `${clipped.length ? `, ${clipped.length} of them clipped` : ""}`
  + `${budget < ceiling ? `, up to ${ceiling} if the review comes back incomplete` : ""}.`;

const ruledSaid = (plan, offset, reply, id, entries) => {
  const prior = verdictsBy(entries).get(plan.judged.id ?? plan.judged.at) ?? null;
  const auto = verdictFromRulings(plan, offset, reply, id, prior);
  if (!auto) return rulingsUnread(plan, offset, reply, id);
  logConsult(auto.record);
  return auto.said;
};

const consult = async (given) => {
  const { named, issues, risks, only, allowEcho, base, namedBase, effort: askedEffort, cap, send, recheck, angles, scope, checks } = consultArgs(given);
  const { problem, values, path } = gateway();
  if (problem) fail(`codex: the consult has no gateway to be sent to — ${problem}.`);
  const root = repoRoot(process.cwd());
  if (!root) fail("codex: not in a git repository, so there is nothing to review against.");
  const set = reviewSet({ root, named, keys: issues, base, namedBase, recheck, pattern: recordPattern().value, held: pendingIn(readState(), root) });
  const { offered, gone } = set;
  let rels = set.rels;
  for (const line of set.said) console.error(`codex: ${line}`);
  /* Cleared here rather than after the answer: a path with nothing under it can never be consulted
     on, so leaving it would offer the next consult the same phantom (ISS-703). */
  if (gone.length) clearConsulted(root, gone);
  if (!rels.length && !issues.length) fail(`codex: nothing to consult on. Name a file, an issue key, or write a file first.${base ? ` Nothing differs from ${base} either.` : ""}`);
  const entries = logEntries();
  const plan = recheck ? recheckPlan(entries, root, rels) : null;
  const offset = risks.length;
  if (recheck) {
    /* Asked before the narrowing and against the set the caller stood on: a route out has to name
       files they can act on, and a path they typed is their range and is never narrowed (ISS-272). */
    const nothing = recheckOwed(plan, rels);
    if (nothing) fail(`codex: ${nothing}`);
    /* The set holds some of that consult's findings and not others: this round answers only part. */
    const missed = recheckMissed(plan);
    if (missed) for (const line of missed.split("\n")) console.error(`codex: ${line}`);
    risks.push(...plan.risks);
    const range = named.length ? null : recheckRange(plan, rels);
    if (range) {
      console.error(`codex: a recheck of ${plan.judged.id ?? plan.judged.at}, so its ${range.length} recorded`
        + ` file(s) travel, not the ${offered(rels.length)}.`);
      rels = range;
    }
  }
  /* The diff since the head the findings were made against: re-sending the whole file makes the
     reviewer find the change before it can rule on the fix. Only where that head is a readable ref. */
  const anchor = recheck && !namedBase && plan.judged.head && readableRef(root, plan.judged.head)
    ? plan.judged.head
    : base;
  if (anchor !== base) console.error(`codex: a recheck of ${plan.judged.id ?? plan.judged.at}, so the diff since ${anchor} travels with it.`);
  /* A base the caller named is read from where the branch left it, so a ref that moved under the run
     presents nothing of its own side; a recheck's anchor is a head this run chose and is taken as
     given. `parted` is null where the ref is still behind HEAD, which is the same diff either way. */
  const fromParting = anchor !== null && anchor === namedBase;
  const parted = fromParting ? divergedFrom(root, anchor) : null;
  if (parted) console.error(`codex: ${anchor} has moved under this branch, so the diff is from ${parted.slice(0, 7)}, where they parted.`);

  /* Bundled before the count is printed, because a path with nothing under it is not a file to
     review: it travelled as a NEW FILE heading with no lines and was logged as reviewed (ISS-703). */
  const showing = shownOf(root,
    anchor ? withDiffs(root, bundle(root, rels), anchor, fromParting) : bundle(root, rels), anchor);
  const { parts: bundled, empty } = showing;
  for (const line of showing.said) console.error(`codex: ${line}`);
  if (empty.length) {
    rels = rels.filter((rel) => !empty.includes(rel));
    clearConsulted(root, empty);
  }
  if (!rels.length && !issues.length) fail("codex: nothing to consult on: every path it was offered is absent from the tree.");
  /* Here and no earlier: this is the first line at which `rels` is the set that will travel. */
  const { bodies, said: mode } = modeFor(send, rels);
  if (mode) console.error(mode);
  const short = bodies && cannotCarry(bundled.filter((part) => rels.includes(part.rel)));
  if (short) fail(`codex: ${short}`);
  /* A review of nothing is still billed: after a commit every file reads UNCHANGED against HEAD. A
     recheck is the one case that carries on: its base was chosen for it, so an unmoved tree means
     nothing to diff and not nothing to ask, and the findings are still owed a ruling. */
  const still = anchor && unchangedAll(bundled);
  if (still && anchor === namedBase) fail(unmovedSaid(root, rels, namedBase, parted));
  if (still) console.error(`codex: nothing differs from ${anchor}, so this recheck carries no diff — the findings are asked for on the tree as it stands.`);
  const parts = still ? bundle(root, rels) : bundled;
  /* The point diffed from, not the ref: a row anchored to a name replays against wherever that name
     has since gone, which is a diff nobody was ever shown (`codex replay`, codex-stats.mjs). */
  const reached = parted ?? anchor;
  const anchoredTo = still ? null : reached;
  /* The whole plan before the intent is read, none of it needing one: it settles the model this
     consult will be sent to, so a rung that resolves nothing refuses here rather than after the wait. */
  const { clipped, lines, budget, ceiling, effort, kind } = plannedFor({ parts, bodies, recheck, risks: risks.length, asked: cap, effort: askedEffort });
  const model = modelFor(values, path, allowEcho, effort);
  if (clipped.length) console.error(`codex: sent clipped, too long to fit whole: ${clipped.join(", ")}.`);
  console.error(plannedSaid({ model, effort, kind, budget, ceiling, lines, clipped }));
  /* Said before the read, so a stall says where it is, and the read waits on the first byte alone:
     an open stdin with nothing on it was read to EOF and never returned (ISS-65). */
  console.error(`codex: ${rels.length} file(s) to review`
    + `${issues.length ? `, ${issues.join(", ")} for the reviewer to read off the tracker` : ""}`
    + `, sending ${bodies ? "bodies" : "diffs"}; reading the intent from stdin.`);
  const said = await stdinText();
  if (said === null) console.error(`codex: nothing on stdin inside ${INTENT_MS}ms, so the consult carries no intent.`);
  const intent = (said ?? "").trim();
  const id = randomBytes(3).toString("hex");
  const history = historyFor(entries, root, undefined, rels);
  const spec = await specFor(root);
  const system = roleFor(angles, { check: Boolean(codexCheck()), recheck, tracker: issues.length > 0, spec: Boolean(spec) });
  const started = Date.now();
  const record = {
    id,
    at: new Date().toISOString(),
    root,
    repo: hereOf(root).repo,
    slot: modelSlot(),
    model,
    files: rels,
    sent: sentFrom(parts),
    intent,
    history: history.length,
    effort,
    effortVia: effortVia(model),
    consultKind: kind,
    angles,
    ceiling,
    lines,
    send: bodies ? "bodies" : "diffs",
    prompt: promptMark(system),
    ...(cap === undefined ? {} : { cap }),
    ...(issues.length ? { issues } : {}),
    ...(recheck ? { recheck: true } : {}),
    ...(anchoredTo ? { anchoredTo } : {}),
    ...(risks.length ? { risks } : {}),
    ...(only.length ? { only } : {}),
    ...commitAt(root),
  };
  /* Written before the call: a consult that dies mid-flight never reaches either handler, and a
     review that vanished is the one an eval most wants to see. The result closes the pair on `id`. */
  logConsult({ ...record, kind: "started", budget });
  let shown = 0;
  const streamed = (text) => {
    shown += text.length;
    process.stdout.write(text);
  };
  /* Hoisted because the round writes the check's outcome onto it and both rows are owed that outcome. `reached` and not `anchoredTo`: a recheck whose tree has not moved sent no diff and so anchors no log row, but the reviewer asking for "the diff" still means the change since that head, and the tree at HEAD would hand it every file this consult is not about. */
  const reach = scopeFor(root, rels.filter(isAbsolute), codexCheck(),
    { anchor: reached, files: rels, issues, spec, by: started + budgetMs() });
  try {
    const opening = openingFor(intent, parts, history, { risks, only, bodies, scope, checks, issues, goals: await goalsFor(angles) });
    const held = await reviewed(
      values, model, opening, reach, streamed, askApi,
      { effort, budget, ceiling, system },
    );
    /* Buffered while a retry was still possible, so the review lands here in one piece. */
    if (!held.streamed) process.stdout.write(held.text);
    process.stdout.write("\n");
    const crossing = loggedWithMark({
      ...record,
      kind: "consult",
      ms: Date.now() - started,
      ok: true,
      usage: held.usage,
      stop: held.stop,
      thought: held.thought,
      tools: held.tools,
      refused: held.refused,
      calls: held.calls,
      /* The attempt that answered, not the one that was planned: a three-call exhaustion followed
         by a one-call retry logged as budget 3 / calls 1 read as a consult that never reached it. */
      budget: held.budget ?? budget,
      ...(held.retriedFrom === undefined ? {} : { retriedFrom: held.retriedFrom }),
      attempt: held.attempt,
      incomplete: incompleteIn(held.text),
      ...checkRow(reach),
      ...(recheck ? { newFindings: newFindingsIn(numbered(held.text, rels)) } : {}),
      reply: held.text,
    });
    const { clear, held: standing } = clearableOf(root, record.sent);
    const { left, since } = clearConsulted(root, clear);
    if (standing.length) console.error(`codex: ${heldSaid(standing)}`);
    if (plan) {
      console.error(`codex: ${ruledSaid(plan, offset, held.text, id, entries)}`);
    }
    toldAfter(held, reach, { left, since, crossing });
  } catch (error) {
    logConsult({ ...record, kind: "consult", budget, ms: Date.now() - started, ok: false, error: error.message, ...checkRow(reach) });
    if (checkSaid(reach)) console.error(checkSaid(reach));
    const partial = shown ? `\n\ncodex: the ${shown} characters above are an incomplete reply and were `
      + "not recorded as a consult." : "";
    fail(`${partial}\ncodex: ${error.message}`);
  }
};

const show = (rest = []) => {
  flags(rest, "codex show", [], { usage: SHOW_USAGE });
  const { problem, values, path, url, key } = gateway();
  const root = repoRoot(process.cwd());
  const waiting = root ? pendingIn(readState(), root) : [];
  const entries = logEntries();
  const base = defaultEffort();
  const ladder = rungLadder();
  const model = rungFor(base, modelBehind(values));
  const said = model && disagreement(base, model);
  console.log(`profile   : ${path}${problem ? `  (${problem})` : ""}`);
  console.log(`endpoint  : ${url.value ? `${url.value}/v1/messages  (streamed)` : "<unresolved>"}`
    + `${url.from ? `  \u2190 ${url.from}` : ""}`);
  console.log(`credential: ${key.value ? `${masked(key.value)}  \u2190 ${key.from}` : "<unresolved>"}`);
  console.log(`model     : ${modelSlot()} -> ${model ?? "<unset>"} at ${base} effort, `
    + `carried on the ${effortVia(model)}`);
  console.log(`rungs     : ${ladder.length ? ladder.map(([level, one]) => `${level} -> ${one}`).join(", ")
    : "none — a `codex.rungs` object in this machine's own config maps a level to a model"}`);
  if (sameFamily(model)) {
    console.log("            ^ this model's own family: consult refuses it without --allow-echo.");
  }
  if (said) {
    console.log(`            ^ that id states the ${said} rung while the rule resolved ${base}, so `
      + `${ladder.length ? "a rung points at another rung's model" : "the one slot answers every level"}.`);
  }
  console.log(`repo root : ${root ?? "<not in a git repository>"}`);
  console.log(`history   : ${root ? historyFor(entries, root).length : 0} prior exchange(s) replayed`);
  console.log(`records   : ${recordPattern().value}  \u2190 ${recordPattern().from}`);
  const limits = plannedLimits();
  console.log(`tools     : ${TOOLS.map((one) => one.name).join(", ")} over ${limits.base} call(s), `
    + `${limits.ceiling} when a review comes back incomplete`);
  console.log(`tracker   : ${READ_ISSUE.name} where a consult names an issue key, `
    + `${PER_KEY} tracker request(s) per key and ${SPARE} over, per consult`);
  console.log(`spec      : ${READ_SPEC.name} where the checkout keeps a requirements tree inside itself`);
  console.log(`effort    : ${base}, a step down on a recheck or under ${limits.small} changed line(s), `
    + `a step up on a bodies pass, on a named risk or over ${limits.large}`);
  console.log(`angles    : ${anglesShown()}`);
  const check = codexCheck();
  /* The most it may be given and not the clock one round handed it: what a check actually runs under
     is that less whatever the consult has spent by the time it is called, which no reading taken
     before a consult can know. Saying which of the two this is costs a word and saves a run reading
     a configured ceiling as the allowance its stopped check had (ISS-2108). */
  console.log(`check     : ${check
    ? `${check.command}, at most ${check.ms / 1000}s  \u2190 ${check.msFrom}`
    : "none — a codex.check in the project's own settings names one"}`);
  console.log(`per call  : ${Math.round(budgetMs() / 1000)}s of budget, and the tool list is `
    + `${keepsTools() ? "kept on the last call with none asked for" : "dropped for the last call"}`);
  console.log(`pending   : ${waiting.length ? waiting.join(", ") : "nothing"}`);
  console.log(`log       : ${logPath()}  (${consults(entries).length} consult(s))`);
};

/* The hook records; it never reviews. It asks for one consult at the end of the turn with the intent
   attached, and the caller decides what a turn is: a pending list spans sessions. */

export const hookRecord = (event, paths, told = () => false, log = logBytes) => {
  if (process.env.FORGE_CODEX_DISABLE === "1") return null;
  let announce = null;
  /* The whole log, read at most once for the invocation and not at all where no path gets as far as asking:
     `readByCodex` wants every entry, so one PostToolUse over three documents was paying for three parses of the
     same file. Scoped to the call and not the module, since a memo outliving it would answer from a log that had moved. */
  let held = null;
  const read = () => (held ??= log());
  const stagedFor = stagedReader();
  for (const path of paths) {
    const root = repoRoot(dirname(resolve(path)));
    if (!root) continue;
    const rel = inside(root, path);
    if (!rel || !recordable(rel)) continue;
    /* Asked of a path the record does not hold as of one it does, an exact revert having owed a consult: a write at the bytes read is a reading still owed while the index holds another copy, that copy being what a commit lands (ISS-952, ISS-1005). */
    const known = readByCodex(root, rel, read) && !stagedApart(root, rel, { staged: stagedFor(root) });
    let added = false;
    updateState((held) => {
      const step = afterTouch(held, root, rel, known);
      added = step.added;
      if (!step.added && !step.cleared) return held;
      return { ...held, turns: { ...turnsOf(held), [root]: { files: step.files, at: step.at } } };
    });
    /* Asked only while there is something to say, because asking is what marks the turn told. */
    if (added && !announce && !told(root)) announce = rel;
  }
  /* The two new values are named by where they are read, never by what to write: a check list from memory is one the gate contradicts. */
  return announce
    ? `You changed a document this turn (${announce}). Before you finish, once over everything changed: `
      + `\`echo "<what you were doing, and what the advisor said>" | forge codex consult --diff --only `
      + `blocker,major --out-of-scope "<the issue's Out of scope text>" --checks "<the codex.check `
      + `\`forge codex show\` prints, else the gate command>"\`, then \`forge codex verdict\`. `
      + "Why: `forge hooks --how codex-turn`."
    : null;
};

const SUBS = {
  consult,
  verdict: (rest) => verdict(rest, repoRoot(process.cwd())),
  pending: (rest) => pending(rest, repoRoot(process.cwd())),
  show,
  log: printLog,
  stats: printStats,
  eval: printEval,
  marks: printMarks,
  replay: printReplay,
  complexity,
};

/* One text per action, which is the set its own parse refuses against: the two cannot drift, and
   the verb's own text is the list of actions and no flag of any of them (ISS-305, ISS-700). */
export const SAYS = {
  consult: CONSULT_USAGE,
  verdict: VERDICT_USAGE,
  pending: PENDING_USAGE,
  show: SHOW_USAGE,
  log: LOG_USAGE,
  stats: STATS_USAGE,
  eval: EVAL_USAGE,
  marks: MARKS_USAGE,
  replay: REPLAY_USAGE,
  complexity: COMPLEXITY_USAGE,
};

export const codex = async ([sub, ...rest]) => {
  /* The slots are the shared predicate's: reading every slot made a `--note` of the word a help ask. */
  const help = helpAskedOf([sub, ...rest], Object.keys(SUBS));
  if (help) {
    console.log(SAYS[help.subject] ?? USAGE);
    process.exit(0);
  }
  if (!sub || !Object.hasOwn(SUBS, sub)) {
    if (sub) console.error(didYouMean("codex action", sub, Object.keys(SUBS)));
    console.error(USAGE);
    process.exit(1);
  }
  await SUBS[sub](rest);
};

codex.answersHelp = true;
