/* `forge codex` — a second opinion from GPT-5 Codex over the gateway's own API, on the files this
   turn changed. docs/cli/codex-the-consult.md.

   Four pieces: the call and what it may read (codex-api.mjs), the log that is both its memory and
   its eval set (codex-log.mjs), the turn's bookkeeping (codex-state.mjs), and this — the verb and
   the hook halves. */
export { STATE_PATH, afterTouch, ageOf, demandIn, holding, pendingIn, pendingState, stagedIn } from "./codex-state.mjs";
export { reviewed, rounds } from "./codex-rounds.mjs";
export { plannedFor } from "./codex-plan.mjs";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, isAbsolute, join, resolve } from "node:path";

import { CONFIG_PATH, userConfig } from "../resolve/config.mjs";
import { INTENT_MS, stdinText } from "../resolve/payload.mjs";
import { fail, projectCodex, projectRecordPattern } from "../resolve/settings.mjs";
import { flags, partition, pullRepeated } from "../resolve/flags.mjs";
import { didYouMean } from "../suggest.mjs";
import { afterTouch, ageOf, clearConsulted, demandOf, pendingIn, readState, turnsOf, updateState } from "./codex-state.mjs";
import { TOOLS, scopeFor } from "./codex-tools.mjs";
import { reviewed } from "./codex-rounds.mjs";
import { EFFORTS, defaultEffort, incompleteIn, newFindingsIn, plannedFor, plannedLimits } from "./codex-plan.mjs";
import {
  ANGLES,
  MODEL,
  askApi,
  bundle,
  changedAgainst,
  digest,
  inside,
  locate,
  modelBehind,
  promptMark,
  canonical,
  withDiffs,
  openingFor,
  profile,
  roleFor,
  sameFamily,
} from "./codex-api.mjs";
import { printReplay, printStats } from "./codex-stats.mjs";
import {
  LOG_PATH,
  consults,
  numbered,
  historyFor,
  logConsult,
  logEntries,
  printLog,
  recheckPlan,
  sentShaOf,
  verdict,
  verdictFromRulings,
  verdictsBy,
} from "./codex-log.mjs";

const DEFAULT_PATH_RE = "^docs/.*\\.md$";

