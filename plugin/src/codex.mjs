/* `forge codex` — a second opinion from GPT-5 Codex over the gateway's own API, on the files this
   turn changed. docs/FORGE-CLI.md.

   Three pieces: the call and what it may read (codex-api.mjs), the log that is both its memory and
   its eval set (codex-log.mjs), and this — the verb, the turn's bookkeeping, and the hook halves. */
import { spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, rmSync, statSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, isAbsolute, join, resolve } from "node:path";

import { CONFIG_PATH, configDir, readJson, userConfig, writeJsonPrivate } from "./resolve/config.mjs";
import { fail } from "./resolve/settings.mjs";
import { flags, partition, pullRepeated } from "./resolve/flags.mjs";
import { didYouMean } from "./suggest.mjs";
import { TOOLS, runTool, scopeFor } from "./codex-tools.mjs";
import {
  EFFORTS,
  MODEL,
  askApi,
  bundle,
  defaultEffort,
  inside,
  locate,
  modelBehind,
  canonical,
  withDiffs,
  profile,
  promptFor,
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
  verdict,
} from "./codex-log.mjs";

export const STATE_PATH = join(configDir("forge"), "codex.json");

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
  "The hook records only documents (see `codex.pathRe` below); any path can be named explicitly.",
  "",
  "  consult [file...] [--diff [--base ref]] [--verify risk]... [--only s,s] [--allow-echo]",
  "                            review; pipe your intent on stdin",
  "  verdict --accepted n --rejected n [--note t]   what you did with the last consult",
  "  pending [--drop]          what this turn touched and has not been consulted on",
  "  show                      profile, model, history and pending, in effect here",
  "  log [--last n] [--id i] [--full]   past consults, for scoring the advice later",
  "",
  "A `codex` object in ~/.config/forge/config.json, every key optional",
  "  model                     model slot to ask for (default fable)",
  "  pathRe                    repo-relative paths the hook records (default ^docs/.*\\.md$)",
  "  budgetMs                  how long one consult may take (default 900000)",
  "  maxTokens                 reply ceiling, thinking included (default 32000)",
  "  rounds                    model calls one consult may make, the last served no tools (3)",
  "  send                      diffs | bodies — what travels with the prompt (diffs)",
  "  effort                    reasoning effort asked of the slot (default medium)",
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
  "",
  "  FORGE_CODEX_DISABLE=1     the one variable: a kill switch has to work when config is broken",
].join("\n");

const readState = () => readJson(STATE_PATH) ?? {};

/* A list with no age reads as this turn's work however old it is, and backlog presented as current
   work is how the notice gets ignored. */
