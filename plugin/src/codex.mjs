/* `forge codex` — a second opinion from GPT-5 Codex over the gateway's own API, on the files this
   turn changed. docs/FORGE-CLI.md.

   Three pieces: the call and what it may read (codex-api.mjs), the log that is both its memory and
   its eval set (codex-log.mjs), and this — the verb, the turn's bookkeeping, and the hook halves. */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, join, resolve } from "node:path";

import { CONFIG_PATH, configDir, readJson, userConfig, writeJsonPrivate } from "./resolve/config.mjs";
import { fail } from "./resolve/settings.mjs";
import { flags, partition, pullRepeated } from "./resolve/flags.mjs";
import { didYouMean } from "./suggest.mjs";
import {
  MODEL,
  askApi,
  bundle,
  gated,
  inside,
  modelBehind,
  canonical,
  needed,
  onlyNeeds,
  withDiffs,
  profile,
  promptFor,
  sameFamily,
  servedPrompt,
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
/* Model calls in total, not extra rounds: three covered every consult measured, and the last one is
   always told it is the last, so the cap is what the caller is billed for and not one more. */
const DEFAULT_CALLS = 3;

const USAGE = [
  "Usage: forge codex <consult|verdict|pending|show|log> [args]",
  "GPT-5 Codex reviews the files you name, streamed over the gateway's own API. It has no tools:",
  "the files are sent with the prompt, and the log is what gives it a memory of this repository.",
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
  "  maxTokens                 reply ceiling (default 8000)",
  "  rounds                    model calls one consult may make, the last forced to answer (3)",
  "",
  "  --diff         send each file's diff and refuse findings that are only about code this turn",
  "                 did not touch. Raises precision more than anything else.",
  "  --base ref     what to diff against; implies --diff. HEAD unless you say otherwise.",
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

const writeState = (values) => {
  const merged = { ...readState(), ...values };
  try {
    mkdirSync(configDir("forge"), { recursive: true });
    writeJsonPrivate(STATE_PATH, merged);
  } catch {
    /* A turn whose bookkeeping cannot be written still consults on files named on the line. */
  }
  return merged;
};

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
const contained = (root, given) => {
  const rel = inside(root, given);
  if (!rel) fail(`codex: ${given} is not a readable file inside ${root}.`);
  return rel;
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
  const held = readState();
  const left = pendingIn(held, root).filter((rel) => !rels.includes(rel));
  writeState({ turns: { ...turnsOf(held), [root]: { files: left, at: Date.now() } } });
  return left;
};

/* An entry that cannot be tied to code cannot be checked, so an eval over the log needs the commit. */
const commitAt = (root) => {
  const head = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" });
  if (head.status !== 0) return {};
  const changed = spawnSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" });
  return { head: (head.stdout ?? "").trim(), dirty: Boolean((changed.stdout ?? "").trim()) };
};

/* More than one call, and a bounded number: a round exists only so the reviewer can SEE something
   it was not given, and seeing has a fixed point. It may take two rounds to learn it needs a third
   file — it cannot know that before reading the second — so the cap is rounds and not one extra.
   What it never gets is a round to ACT in: the version of this that could run commands took eleven
   minutes, spawned its own subagents, and had to be killed by pid. */
const BOOLEAN = ["--allow-echo", "--diff"];
const SEVERITIES = ["blocker", "major", "minor"];

const severities = (raw) => {
  if (raw === undefined) return [];
  const asked = raw.split(",").map((one) => one.trim().toLowerCase()).filter(Boolean);
  for (const one of asked) if (!SEVERITIES.includes(one)) fail(didYouMean("severity", one, SEVERITIES));
  return asked;
};

const callBudget = () => {
  const raw = userConfig().codex?.rounds;
  if (raw === undefined) return DEFAULT_CALLS;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    fail(`codex: \`codex.rounds\` in ${CONFIG_PATH} takes an integer of 1 or more, not \`${raw}\`.`);
  }
  return value;
};

const rounds = async (values, model, opening, root, rels, onDelta) => {
  const signal = AbortSignal.timeout(BUDGET_MS);
  const calls = callBudget();
  const messages = [{ role: "user", content: opening }];
  const served = [];
  const refused = [];
  let asked = 0;
  for (let call = 1; ; call += 1) {
    const last = call === calls;
    console.error(`codex: call ${call} of ${calls}${served.length ? ` with ${served.length} file(s) it asked for` : ""}...`);
    const held = await askApi(values, model, messages, { onDelta: gated(onDelta), signal });
    if (!onlyNeeds(held.text)) return { ...held, served, refused, asked, calls: call };
    /* A last call that still only asks for files has not reviewed anything, and reporting it as a
       consult would clear the turn's pending list in exchange for nothing. */
    if (last) {
      throw new Error(
        `it spent all ${calls} calls asking for context and never reviewed. Raise \`codex.rounds\`, `
        + `or name the files it kept asking for: ${needed(held.text, root, []).wanted.join(", ") || "none servable"}.`,
      );
    }
    asked += 1;
    const wanted = needed(held.text, root, [...rels, ...served]);
    refused.push(...wanted.refused);
    served.push(...wanted.wanted);
    messages.push({ role: "assistant", content: held.text });
    messages.push({
      role: "user",
      content: servedPrompt(bundle(root, wanted.wanted), wanted.refused, call + 1 === calls),
    });
  }
};

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
  };
};