export const USAGE = [
  "Usage: forge codex <consult|verdict|pending|show|log|stats|replay> [args]",
  "GPT-5 Codex reviews the files you name, streamed over the gateway's own API. The files travel",
  "with the prompt; beyond them it reads for itself — read_file, list_dir, grep and git_diff, over",
  "this checkout and any other you name a file in, and nothing else on the machine. The log is what",
  "gives it a memory of this repository. A named file may be an absolute path in another project.",
  "The hook records what `codex.pathRe` matches, documents by default; any path can be named too.",
  "",
  "  consult [file...] [--diff [--base ref]] [--verify risk]... [--only s,s] [--recheck]",
  "                            review; pipe your intent on stdin",
  "                            [--angles a,a] [--effort e] [--rounds n] [--send m] [--allow-echo]",
  "  verdict --accepted F1,F3 --rejected F2=why [--note t] [--of id]   what became of each finding;",
  "                            a recheck records one for what it refuted, and a commit waits for one",
  "  pending [--drop]          what this turn touched and has not been consulted on",
  "  show                      profile, model, history and pending, in effect here",
  "  log [--last n] [--id i] [--full]   past consults, for scoring the advice later",
  "  log --score               per model: consults, findings, what was kept, time, cache",
  "  stats [--last n] [--days n] [--root p] [--here]   what the harness did over a window: calls",
  "                            against their budget, replies that could not check, rechecks that",
  "                            raised something New, tokens by kind, and the prompt versions that ran",
  "  replay --prompt <file> [--last n] [--root p]      which of a window a candidate prompt could be",
  "                            scored against, rebuilt from git and kept only where the bytes still match",
  "",
  "A `codex` object in ~/.config/forge/config.json, every key optional",
  "  model                     model slot to ask for (default fable)",
  "  pathRe                    repo-relative paths the hook records (default ^docs/.*\\.md$);",
  "                            a `codex.pathRe` in the checkout's .forge.json wins over this",
  "  budgetMs                  how long one consult may take (default 900000)",
  "  maxTokens                 reply ceiling, thinking included (default 32000)",
  "  rounds                    model calls a consult starts with; the payload moves it (3)",
  "  roundsMax                 what a review that could not finish is retried at (5)",
  "  effortLines               { small, large } changed lines: under the first the effort steps down,",
  "                            over the second it steps up (40, 400)",
  "  toolChoiceNone            keep the tool list on the last call and ask for none (true)",
  "  send                      diffs | bodies — what travels with the prompt (diffs)",
  "  effort                    reasoning effort asked of the slot (default medium)",
  "  angles                    which of tech | ba | user | ux review (default all four);",
  "                            a `codex.angles` in the checkout's .forge.json wins over this",
  "  check                     .forge.json only: one command the reviewer may run once per consult,",
  "                            such as `npm test`; `checkMs` its clock (default 300000). Off unless set.",
  "",
  "  --diff         send each file's diff and refuse findings that are only about code this turn",
  "                 did not touch. Raises precision more than anything else.",
  "  --base ref     what to diff against; implies --diff. HEAD unless you say otherwise.",
  "  --effort e     minimal | low | medium | high, for this consult only. Derived from the round",
  "                 and the change's size unless you say otherwise.",
  "  --rounds n     model calls this consult may make, used as given. Wall time is calls times 45s.",
  "  --send m       diffs (default) sends each file's change and its size, and the reviewer reads",
  "                 what it needs; bodies sends every file whole, for a consult with nothing to read.",
  "  --verify risk  a named risk to rule on rather than an open review; repeatable. A reviewer",
  "                 verifying is reliable where a reviewer discovering invents.",
  "  --only s,s     report only these severities: blocker, major, minor.",
  "  --recheck      verify the last consult's findings on these files instead of roaming for new",
  "                 ones: each becomes a --verify risk. The round after a fix, not the first. What",
  "                 it REFUTES is recorded as that consult's verdict; CONFIRMED stays open.",
  "  --angles a,a   which angles review this consult: tech, ba, user, ux.",
  "",
  "  FORGE_CODEX_DISABLE=1     the one variable: a kill switch has to work when config is broken",
].join("\n");

/* Canonical, because the root is the key the state file and the log are grouped by: one checkout
   reached through a symlink would otherwise be two repositories. */
export const repoRoot = (start) => {
  let directory = resolve(start);
  for (;;) {
    if (existsSync(join(directory, ".git"))) return canonical(directory);
    const up = dirname(directory);
    if (up === directory) return null;
    directory = up;
  }
};

/* A path named on the command line takes the same containment as one the reviewer asks for, and
   refuses loudly rather than quietly: a caller who typed the path wants to know it was dropped. */
/* Absolute, when the file is somebody else's checkout: one account configures one reviewer, so a
   consult may reach a sibling project. Relative to `root` otherwise, which is what the log keys on. */
const contained = (root, given) => {
  const held = locate(root, given);
  if (!held) fail(`codex: ${given} is not a readable file, from ${root}.`);
  return held.rel;
};

/* A pattern that does not compile is worse than no pattern: the gate would throw on every write of
   whatever repository carries it. It is skipped for the next source, and `show` names what resolved. */
const compiles = (source) => {
  try {
    new RegExp(source);
    return true;
  } catch {
    return false;
  }
};

export const recordPattern = () => {
  const asked = [projectRecordPattern(), { value: userConfig().codex?.pathRe, from: CONFIG_PATH }];
  const held = asked.find((one) => one.value && compiles(one.value));
  return held ?? { value: DEFAULT_PATH_RE, from: "the built-in default" };
};

export const recordable = (rel) => new RegExp(recordPattern().value).test(rel);

export const unchangedAll = (parts) => parts.length > 0 && parts.every((part) => part.missing || part.diff?.unchanged);

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

