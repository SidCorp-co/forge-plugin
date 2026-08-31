/* The log is codex's memory and its eval set at once. It has no session of its own — one HTTPS
   request knows nothing of the last — so continuity is these entries replayed, and scoring the
   advice later is the same file read a different way. docs/FORGE-CLI.md. */
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { configDir, userConfig } from "./resolve/config.mjs";
import { fail } from "./resolve/settings.mjs";
import { flags } from "./resolve/flags.mjs";

export const LOG_PATH = join(configDir("forge"), "codex-log.jsonl");
export const BUDGET_MS = Number(userConfig().codex?.budgetMs || 900_000);

const HISTORY_PAIRS = 3;
const HISTORY_CHARS = 6000;
const INTENT_CHARS = 1500;
const LOG_TAIL = 10;

/* It warns and carries on: failing closed would mean a full disk costs the review itself. */
export const logConsult = (record) => {
  try {
    mkdirSync(configDir("forge"), { recursive: true });
    if (!existsSync(LOG_PATH)) closeSync(openSync(LOG_PATH, "a", 0o600));
    appendFileSync(LOG_PATH, `${JSON.stringify(record)}\n`);
    return true;
  } catch (error) {
    console.error(`codex: could not write ${LOG_PATH} (${error.message}); this consult is unlogged.`);
    return false;
  }
};

const parsedLine = (line) => {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
};

/* A half-written last line is dropped, not raised: the entries before it are the eval set. */
export const logEntries = () => {
  try {
    return readFileSync(LOG_PATH, "utf8").split("\n").map(parsedLine).filter(Boolean);
  } catch {
    return [];
  }
};

const HEADER = /^CODEX:\s*(\d+)\s*findings?(?:\s*\(([^)]*)\))?/im;
const SEVERITY = /(\d+)\s*(blocker|major|minor)/gi;

/* The reply counts itself, so the count can be checked instead of taken on trust — a verdict of
   "3 accepted" against a review that made five findings is two findings nobody decided. */
export const countedIn = (reply) => {
  const found = HEADER.exec(String(reply ?? ""));
  if (!found) return null;
  const held = { total: Number(found[1]) };
  for (const [, many, name] of (found[2] ?? "").matchAll(SEVERITY)) held[name.toLowerCase()] = Number(many);
  return held;
};

export const consults = (entries) => entries.filter((one) => one.kind === "consult");

/* Only a consult that came back with a review spends advice; a failure licenses the retry. */
export const lastConsultAt = (root, entries = logEntries()) =>
  answered(entries)
    .filter((one) => one.root === root)
    .reduce((latest, one) => Math.max(latest, Date.parse(one.at) || 0), 0);

/* A failed consult carries no advice: "3 accepted" against a gateway timeout is not a verdict. */
export const answered = (entries) => consults(entries).filter((one) => one.ok && one.reply);

/* Paired on `id`, which the finished entry copies from the started one. An unpaired start is a
   consult that died rather than one that failed, and only writing the start down tells them apart. */
export const pairedLog = (entries) => {
  const finished = new Set(consults(entries).map((one) => one.id ?? one.at));
  return entries.filter((one) => one.kind !== "started" || !finished.has(one.id ?? one.at));
};

/* Continuity without a session: this repository's last few exchanges, clipped, replayed. */
/* Joined back from its own record: a review replayed without what the caller did with it made
   "resolved / still open" a guess. */
export const verdictsBy = (entries) => {
  const found = new Map();
  for (const one of entries) if (one.kind === "verdict" && one.of) found.set(one.of, one);
  return found;
};

export const historyFor = (entries, root, pairs = HISTORY_PAIRS) => {
  const scored = verdictsBy(entries);
  return answered(entries)
    .filter((one) => one.root === root)
    .slice(-pairs)
    .map((one) => {
      const held = scored.get(one.id ?? one.at);
      return {
        at: one.at,
        files: one.files ?? [],
        intent: (one.intent ?? "(none given)").slice(0, INTENT_CHARS),
        verdict: held
          ? `${held.accepted} accepted, ${held.rejected} rejected${held.note ? ` — ${held.note}` : ""}`
          : null,
        reply: one.reply.slice(0, HISTORY_CHARS),
      };
    });
};

/* Inside the budget it is in flight; past it, nothing is coming. Reading the second as the first
   is how a log stops being believed. */