const consult = async (given) => {
  const { problem, values, path } = profile();
  if (problem) fail(`codex: ${problem}. It needs the gateway the consult is sent to.`);
  const root = repoRoot(process.cwd());
  if (!root) fail("codex: not in a git repository, so there is nothing to review against.");
  const { named, risks, only, allowEcho, base } = consultArgs(given);
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
    const opening = promptFor(intent, parts, history, { risks, only });
    const held = await rounds(values, model, opening, root, rels, streamed);
    process.stdout.write("\n");
    logConsult({
      ...record,
      kind: "consult",
      ms: Date.now() - started,
      ok: true,
      usage: held.usage,
      stop: held.stop,
      served: held.served,
      refused: held.refused,
      asked: held.asked,
      calls: held.calls,
      reply: held.text,
    });
    const left = clearConsulted(root, rels);
    if (held.served.length) console.error(`codex: it asked for ${held.served.join(", ")}; sent and re-asked.`);
    if (held.asked && !held.served.length) console.error("codex: it asked for files; none were servable.");
    if (held.refused.length) console.error(`codex: refused to send ${held.refused.join(", ")}.`);
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
  console.log(`pending   : ${waiting.length ? waiting.join(", ") : "nothing"}`);
  console.log(`log       : ${LOG_PATH}  (${consults(entries).length} consult(s))`);
};

/* The hook records; it never reviews. What it asks for is one consult at the end of the turn, with
   the intent attached — a review that knows what you were trying to do is a different review. */
export const hookRecord = (event, paths) => {
  if (process.env.FORGE_CODEX_DISABLE === "1") return null;
  let held = readState();
  let announce = null;
  for (const path of paths) {
    const root = repoRoot(dirname(resolve(path)));
    if (!root) continue;
    const rel = inside(root, path);
    if (!rel || !recordable(rel)) continue;
    const { files, added, first } = afterTouch(held, root, rel);
    if (!added) continue;
    held = writeState({ turns: { ...turnsOf(held), [root]: { files, at: Date.now() } } });
    if (first) announce = rel;
  }
  return announce
    ? `You have changed a document in this turn (${announce}). Before you finish, consult codex — `
      + `GPT-5 Codex, on another provider, with the log's memory of this repository:\n\n`
      + `    echo "what I was doing and why, the plan, and the decisions I made" | forge codex consult\n\n`
      + `Once, at the end, over everything you changed. The files travel with the prompt; the intent `
      + `is the only thing it cannot see, including whatever the advisor said this turn. Then `
      + `\`forge codex verdict\`. Why, and what to do with what comes back: \`forge hooks --why codex-turn\`.`
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
      writeState({ turns: { ...(held.turns ?? {}), [root]: { files: [], at: Date.now() } } });
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
