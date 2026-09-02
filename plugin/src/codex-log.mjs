/* The log is codex's memory and its eval set at once. It has no session of its own — one HTTPS
   request knows nothing of the last — so continuity is these entries replayed, and scoring the
   advice later is the same file read a different way. docs/FORGE-CLI.md. */
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { configDir, userConfig } from "./resolve/config.mjs";
import { fail } from "./resolve/settings.mjs";
import { flags, pullRepeated } from "./resolve/flags.mjs";

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

const verdictLine = (held) => {
  const kept = held.kept?.length ? ` (${held.kept.join(", ")})` : "";
  const dropped = held.dropped && Object.keys(held.dropped).length
    ? ` (${Object.entries(held.dropped).map(([id, why]) => (why ? `${id}: ${why}` : id)).join("; ")})`
    : "";
  return `${held.accepted} accepted${kept}, ${held.rejected} rejected${dropped}${held.note ? ` — ${held.note}` : ""}`;
};

/* By relevance first: a consult on bash-guard carried three about cli.mjs, because recency was the
   only order. One sharing a file is what "still open" can be answered against. */
const sharing = (one, rels) => (one.files ?? []).some((file) => rels.includes(file));

export const historyFor = (entries, root, pairs = HISTORY_PAIRS, rels = []) => {
  const scored = verdictsBy(entries);
  const own = answered(entries).filter((one) => one.root === root);
  const near = own.filter((one) => sharing(one, rels)).slice(-pairs);
  const room = pairs - near.length;
  const far = room > 0 ? own.filter((one) => !near.includes(one)).slice(-room) : [];
  return [...far, ...near]
    .sort((a, b) => own.indexOf(a) - own.indexOf(b))
    .map((one) => {
      const held = scored.get(one.id ?? one.at);
      return {
        at: one.at,
        files: one.files ?? [],
        intent: (one.intent ?? "(none given)").slice(0, INTENT_CHARS),
        verdict: held ? verdictLine(held) : null,
        reply: one.reply.slice(0, HISTORY_CHARS),
      };
    });
};

/* A finding's bullet names a severity; a verdict on a risk names its ruling, whatever else its head
   says, and a resolved one is not re-asked. Anchored to a file the round is about, or unanchored. */