export const startedState = (entry, now = Date.now()) => {
  const age = now - Date.parse(entry.at);
  return age <= BUDGET_MS ? `running for ${Math.round(age / 1000)}s` : "started and never reported back";
};

const countFrom = (raw, floor = 1, fallback = LOG_TAIL) => {
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < floor) {
    fail(`Expected an integer of ${floor} or more, not \`${raw}\`.`);
  }
  return value;
};

const logLine = (entry, full) => {
  if (entry.kind === "started") {
    return `${entry.id ? `${entry.id}  ` : ""}${entry.at}  ${startedState(entry)} on ${(entry.files ?? []).join(" ")}`;
  }
  if (entry.kind === "verdict") {
    const note = entry.note ? `  ${entry.note}` : "";
    return `${entry.at}  verdict on ${entry.of}: ${entry.accepted} accepted, ${entry.rejected} rejected${note}`;
  }
  const answer = entry.ok ? `${(entry.reply ?? "").length}ch` : `failed: ${entry.error ?? "?"}`;
  const id = entry.id ? `${entry.id}  ` : "";
  const at = entry.head ? `${entry.head}${entry.dirty ? "+dirty" : ""}` : "no commit";
  const served = entry.served?.length ? `  +${entry.served.length} served` : "";
  const counted = countedIn(entry.reply);
  const many = counted ? `  ${counted.total} finding(s)` : "";
  const head = `${id}${entry.at}  ${entry.model ?? entry.slot ?? "?"}  ${Math.round((entry.ms ?? 0) / 1000)}s  ${at}  ${answer}${many}${served}`;
  const files = `  files  ${(entry.files ?? []).join(" ")}`;
  if (!full) return `${head}\n${files}`;
  /* The bytes that were judged: a field with no reader is a field nobody can trust. */
  const sent = (entry.sent ?? [])
    .map((one) => `  ${one.sha ?? "?"}  ${String(one.chars ?? "?").padStart(6)}  ${one.rel}${one.clipped ? "  clipped" : ""}`)
    .join("\n");
  return [head, files, sent, "", entry.reply ?? entry.error ?? "", ""].filter((one) => one !== null).join("\n");
};

/* `--id` and not `--last 1`: two consults in flight make "the last one" a race. */
export const printLog = (rest) => {
  const { last, id, full } = flags(rest, "codex log", ["--full"]);
  const entries = pairedLog(logEntries());
  if (!entries.length) return console.log(`No consults logged yet. ${LOG_PATH} appears on the first.`);
  if (id) {
    const held = entries.filter((one) => one.id === id || one.of === id);
    if (!held.length) fail(`codex: no consult logged as ${id}.`);
    for (const entry of held) console.log(logLine(entry, full));
    return;
  }
  for (const entry of entries.slice(-countFrom(last))) console.log(logLine(entry, full));
  console.log(`\n${entries.length} logged; ${LOG_PATH}`);
};

/* The reply is half an eval set. Which findings survived contact with the work is the other half,
   and only the caller knows it — so it is recorded, not inferred. */
export const verdict = (rest, root) => {
  const { accepted, rejected, note } = flags(rest, "codex verdict");
  if (accepted === undefined && rejected === undefined) {
    fail('Usage: forge codex verdict --accepted n --rejected n [--note "why"]');
  }
  /* This repository's last answer, not the account's: a verdict typed in one checkout must not land
     on advice given about another. */
  const entries = logEntries();
  const last = answered(entries).filter((one) => !root || one.root === root).at(-1);
  if (!last) fail(`codex: no consult has answered${root ? " for this repository" : ""} yet.`);
  const taken = countFrom(accepted, 0, 0) + countFrom(rejected, 0, 0);
  const counted = countedIn(last.reply);
  if (counted && taken > counted.total) {
    fail(`codex: consult ${last.id ?? last.at} made ${counted.total} finding(s); ${taken} cannot be decided.`);
  }
  logConsult({
    kind: "verdict",
    at: new Date().toISOString(),
    of: last.id ?? last.at,
    files: last.files,
    accepted: countFrom(accepted, 0, 0),
    rejected: countFrom(rejected, 0, 0),
    ...(note ? { note } : {}),
  });
  console.log(`recorded against consult ${last.id ?? last.at} on ${(last.files ?? []).join(", ")}`);
  if (counted && taken < counted.total) {
    console.error(`codex: ${counted.total - taken} of ${counted.total} finding(s) undecided — say what happened to them.`);
  }
};