/* Repeated `--verify`, then positionals apart from flag values, then the rest — three passes
   because a flag can carry a value and a file cannot. */
export const consultArgs = (given) => {
  if (given.includes("--bg")) fail("codex: --bg is gone; a consult runs inline, like the advisor.");
  const { values: risks, rest: without } = pullRepeated(given, "--verify", "codex consult");
  const { positionals, flagArgv } = partition(without, BOOLEAN);
  const held = flags(flagArgv, "codex consult", BOOLEAN);
  return {
    named: positionals,
    risks,
    only: severities(held.only),
    allowEcho: Boolean(held["allow-echo"]),
    /* Asking what to diff against is asking for the diff, so `--base` implies `--diff` rather than
       being silently dropped — one fewer rule to learn and one fewer way to be ignored. Kept apart
       from `named` because HEAD from `--diff` is this end's guess and a recheck may still improve
       on it, where a base the caller typed is theirs and is never moved. */
    base: held.base ?? (held.diff ? "HEAD" : null),
    namedBase: held.base ?? null,
    effort: chosenEffort(held.effort),
    cap: askedRounds(held.rounds),
    /* Bodies off by default when the reviewer has tools: it reads what it needs and the payload
       stops paying twice. `--send bodies` is the old shape, for a consult with no repository to
       read from. */
    bodies: chosenSend(held.send),
    recheck: Boolean(held.recheck),
    angles: chosenAngles(held.angles),
  };
};

/* The checkout's, else the account's, else all four — and a name not on the list is refused rather
   than sent, because a role the prompt never described would be reviewed by nobody. */
const chosenAngles = (raw) => {
  const given = raw ?? projectCodex().angles ?? userConfig().codex?.angles;
  if (given === undefined) return Object.keys(ANGLES);
  const asked = (Array.isArray(given) ? given : String(given).split(",")).map((one) => one.trim()).filter(Boolean);
  for (const one of asked) if (!ANGLES[one]) fail(didYouMean("angle", one, Object.keys(ANGLES)));
  return asked.length ? asked : Object.keys(ANGLES);
};

/* The checkout's, never the account's: what a project's check is, only the project can say. */
const projectCheck = () => {
  const { check, checkMs } = projectCodex();
  if (!check || typeof check !== "string") return null;
  return { command: check, ms: Number(checkMs) > 0 ? Number(checkMs) : undefined };
};

const SENDS = ["diffs", "bodies"];

const chosenSend = (raw) => {
  const named = raw ?? userConfig().codex?.send ?? "diffs";
  if (!SENDS.includes(named)) fail(`codex: --send takes ${SENDS.join(" | ")}, not \`${named}\`.`);
  return named === "bodies";
};

/* Named rather than clamped: an unknown value would otherwise be sent to the gateway, which accepts
   anything and reports nothing, so the consult would run at a level nobody chose. */
const chosenEffort = (raw) => {
  if (raw === undefined) return undefined;
  if (!EFFORTS.includes(raw)) fail(`codex: --effort takes ${EFFORTS.join(" | ")}, not \`${raw}\`.`);
  return raw;
};