const FINDING = /^\s*[-*]\s+\*\*([^*]*\b(?:blocker|major|minor)\b[^*]*)\*\*\s*(.+)$/gimu;
const RULING = /\b(?:resolved|confirmed|refuted|cannot tell)\b/iu;
const ANCHOR = /`([^`:\s]+):\d+(?:-\d+)?`/u;
const FINDING_CHARS = 400;

const ID = /^\s*F(\d+)\b\s*[—-]?\s*/u;

/* Each finding with its id, `F<n>` as the reply numbered it or by place in the whole reply where it did
   not — numbered before any file filter, so a recheck on one file keeps the ids a verdict was given
   against. A verdict names one, and a name the reply never gave is a verdict on nothing. */
export const numbered = (reply, files = null) => {
  const seen = new Set();
  return [...String(reply ?? "").matchAll(FINDING)]
    .filter(([, kind]) => !RULING.test(kind))
    .map(([, kind, text], at) => {
      const own = ID.exec(kind);
      return {
        id: `F${own ? own[1] : at + 1}`,
        text: `${kind.replace(ID, "").replace(/:\s*$/u, "")}: ${text}`.slice(0, FINDING_CHARS),
      };
    })
    .filter((one) => !seen.has(one.id) && seen.add(one.id))
    .filter((one) => !files || !ANCHOR.test(one.text) || files.includes(ANCHOR.exec(one.text)[1]));
};

export const findingsIn = (reply, files = null) => numbered(reply, files).map((one) => one.text);

/* `--accepted F1,F3 --rejected F2=why`, or the two counts as before. An id the reply never gave, or one
   given to both sides, is refused: a verdict is what the next consult reads "still open" from. */
const spelled = (raw) => {
  const out = new Map();
  for (const one of String(raw ?? "").split(",").map((part) => part.trim()).filter(Boolean)) {
    const [id, ...why] = one.split("=");
    out.set(id.trim(), { id: id.trim(), why: why.join("=").trim() });
  }
  return [...out.values()];
};
const isCount = (raw) => raw === undefined || /^\d+$/u.test(String(raw).trim());

export const verdictRecord = (last, { accepted, rejected, note }) => {
  const at = new Date().toISOString();
  const base = { kind: "verdict", at, of: last.id ?? last.at, files: last.files, ...(note ? { note } : {}) };
  if (isCount(accepted) && isCount(rejected)) {
    const a = Number(accepted ?? 0);
    const r = Number(rejected ?? 0);
    const counted = countedIn(last.reply);
    if (counted && a + r > counted.total) {
      return { problem: `consult ${base.of} made ${counted.total} finding(s); ${a + r} cannot be decided.` };
    }
    return { record: { ...base, accepted: a, rejected: r }, undecided: counted ? counted.total - a - r : 0 };
  }
  if ((accepted !== undefined && isCount(accepted)) || (rejected !== undefined && isCount(rejected))) {
    return { problem: "one side names findings and the other counts them; say both as ids (F1,F3) or both as counts." };
  }
  const known = numbered(last.reply).map((one) => one.id);
  const kept = spelled(accepted);
  const dropped = spelled(rejected);
  for (const { id } of [...kept, ...dropped]) {
    if (!known.includes(id)) return { problem: `consult ${base.of} made no finding ${id}; it made ${known.join(", ") || "none"}.` };
  }
  const twice = kept.map((one) => one.id).filter((id) => dropped.some((one) => one.id === id));
  if (twice.length) return { problem: `${twice.join(", ")} cannot be both accepted and rejected.` };
  const record = {
    ...base,
    accepted: kept.length,
    rejected: dropped.length,
    kept: kept.map((one) => one.id),
    dropped: Object.fromEntries(dropped.map((one) => [one.id, one.why])),
  };
  return { record, undecided: known.length - kept.length - dropped.length };
};

/* What was done with one finding, when the verdict named it; the note otherwise. */
export const outcomeOf = (held, id) => {
  if (!held) return null;
  if (held.dropped && id in held.dropped) return `rejected${held.dropped[id] ? ` — ${held.dropped[id]}` : ""}`;
  if (held.kept?.includes(id)) return "accepted";
  return held.note ?? null;
};

/* A follow-up round rules on the last consult's findings about these files — another file's would
   clear this one unread. Six open rounds each found a narrower nit; asked to confirm, one converges. */
export const recheckRisks = (entries, root, rels) => {
  const last = answered(entries).filter((one) => one.root === root && sharing(one, rels)).at(-1);
  if (!last) return [];
  const held = verdictsBy(entries).get(last.id ?? last.at);
  return numbered(last.reply, rels).map((one) => {
    const did = outcomeOf(held, one.id);
    return `Your earlier finding ${one.id}, to re-verify against the tree as it stands now — ${one.text}.${
      did ? ` What I then did: ${did.slice(0, FINDING_CHARS)}` : ""}`;
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

/* The eval the log exists for: what each model found, what the caller kept, cached over every input token. */
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
};

export const scoreOf = (entries) => {
  const scored = verdictsBy(entries);
  const rows = new Map();
  for (const one of answered(entries)) {
    const key = `${one.model ?? one.slot ?? "?"}${one.effort ? ` @${one.effort}` : ""}`;
    const row = rows.get(key) ?? { model: key, consults: 0, findings: 0, zero: 0, accepted: 0, rejected: 0, seconds: [], cached: 0, input: 0 };
    const counted = countedIn(one.reply);
    row.consults += 1;
    if (counted) {
      row.findings += counted.total;
      if (counted.total === 0) row.zero += 1;
    }
    const held = scored.get(one.id ?? one.at);
    if (held) {
      row.accepted += held.accepted ?? 0;
      row.rejected += held.rejected ?? 0;
    }
    row.seconds.push(Math.round((one.ms ?? 0) / 1000));
    const usage = one.usage ?? {};
    row.cached += usage.cache_read_input_tokens ?? 0;
    row.input += (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
    rows.set(key, row);
  }
  return [...rows.values()].map((row) => ({ ...row, median: median(row.seconds), seconds: undefined }));
};

const scoreLine = (row) =>
  `${row.model.padEnd(24)} ${String(row.consults).padStart(4)} consults  ${String(row.findings).padStart(4)} findings `
  + `(${row.zero} none)  ${String(row.accepted).padStart(4)} accepted  ${String(row.rejected).padStart(3)} rejected  `
  + `${String(row.median).padStart(4)}s median  ${row.input ? Math.round((row.cached / row.input) * 100) : 0}% cached`;

/* `--id` and not `--last 1`: two consults in flight make "the last one" a race. */
export const printLog = (rest) => {
  const { last, id, full, score } = flags(rest, "codex log", ["--full", "--score"]);
  const entries = pairedLog(logEntries());
  if (!entries.length) return console.log(`No consults logged yet. ${LOG_PATH} appears on the first.`);
  if (score) {
    for (const row of scoreOf(entries)) console.log(scoreLine(row));
    return;
  }
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
  const { values: accepted, rest: r1 } = pullRepeated(rest, "--accepted", "codex verdict");
  const { values: rejected, rest: r2 } = pullRepeated(r1, "--rejected", "codex verdict");
  const { note } = flags(r2, "codex verdict");
  if (!accepted.length && !rejected.length) {
    fail('Usage: forge codex verdict --accepted F1,F3|n --rejected F2=why|n [--note "why"]');
  }
  /* This repository's last answer, not the account's: a verdict typed in one checkout must not land
     on advice given about another. */
  const entries = logEntries();
  const last = answered(entries).filter((one) => !root || one.root === root).at(-1);
  if (!last) fail(`codex: no consult has answered${root ? " for this repository" : ""} yet.`);
  const held = verdictRecord(last, {
    accepted: accepted.length ? accepted.join(",") : undefined,
    rejected: rejected.length ? rejected.join(",") : undefined,
    note,
  });
  if (held.problem) fail(`codex: ${held.problem}`);
  logConsult(held.record);
  console.log(`recorded against consult ${last.id ?? last.at} on ${(last.files ?? []).join(", ")}`);
  if (held.undecided > 0) console.error(`codex: ${held.undecided} finding(s) undecided — say what happened to them.`);
};
