/* `forge codex` — a second opinion from GPT-5 Codex over the gateway's own API, on the files this
   turn changed. docs/FORGE-CLI.md.

   Four pieces: the call and what it may read (codex-api.mjs), the log that is both its memory and
   its eval set (codex-log.mjs), the turn's bookkeeping (codex-state.mjs), and this — the verb and
   the hook halves. */
export { STATE_PATH, afterTouch, ageOf, holding, pendingIn, pendingState } from "./codex-state.mjs";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, isAbsolute, join, resolve } from "node:path";

import { CONFIG_PATH, userConfig } from "../resolve/config.mjs";
import { INTENT_MS, stdinText } from "../resolve/payload.mjs";
import { fail, projectCodex, projectRecordPattern } from "../resolve/settings.mjs";
import { flags, partition, pullRepeated } from "../resolve/flags.mjs";
import { didYouMean } from "../suggest.mjs";
import { afterTouch, ageOf, clearConsulted, pendingIn, readState, turnsOf, updateState } from "./codex-state.mjs";
import { TOOLS, runTool, scopeFor, toolsFor } from "./codex-tools.mjs";
import {
  ANGLES,
  EFFORTS,
  MODEL,
  askApi,
  bundle,
  changedAgainst,
  defaultEffort,
  digest,
  inside,
  locate,
  modelBehind,
  canonical,
  withDiffs,
  openingFor,
  profile,
  roleFor,
  sameFamily,
} from "./codex-api.mjs";
import {
  BUDGET_MS,
  LOG_PATH,
  consults,
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
/* Model calls in total, not extra rounds: the last one is served no tools, so the cap is what the
   caller is billed for and not one more. Three, measured: docs/FORGE-CLI.md carries the numbers. */
const DEFAULT_CALLS = 3;

const USAGE = [
  "Usage: forge codex <consult|verdict|pending|show|log> [args]",
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
  "",
  "A `codex` object in ~/.config/forge/config.json, every key optional",
  "  model                     model slot to ask for (default fable)",
  "  pathRe                    repo-relative paths the hook records (default ^docs/.*\\.md$);",
  "                            a `codex.pathRe` in the checkout's .forge.json wins over this",
  "  budgetMs                  how long one consult may take (default 900000)",
  "  maxTokens                 reply ceiling, thinking included (default 32000)",
  "  rounds                    model calls one consult may make, the last served no tools (3)",
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
  "  --effort e     minimal | low | medium | high, for this consult only. Medium by default,",
  "                 because the reading is what costs, not the thinking.",
  "  --rounds n     model calls this consult may make. Wall time is calls times about 45s.",
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

/* An entry that cannot be tied to code cannot be checked, so an eval over the log needs the commit. */
const commitAt = (root) => {
  const head = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" });
  if (head.status !== 0) return {};
  const changed = spawnSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" });
  return { head: (head.stdout ?? "").trim(), dirty: Boolean((changed.stdout ?? "").trim()) };
};

/* More than one call, and a bounded number: a round exists so the reviewer can SEE what it was not
   given, and seeing has a fixed point. The last call is served no tools, so it answers. What it
   still never gets is a shell — one command the checkout named, once, is the whole exception; the
   version that could run commands took eleven minutes and had to be killed by pid. */
const BOOLEAN = ["--allow-echo", "--diff", "--recheck"];
const SEVERITIES = ["blocker", "major", "minor"];

const severities = (raw) => {
  if (raw === undefined) return [];
  const asked = raw.split(",").map((one) => one.trim().toLowerCase()).filter(Boolean);
  for (const one of asked) if (!SEVERITIES.includes(one)) fail(didYouMean("severity", one, SEVERITIES));
  return asked;
};

const callBudget = (asked) => {
  const raw = asked ?? userConfig().codex?.rounds;
  if (raw === undefined) return DEFAULT_CALLS;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    const where = asked === undefined ? `\`codex.rounds\` in ${CONFIG_PATH}` : "--rounds";
    fail(`codex: ${where} takes an integer of 1 or more, not \`${raw}\`.`);
  }
  return value;
};

export const rounds = async (values, model, opening, scope, onDelta, ask = askApi, held = {}) => {
  const { effort, cap, system } = held;
  const signal = AbortSignal.timeout(BUDGET_MS);
  const calls = callBudget(cap);
  const messages = [{ role: "user", content: opening }];
  const used = [];
  const refused = [];
  /* Summed over the calls: logged from the last one alone, `log --score` counted a third of the input. */
  const spent = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
  let thought = 0;
  const charge = (one) => {
    for (const key of Object.keys(spent)) spent[key] += one.usage?.[key] ?? 0;
    thought += one.thought ?? 0;
  };
  for (let call = 1; ; call += 1) {
    const last = call === calls;
    console.error(`codex: call ${call} of ${calls}${used.length ? ` after ${used.length} tool call(s)` : ""}...`);
    const held = await ask(values, model, messages, { onDelta, signal, effort, system, tools: last ? [] : toolsFor(scope) });
    charge(held);
    if (!held.calls.length) return { ...held, usage: spent, thought, tools: used, refused, calls: call };
    /* The cap is the loop's to keep: a gateway that answers the tool-less call with tool calls anyway
       would otherwise be served round `calls + 1`, with tools, until the budget expired. And a capped
       reply that is only tool calls answered nothing, so it fails rather than returns: returned, it
       would log as a consult, spend the advice and clear the files for a review never made. */
    if (last) {
      if (!held.text.trim()) {
        throw new Error(`spent all ${calls} call(s) reading and never answered. Raise \`codex.rounds\` in ${CONFIG_PATH}.`);
      }
      const unserved = held.calls.map((one) => `${one.name} ${detail(one.input)} (past the call cap)`);
      return { ...held, usage: spent, thought, tools: used, refused: [...refused, ...unserved], calls: call };
    }
    const results = [];
    for (const one of held.calls) {
      const ran = runTool(scope, one.name, one.input);
      used.push({ name: one.name, input: one.input, chars: ran.text.length, error: Boolean(ran.error) });
      console.error(`codex:   ${one.name} ${detail(one.input)}${ran.error ? ` — ${ran.text}` : ""}`);
      if (ran.error) refused.push(`${one.name} ${detail(one.input)}: ${ran.text}`);
      results.push({
        type: "tool_result",
        tool_use_id: one.id,
        content: ran.text,
        ...(ran.error ? { is_error: true } : {}),
      });
    }
    messages.push({
      role: "assistant",
      content: [
        ...(held.text ? [{ type: "text", text: held.text }] : []),
        ...held.calls.map((one) => ({ type: "tool_use", id: one.id, name: one.name, input: one.input })),
      ],
    });
    /* Warned one round early: a model told mid-answer that its tools are gone has already spent the
       round it would have read in. */
    const closing = call + 1 === calls
      ? [{ type: "text", text: "No further tool calls will be served. Answer now, and say what you could not check." }]
      : [];
    messages.push({ role: "user", content: [...results, ...closing] });
  }
};

/** What a tool call was for, in one line of a terminal: the path, or the pattern grep was given. */
const detail = (input = {}) => input.path ?? (input.pattern ? `/${input.pattern}/` : "");

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
       being silently dropped — one fewer rule to learn and one fewer way to be ignored. */
    base: held.base ?? (held.diff ? "HEAD" : null),
    effort: chosenEffort(held.effort),
    cap: held.rounds === undefined ? undefined : Number(held.rounds),
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
  if (raw === undefined) return defaultEffort();
  if (!EFFORTS.includes(raw)) fail(`codex: --effort takes ${EFFORTS.join(" | ")}, not \`${raw}\`.`);
  return raw;
};