const consult = async (given) => {
  const { problem, values, path } = profile();
  if (problem) fail(`codex: ${problem}. It needs the gateway the consult is sent to.`);
  const root = repoRoot(process.cwd());
  if (!root) fail("codex: not in a git repository, so there is nothing to review against.");
  const { named, risks, only, allowEcho, base, namedBase, effort: askedEffort, cap, bodies, recheck, angles } = consultArgs(given);
  const rels = [...new Set(named.length ? named.map((one) => contained(root, one)) : pendingIn(readState(), root))];
  /* Asked for a diff and given nothing to diff, the tree answers: the round it replaces was reading
     `git diff --name-only` and typing the list back (ISS-65). */
  if (!rels.length && base) {
    const changed = changedAgainst(root, base);
    if (!changed) fail(`codex: --base ${base} is no ref this checkout can read, so what changed against it is unknown. Name the base, or name the files.`);
    rels.push(...changed);
    if (rels.length) console.error(`codex: nothing named and nothing pending, so the ${rels.length} file(s) changed against ${base}: ${rels.join(", ")}.`);
  }
  if (!rels.length) {
    fail(`codex: nothing to consult on. Name a file, or write one first.${base ? ` Nothing differs from ${base} either.` : ""}`);
  }
  const entries = logEntries();
  const plan = recheck ? recheckPlan(entries, root, rels) : null;
  const offset = risks.length;
  if (recheck) {
    if (!plan?.risks.length) fail("codex: --recheck needs an answered consult with findings on these files, and none is logged.");
    risks.push(...plan.risks);
  }
  /* The diff since the head the findings were made against: re-sending the whole file makes the
     reviewer find the change before it can rule on the fix. Only where that head is a readable ref. */
  const anchor = recheck && !namedBase && plan.judged.head && readableRef(root, plan.judged.head)
    ? plan.judged.head
    : base;
  if (anchor !== base) console.error(`codex: a recheck of ${plan.judged.id ?? plan.judged.at}, so the diff since ${anchor} travels with it.`);

  const model = modelBehind(values);
  if (!model) fail(`codex: ${path} maps the ${MODEL} slot to no model.`);
  /* The premise is a decorrelated reviewer. Refused rather than warned about, because a warning on
     stderr is read after the tokens are spent. */
  if (sameFamily(model) && !allowEcho) {
    fail(`codex: the ${MODEL} slot resolves to ${model}, this model's own family — that echoes rather `
      + "than reviews. Point `codex.model` at another slot, or pass --allow-echo.");
  }
  /* Said before the read, so a stall says where it is, and the read waits on the first byte alone:
     an open stdin with nothing on it was read to EOF and never returned (ISS-65). */
  console.error(`codex: ${rels.length} file(s) to review; reading the intent from stdin.`);
  const said = await stdinText();
  if (said === null) console.error(`codex: nothing on stdin inside ${INTENT_MS}ms, so the consult carries no intent.`);
  const intent = (said ?? "").trim();
  const id = randomBytes(3).toString("hex");

  const bundled = anchor ? withDiffs(root, bundle(root, rels), anchor) : bundle(root, rels);
  /* A review of nothing is still billed: after a commit every file reads UNCHANGED against HEAD. A
     recheck is the one case that carries on: its base was chosen for it, so an unmoved tree means
     nothing to diff and not nothing to ask, and the findings are still owed a ruling. */
  const still = anchor && unchangedAll(bundled);
  if (still && anchor === namedBase) {
    const where = commitAt(root).dirty ? "the files named" : "the tree is clean, so the change is committed";
    fail(`codex: nothing differs from ${namedBase} in ${rels.join(", ")} — ${where}. Pass --base ${namedBase}~1 to review the last commit.`);
  }
  if (still) console.error(`codex: nothing differs from ${anchor}, so this recheck carries no diff — the findings are asked for on the tree as it stands.`);
  const parts = still ? bundle(root, rels) : bundled;
  const anchoredTo = still ? null : anchor;
  const { clipped, lines, budget, ceiling, effort } = plannedFor({ parts, bodies, recheck, asked: cap, effort: askedEffort });
  if (clipped.length) console.error(`codex: sent clipped, too long to fit whole: ${clipped.join(", ")}.`);
  const history = historyFor(entries, root, undefined, rels);
  const system = roleFor(angles, { check: Boolean(projectCheck()), recheck });
  console.error(`codex: ${budget} call(s) at ${effort} effort for ${lines} changed line(s)`
    + `${clipped.length ? `, ${clipped.length} of them clipped` : ""}${budget < ceiling ? `, up to ${ceiling} if the review comes back incomplete` : ""}.`);
  const started = Date.now();
  const record = {
    id,
    at: new Date().toISOString(),
    root,
    slot: MODEL,
    model,
    files: rels,
    sent: parts.map((part) => ({ rel: part.rel, sha: part.sha, chars: part.chars, clipped: Boolean(part.clipped) })),
    intent,
    history: history.length,
    effort,
    angles,
    ceiling,
    lines,
    send: bodies ? "bodies" : "diffs",
    prompt: promptMark(system),
    ...(cap === undefined ? {} : { cap }),
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
  try {
    const opening = openingFor(intent, parts, history, { risks, only, bodies });
    const held = await reviewed(
      values, model, opening, scopeFor(root, rels.filter(isAbsolute), projectCheck()), streamed, askApi,
      { effort, budget, ceiling, system },
    );
    /* Buffered while a retry was still possible, so the review lands here in one piece. */
    if (!held.streamed) process.stdout.write(held.text);
    process.stdout.write("\n");
    logConsult({
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
      ...(recheck ? { newFindings: newFindingsIn(numbered(held.text, rels)) } : {}),
      reply: held.text,
    });
    const { left, since } = clearConsulted(root, rels);
    if (plan) {
      const auto = verdictFromRulings(plan, offset, held.text, id, verdictsBy(entries).get(plan.judged.id ?? plan.judged.at) ?? null);
      if (auto) {
        logConsult(auto.record);
        console.error(`codex: ${auto.said}`);
      }
    }
    const kinds = held.tools.reduce((seen, one) => ({ ...seen, [one.name]: (seen[one.name] ?? 0) + 1 }), {});
    const spent = Object.entries(kinds).map(([name, n]) => `${name} ${n}`).join(", ");
    if (spent) console.error(`codex: ${held.calls} call(s), tools it ran: ${spent}.`);
    if (held.refused.length) console.error(`codex: refused ${held.refused.length} tool call(s): ${held.refused.join("; ")}.`);
    if (left.length) console.error(`codex: ${left.length} file(s) still pending, recorded ${ageOf(since)}: ${left.join(", ")}.`);
    if (held.stop === "max_tokens") console.error("codex: the reply hit `codex.maxTokens`.");
  } catch (error) {
    logConsult({ ...record, kind: "consult", budget, ms: Date.now() - started, ok: false, error: error.message });
    const partial = shown ? `\n\ncodex: the ${shown} characters above are an incomplete reply and were `
      + "not recorded as a consult." : "";
    fail(`${partial}\ncodex: ${error.message}`);
  }
};

const show = () => {
  const { problem, values, path } = profile();
  const root = repoRoot(process.cwd());
  const waiting = root ? pendingIn(readState(), root) : [];
  const entries = logEntries();
  const model = modelBehind(values);
  console.log(`profile   : ${path}${problem ? `  (${problem})` : ""}`);
  console.log(`endpoint  : ${values?.ANTHROPIC_BASE_URL ?? "<unresolved>"}/v1/messages  (streamed)`);
  console.log(`model     : ${MODEL} -> ${model ?? "<unset>"}`);
  if (sameFamily(model)) {
    console.log("            ^ this model's own family: consult refuses it without --allow-echo.");
  }
  console.log(`repo root : ${root ?? "<not in a git repository>"}`);
  console.log(`history   : ${root ? historyFor(entries, root).length : 0} prior exchange(s) replayed`);
  console.log(`records   : ${recordPattern().value}  \u2190 ${recordPattern().from}`);
  const limits = plannedLimits();
  console.log(`tools     : ${TOOLS.map((one) => one.name).join(", ")} over ${limits.base} call(s), `
    + `${limits.ceiling} when a review comes back incomplete`);
  console.log(`effort    : ${defaultEffort()}, a step down on a recheck or under ${limits.small} `
    + `changed line(s), a step up over ${limits.large}`);
  console.log(`angles    : ${chosenAngles(undefined).join(", ")}`);
  console.log(`check     : ${projectCheck()?.command ?? "none — codex.check in .forge.json names one"}`);
  console.log(`pending   : ${waiting.length ? waiting.join(", ") : "nothing"}`);
  console.log(`log       : ${LOG_PATH}  (${consults(entries).length} consult(s))`);
};

/* The hook records; it never reviews. What it asks for is one consult at the end of the turn, with
   the intent attached — a review that knows what you were trying to do is a different review. The
   caller decides what a turn is: a pending list spans sessions, so it cannot answer for the silence. */
/* Content codex has read is not owed a second reading, whatever the mtime says. */
const readByCodex = (root, rel, log) => {
  let text;
  try {
    text = readFileSync(join(root, rel), "utf8");
  } catch {
    return false;
  }
  return digest(text) === sentShaOf(log(), root, rel);
};

export const hookRecord = (event, paths, told = () => false, log = logEntries) => {
  if (process.env.FORGE_CODEX_DISABLE === "1") return null;
  let announce = null;
  for (const path of paths) {
    const root = repoRoot(dirname(resolve(path)));
    if (!root) continue;
    const rel = inside(root, path);
    if (!rel || !recordable(rel)) continue;
    if (!pendingIn(readState(), root).includes(rel) && readByCodex(root, rel, log)) continue;
    let added = false;
    updateState((held) => {
      const step = afterTouch(held, root, rel);
      added = step.added;
      return added ? { ...held, turns: { ...turnsOf(held), [root]: { files: step.files, at: Date.now() } } } : held;
    });
    /* Asked only while there is something to say, because asking is what marks the turn told. */
    if (added && !announce && !told(root)) announce = rel;
  }
  return announce
    ? `You changed a document this turn (${announce}). Before you finish, once over everything changed: `
      + `\`echo "<what you were doing, and what the advisor said>" | forge codex consult --diff --only `
      + `blocker,major\`, then \`forge codex verdict\`. Why: \`forge hooks --how codex-turn\`.`
    : null;
};

const SUBS = {
  consult,
  verdict: (rest) => verdict(rest, repoRoot(process.cwd())),
  /* What the commit gate will compare, not the record it is drawn from: a list that named 726 paths
     the gate never looked at cost five consults and cleared nothing (ISS-70). */
  pending: (rest) => {
    const { drop } = flags(rest, "codex pending", ["--drop"]);
    const root = repoRoot(process.cwd());
    const held = readState();
    const waiting = root ? pendingIn(held, root) : [];
    if (!waiting.length) return console.log("nothing pending");
    const demand = demandOf(root, waiting);
    const unstaged = waiting.filter((rel) => !demand.includes(rel));
    if (drop) {
      if (!demand.length) {
        return console.log(`nothing of the ${waiting.length} recorded file(s) is staged, so no commit is `
          + "held for them and there is nothing to drop. Name one to a consult to clear it.");
      }
      const { left } = clearConsulted(root, demand);
      console.log(`dropped ${demand.length} unconsulted file(s), which is what a commit made now would be asked for.`);
      return left.length ? console.log(`still recorded, unstaged: ${left.join(", ")}`) : undefined;
    }
    console.log(demand.length ? demand.join("\n") : "nothing staged that codex has not read");
    console.log(`\nwhat a commit made now is asked for, out of ${waiting.length} file(s) recorded `
      + `${ageOf(held.turns?.[root]?.at)}; \`forge codex pending --drop\` clears it.`);
    if (unstaged.length) {
      console.log(`recorded and not staged, which a commit takes only with -a or a pathspec: ${unstaged.join(", ")}`);
    }
  },
  show,
  log: printLog,
  stats: printStats,
  replay: printReplay,
};

export const codex = async ([sub, ...rest]) => {
  /* `-h` after an action read as a filename, and one usage documents every action anyway. */
  const asked = [sub, ...rest].some((one) => one === "-h" || one === "--help");
  if (asked || !sub || !Object.hasOwn(SUBS, sub)) {
    if (sub && !asked) console.error(didYouMean("codex action", sub, Object.keys(SUBS)));
    console.error(USAGE);
    process.exit(asked ? 0 : 1);
  }
  await SUBS[sub](rest);
};

codex.answersHelp = true;