export const ageOf = (at, now = Date.now()) => {
  if (!at) return "at an unknown time";
  const minutes = Math.round((now - at) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute(s) ago`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} hour(s) ago` : `${Math.round(hours / 24)} day(s) ago`;
};

const LOCK_PATH = `${STATE_PATH}.lock`;
const STALE_MS = 5_000;
const WAIT_MS = 20;
const TRIES = 50;

const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/* One file serves every checkout on the machine, so a hook that read it, added a line and wrote it
   back would lose whatever another project wrote in between. Bounded and stale-breaking on purpose:
   a gate that waits forever costs more than a list. */
const holding = (fn) => {
  let held = null;
  /* The lock lives beside the state file, so the directory has to exist before it can be taken —
     made here rather than under the lock, where the first writer would have been the only one. */
  try {
    mkdirSync(configDir("forge"), { recursive: true });
  } catch {
    /* No directory means no lock and no state either; the caller's write fails the same way. */
  }
  for (let tries = 0; tries < TRIES && held === null; tries += 1) {
    try {
      held = openSync(LOCK_PATH, "wx");
    } catch (error) {
      if (error.code !== "EEXIST") break;
      let since = 0;
      try {
        since = statSync(LOCK_PATH).mtimeMs;
      } catch {
        /* released while we looked */
      }
      if (since && Date.now() - since > STALE_MS) rmSync(LOCK_PATH, { force: true });
      else pause(WAIT_MS);
    }
  }
  try {
    return fn();
  } finally {
    if (held !== null) {
      closeSync(held);
      rmSync(LOCK_PATH, { force: true });
    }
  }
};

/* The change is a function of the state as it stands, read inside the lock: a caller cannot compose
   the next state from a read that happened before it. */
const updateState = (change) =>
  holding(() => {
    const before = readState();
    const after = change(before);
    if (after === before) return before;
    try {
      mkdirSync(configDir("forge"), { recursive: true });
      writeJsonPrivate(STATE_PATH, after);
    } catch {
      /* A turn whose bookkeeping cannot be written still consults on files named on the line. */
    }
    return after;
  });


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

/* One state file holds every repository's turn, so the list is keyed by root: paths are relative,
   and two checkouts would otherwise trade files with each other. */
const turnsOf = (held) => held.turns ?? {};

export const pendingIn = (held, root) => turnsOf(held)[root]?.files ?? [];

const recordPattern = () => userConfig().codex?.pathRe || DEFAULT_PATH_RE;

export const recordable = (rel) => new RegExp(recordPattern()).test(rel);

/* A turn's second write must not repeat the instruction the first one carried — that is how an
   instruction gets ignored. So the decision the hook needs is `first`, not just `added`. */
export const afterTouch = (held, root, rel) => {
  const files = pendingIn(held, root);
  if (files.includes(rel)) return { files, added: false, first: false };
  return { files: [...files, rel], added: true, first: files.length === 0 };
};

/* Only what was consulted on is dropped, and the state is re-read to do it: a file the hook recorded
   while the call was in flight is not part of this answer and must survive it. */
const clearConsulted = (root, rels) => {
  let left = [];
  updateState((held) => {
    left = pendingIn(held, root).filter((rel) => !rels.includes(rel));
    return { ...held, turns: { ...turnsOf(held), [root]: { files: left, at: Date.now() } } };
  });
  return left;
};

/* An entry that cannot be tied to code cannot be checked, so an eval over the log needs the commit. */
const commitAt = (root) => {
  const head = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" });
  if (head.status !== 0) return {};
  const changed = spawnSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" });
  return { head: (head.stdout ?? "").trim(), dirty: Boolean((changed.stdout ?? "").trim()) };
};

/* More than one call, and a bounded number: a round exists so the reviewer can SEE what it was not
   given, and seeing has a fixed point. The last call is served no tools, so it answers. What it
   still never gets is a shell: the version that could run commands took eleven minutes, spawned its
   own subagents and had to be killed by pid. hooks/how/codex-second.md. */
const BOOLEAN = ["--allow-echo", "--diff"];
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
  const { effort, cap } = held;
  const signal = AbortSignal.timeout(BUDGET_MS);
  const calls = callBudget(cap);
  const messages = [{ role: "user", content: opening }];
  const used = [];
  const refused = [];
  for (let call = 1; ; call += 1) {
    const last = call === calls;
    console.error(`codex: call ${call} of ${calls}${used.length ? ` after ${used.length} tool call(s)` : ""}...`);
    const held = await ask(values, model, messages, { onDelta, signal, effort, tools: last ? [] : TOOLS });
    if (!held.calls.length) return { ...held, tools: used, refused, calls: call };
    /* The cap is the loop's to keep: a gateway that answers the tool-less call with tool calls anyway
       would otherwise be served round `calls + 1`, with tools, until the budget expired. And a capped
       reply that is only tool calls answered nothing, so it fails rather than returns: returned, it
       would log as a consult, spend the advice and clear the files for a review never made. */
    if (last) {
      if (!held.text.trim()) {
        throw new Error(`spent all ${calls} call(s) reading and never answered. Raise \`codex.rounds\` in ${CONFIG_PATH}.`);
      }
      const unserved = held.calls.map((one) => `${one.name} ${detail(one.input)} (past the call cap)`);
      return { ...held, tools: used, refused: [...refused, ...unserved], calls: call };
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

const stdinText = async () => {
  if (process.stdin.isTTY) return "";
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8").trim();
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
       being silently dropped — one fewer rule to learn and one fewer way to be ignored. */
    base: held.base ?? (held.diff ? "HEAD" : null),
    effort: chosenEffort(held.effort),
    cap: held.rounds === undefined ? undefined : Number(held.rounds),
    /* Bodies off by default when the reviewer has tools: it reads what it needs and the payload
       stops paying twice. `--send bodies` is the old shape, for a consult with no repository to
       read from. */
    bodies: chosenSend(held.send),
  };
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
  const { named, risks, only, allowEcho, base, effort, cap, bodies } = consultArgs(given);
  const rels = [...new Set(named.length ? named.map((one) => contained(root, one)) : pendingIn(readState(), root))];
  if (!rels.length) fail("codex: nothing to consult on. Name a file, or write one first.");

  const model = modelBehind(values);
  if (!model) fail(`codex: ${path} maps the ${MODEL} slot to no model.`);
  /* The premise is a decorrelated reviewer. Refused rather than warned about, because a warning on
     stderr is read after the tokens are spent. */
  if (sameFamily(model) && !allowEcho) {
    fail(`codex: the ${MODEL} slot resolves to ${model}, this model's own family — that echoes rather `
      + "than reviews. Point `codex.model` at another slot, or pass --allow-echo.");
  }
  const intent = await stdinText();
  const id = randomBytes(3).toString("hex");

  const parts = base ? withDiffs(root, bundle(root, rels), base) : bundle(root, rels);
  const clipped = parts.filter((part) => part.clipped).map((part) => part.rel);
  if (clipped.length) console.error(`codex: sent clipped, too long to fit whole: ${clipped.join(", ")}.`);
  const history = historyFor(logEntries(), root);
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
    const opening = promptFor(intent, parts, history, { risks, only, bodies });
    const held = await rounds(
      values, model, opening, scopeFor(root, rels.filter(isAbsolute)), streamed, askApi, { effort, cap },
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
    const left = clearConsulted(root, rels);
    const kinds = held.tools.reduce((seen, one) => ({ ...seen, [one.name]: (seen[one.name] ?? 0) + 1 }), {});
    const spent = Object.entries(kinds).map(([name, n]) => `${name} ${n}`).join(", ");
    if (spent) console.error(`codex: ${held.calls} call(s), tools it ran: ${spent}.`);
    if (held.refused.length) console.error(`codex: refused ${held.refused.length} tool call(s): ${held.refused.join("; ")}.`);
    if (left.length) console.error(`codex: still unconsulted from this turn: ${left.join(", ")}.`);
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
  console.log(`records   : ${recordPattern()}`);
  console.log(`tools     : ${TOOLS.map((one) => one.name).join(", ")} over ${callBudget()} call(s)`);
  console.log(`pending   : ${waiting.length ? waiting.join(", ") : "nothing"}`);
  console.log(`log       : ${LOG_PATH}  (${consults(entries).length} consult(s))`);
};

/* The hook records; it never reviews. What it asks for is one consult at the end of the turn, with
   the intent attached — a review that knows what you were trying to do is a different review. The
   caller decides what a turn is: a pending list spans sessions, so it cannot answer for the silence. */
export const hookRecord = (event, paths, told = () => false) => {
  if (process.env.FORGE_CODEX_DISABLE === "1") return null;
  let announce = null;
  for (const path of paths) {
    const root = repoRoot(dirname(resolve(path)));
    if (!root) continue;
    const rel = inside(root, path);
    if (!rel || !recordable(rel)) continue;
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
    ? `You have changed a document in this turn (${announce}). Before you finish, consult codex — `
      + `GPT-5 Codex, on another provider, with the log's memory of this repository:\n\n`
      + `    echo "what I was doing and why, the plan, and the decisions I made" | forge codex consult\n\n`
      + `Once, at the end, over everything you changed. The files travel with the prompt and it reads `
      + `what else it needs; your intent is the one thing it cannot reach, the advisor's reply included. Then `
      + `\`forge codex verdict\`. Why, and what to do with what comes back: \`forge hooks --how codex-turn\`.`
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
  const asked = sub === "-h" || sub === "--help";
  if (asked || !sub || !Object.hasOwn(SUBS, sub)) {
    if (sub && !asked) console.error(didYouMean("codex action", sub, Object.keys(SUBS)));
    console.error(USAGE);
    process.exit(asked ? 0 : 1);
  }
  await SUBS[sub](rest);
};