const consult = async (given) => {
  const { problem, values, path } = profile();
  if (problem) fail(`codex: ${problem}. It needs the gateway the consult is sent to.`);
  const root = repoRoot(process.cwd());
  if (!root) fail("codex: not in a git repository, so there is nothing to review against.");
  const { named, risks, only, allowEcho, base, effort, cap, bodies, recheck, angles } = consultArgs(given);
  const rels = [...new Set(named.length ? named.map((one) => contained(root, one)) : pendingIn(readState(), root))];
  /* Asked for a diff and given nothing to diff, the tree answers: the round it replaces was reading
     `git diff --name-only` and typing the list back (ISS-65). */
  if (!rels.length && base) {
    rels.push(...changedAgainst(root, base));
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

  const parts = base ? withDiffs(root, bundle(root, rels), base) : bundle(root, rels);
  /* A review of nothing is still billed: after a commit every file reads UNCHANGED against HEAD. */
  if (base && unchangedAll(parts)) {
    const where = commitAt(root).dirty ? "the files named" : "the tree is clean, so the change is committed";
    fail(`codex: nothing differs from ${base} in ${rels.join(", ")} — ${where}. Pass --base ${base}~1 to review the last commit.`);
  }
  const clipped = parts.filter((part) => part.clipped).map((part) => part.rel);
  if (clipped.length) console.error(`codex: sent clipped, too long to fit whole: ${clipped.join(", ")}.`);
  const history = historyFor(entries, root, undefined, rels);
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
    ...(recheck ? { recheck: true } : {}),
    ...(base ? { anchoredTo: base } : {}),
    ...(risks.length ? { risks } : {}),
    ...(only.length ? { only } : {}),
    ...commitAt(root),
  };
  /* Written before the call: a consult that dies mid-flight never reaches either handler, and a
     review that vanished is the one an eval most wants to see. The result closes the pair on `id`. */
  logConsult({ ...record, kind: "started" });
  let shown = 0;
  const streamed = (text) => {
    shown += text.length;
    process.stdout.write(text);
  };
  try {
    const opening = openingFor(intent, parts, history, { risks, only, bodies });
    const check = projectCheck();
    const held = await rounds(
      values, model, opening, scopeFor(root, rels.filter(isAbsolute), check), streamed, askApi,
      { effort, cap, system: roleFor(angles, { check: Boolean(check) }) },
    );
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
    logConsult({ ...record, kind: "consult", ms: Date.now() - started, ok: false, error: error.message });
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
  console.log(`tools     : ${TOOLS.map((one) => one.name).join(", ")} over ${callBudget()} call(s)`);
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
  pending: (rest) => {
    const { drop } = flags(rest, "codex pending", ["--drop"]);
    const root = repoRoot(process.cwd());
    const held = readState();
    const waiting = root ? pendingIn(held, root) : [];
    if (!waiting.length) return console.log("nothing pending");
    if (drop) {
      updateState((now) => ({ ...now, turns: { ...turnsOf(now), [root]: { files: [], at: Date.now() } } }));
      return console.log(`dropped ${waiting.length} unconsulted file(s).`);
    }
    console.log(waiting.join("\n"));
    console.log(`\nrecorded ${ageOf(held.turns?.[root]?.at)}; \`forge codex pending --drop\` clears it.`);
  },
  show,
  log: printLog,
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
