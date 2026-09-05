/* The log is codex's memory and its eval set at once. It has no session of its own — one HTTPS
   request knows nothing of the last — so continuity is these entries replayed, and scoring the
   advice later is the same file read a different way. docs/cli/codex-the-log.md. */
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { configDir, userConfig } from "../resolve/config.mjs";
import { masked } from "../hooks/hook-log.mjs";
import { typed } from "../hooks/shell-spans.mjs";
import { fail } from "../resolve/settings.mjs";
import { flags, pullRepeated } from "../resolve/flags.mjs";

export const LOG_PATH = join(configDir("forge"), "codex-log.jsonl");
export const BUDGET_MS = Number(userConfig().codex?.budgetMs || 900_000);

const HISTORY_PAIRS = 3;
const HISTORY_CHARS = 6000;
const INTENT_CHARS = 1500;
const LOG_TAIL = 10;

/* One seat, not a list of the fields that may carry a credential (rpc.mjs); at every depth, since the
   last leak got through a redaction that missed one; per value, since a line-wide mask eats a quote. */
const maskedDeep = (value) => {
  if (typeof value === "string") return masked(value);
  if (Array.isArray(value)) return value.map(maskedDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, one]) => [key, maskedDeep(one)]));
  }
  return value;
};

/* It warns and carries on: failing closed would mean a full disk costs the review itself. */
export const logConsult = (record) => {
  try {
    mkdirSync(configDir("forge"), { recursive: true });
    if (!existsSync(LOG_PATH)) closeSync(openSync(LOG_PATH, "a", 0o600));
    appendFileSync(LOG_PATH, `${JSON.stringify(maskedDeep(record))}\n`);
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

/* Every hundredth answered consult, the log says so and names the verb that reads it — by this
   record's own place in the log, and identified by more than its id. docs/cli/codex-the-log.md. */
export const MARK = 100;

export const markedAt = (ordinal) => (ordinal > 0 && ordinal % MARK === 0 ? ordinal : null);

export const markOf = (entries, record) => {
  const of = (one) => `${one.id ?? ""}|${one.at}|${one.root ?? ""}`;
  const mark = markedAt(answered(entries).findLastIndex((one) => of(one) === of(record)) + 1);
  return mark ? `codex: ${mark} answered consults in the log — \`forge codex eval\`.` : null;
};

export const loggedWithMark = (record) => (logConsult(record) ? markOf(logEntries(), record) : null);

/* The hash the latest answered consult for this checkout sent for one file; null when none did. */
export const sentShaOf = (entries, root, rel) => {
  for (const one of answered(entries).reverse()) {
    if (one.root !== root) continue;
    const hit = (one.sent ?? []).find((sent) => sent.rel === rel);
    if (hit) return hit.sha ?? null;
  }
  return null;
};

/* Paired on `id`, which the finished entry copies from the started one. An unpaired start is a
   consult that died rather than one that failed, and only writing the start down tells them apart. */
export const pairedLog = (entries) => {
  const finished = new Set(consults(entries).map((one) => one.id ?? one.at));
  return entries.filter((one) => one.kind !== "started" || !finished.has(one.id ?? one.at));
};

/* A review replayed without what the caller did with it made "resolved / still open" a guess. */
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
        reply: digestOf(one.reply, held),
      };
    });
};

/* The rulings and the numbered findings, each with what became of it — not the prose around them.
   The gateway cached none of 108 replays, so every call paid for the whole reply three times over. */
const RULING_LINE = /^\s*(\d+)\.\s+\*\*(CONFIRMED|REFUTED|CANNOT TELL)\*\*.*$/gimu;
export const rulingsIn = (reply) =>
  [...String(reply ?? "").matchAll(RULING_LINE)].map(([line, n, ruling]) => ({ n: Number(n), ruling: ruling.toUpperCase(), line }));

export const digestOf = (reply, held = null) => {
  const findings = numbered(reply);
  const rulings = rulingsIn(reply);
  const counted = countedIn(reply);
  if (!findings.length && !rulings.length && !counted) return String(reply ?? "").slice(0, HISTORY_CHARS);
  return [
    ...rulings.map((one) => one.line.trim().slice(0, FINDING_CHARS)),
    `CODEX: ${counted ? counted.total : findings.length} findings`,
    ...findings.map((one) => {
      const did = outcomeOf(held, one.id);
      return `- ${one.id} — ${one.text}${did ? ` → ${did}` : ""}`;
    }),
  ].join("\n").slice(0, HISTORY_CHARS);
};

/* A finding's bullet names a severity; a verdict on a risk names its ruling, whatever else its head
   says, and a resolved one is not re-asked. Anchored to a file the round is about, or unanchored. */
const FINDING = /^\s*[-*]\s+\*\*([^*]*\b(?:blocker|major|minor)\b[^*]*)\*\*\s*(.+)$/gimu;
const RULING = /\b(?:resolved|confirmed|refuted|cannot tell)\b/iu;
const ANCHOR = /`([^`:\s]+):\d+(?:-\d+)?`/u;
const FINDING_CHARS = 400;

const ID = /^\s*F(\d+)\b\s*[—-]?\s*/u;

/* Each finding with its id, `F<n>` as the reply numbered it or by its place in the whole reply where
   it did not — before any file filter, so a recheck on one file keeps the ids a verdict was given against. */
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

/* `--accepted F1,F3 --rejected F2=why`, by id and never by count: 185 accepted to 14 rejected was the
   count form saying nothing. An id the reply never gave, or one given to both sides, is refused: a
   verdict is what the next consult reads "still open" from. A comma opens a new entry only where an id
   follows, so a reason may contain one. */
const NEXT = /,(?=\s*F\d+\b)/u;
const spelled = (raw) => {
  const out = new Map();
  for (const one of String(raw ?? "").split(NEXT).map((part) => part.trim()).filter(Boolean)) {
    const [id, ...why] = one.split("=");
    out.set(id.trim(), { id: id.trim(), why: why.join("=").trim() });
  }
  return [...out.values()];
};
const isCount = (raw) => raw !== undefined && /^\d+$/u.test(String(raw).trim());

export const verdictRecord = (last, { accepted, rejected, note }, prior = null) => {
  const at = new Date().toISOString();
  const base = { kind: "verdict", at, of: last.id ?? last.at, files: last.files, ...(note ? { note } : {}) };
  const known = numbered(last.reply).map((one) => one.id);
  const made = known.length ? `it made ${known.join(", ")}` : "it made no findings";
  if (isCount(accepted) || isCount(rejected)) {
    return { problem: `a verdict names findings, not counts — --accepted F1,F3 --rejected F2=why; consult ${base.of}: ${made}.` };
  }
  if (accepted === undefined && rejected === undefined) {
    if (known.length) return { problem: `consult ${base.of} made ${known.join(", ")}: say which you accepted and which you rejected.` };
    return { record: { ...base, accepted: 0, rejected: 0, kept: [], dropped: {} }, undecided: 0 };
  }
  const kept = spelled(accepted);
  const dropped = spelled(rejected);
  for (const { id } of [...kept, ...dropped]) {
    if (!known.includes(id)) return { problem: `consult ${base.of} made no finding ${id}; it made ${known.join(", ") || "none"}.` };
  }
  const twice = kept.map((one) => one.id).filter((id) => dropped.some((one) => one.id === id));
  if (twice.length) return { problem: `${twice.join(", ")} cannot be both accepted and rejected.` };
  const record = { ...base, ...joined(prior, kept, dropped, known.length) };
  return { record, undecided: undecidedIn(known, record).length };
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
export const recheckPlan = (entries, root, rels) => {
  const judged = answered(entries).filter((one) => one.root === root && sharing(one, rels)).at(-1);
  if (!judged) return null;
  const held = verdictsBy(entries).get(judged.id ?? judged.at);
  const findings = numbered(judged.reply, rels);
  return {
    judged,
    ids: findings.map((one) => one.id),
    /* The defect, with the legend: "re-verify" drew CONFIRMED for a fix that held, then REFUTED. */
    risks: findings.map((one) => {
      const did = outcomeOf(held, one.id);
      return `Your earlier finding ${one.id} still stands in the tree as it is now — ${one.text}.${
        did ? ` What I then did: ${did.slice(0, FINDING_CHARS)}` : ""} (CONFIRMED = the defect is still there; REFUTED = it is fixed, or was never real.)`;
    }),
  };
};

export const recheckRisks = (entries, root, rels) => recheckPlan(entries, root, rels)?.risks ?? [];

/** The range a recheck sends where no file was named: the judged consult's own, narrowed out of what an aged base now offers and never widened past it; null where nothing drops. docs/cli/codex-the-consult.md. */
export const recheckRange = (plan, rels) => {
  const judged = plan?.judged?.files;
  if (!judged?.length) return null;
  const kept = rels.filter((rel) => judged.includes(rel));
  return kept.length && kept.length < rels.length ? kept : null;
};

/* Six and a count in the sentence keeps a refusal readable; the command carries every path, since a pass over six of thirty earns nothing while looking as though it did — quoted where a shell would split it, pathed where this CLI's own parser would eat it as a flag. */
const SHOWN = 6;
const quoted = (one) => (one.startsWith("-") ? `./${one}` : typed(one));
const listed = (rels) => {
  const shown = rels.slice(0, SHOWN).map(quoted).join(" ");
  return rels.length > SHOWN ? `${shown} and ${rels.length - SHOWN} more` : shown;
};

/** Why a recheck has nothing to verify and which pass does earn the review, or null where it has.
 *  Three unlike situations shared one sentence naming no route, so it travelled by hand (ISS-51). */
export const recheckOwed = (plan, rels) => {
  if (plan?.risks.length) return null;
  const read = `Do this: \`echo "<what you were doing>" | forge codex consult --send bodies ${rels.map(quoted).join(" ")}\``;
  if (!plan) {
    return `--recheck answers an earlier consult's findings, and no consult in the log has answered on ${listed(rels)}.\n`
      + `${read} — the read of the whole set is the pass a review is earned by, and a recheck follows one of its findings.`;
  }
  const of = plan.judged.id ?? plan.judged.at;
  /* The last consult sharing ANY of these files. `files` is what it was about, `sent` what it carried,
     and a `sent` entry is not a body — `bundle` records one for a file it could not read. Half a set,
     a clipped body, a missing entry and an empty one each close a review on something nobody read. */
  const unread = rels.filter((rel) => !(plan.judged.files ?? []).includes(rel));
  const carried = new Map((plan.judged.sent ?? []).map((one) => [one.rel, one]));
  const whole = (one) => one && !one.clipped && Number(one.chars) > 0;
  const part = rels.filter((rel) => !unread.includes(rel) && !whole(carried.get(rel)));
  if (plan.judged.send === "bodies" && !unread.length && !part.length) {
    return `consult ${of} read this set whole and found nothing${plan.judged.head ? `, taken at ${plan.judged.head}` : ""}: `
      + "that is the whole-set read a review is earned by, and a recheck has nothing to verify against it. It read a "
      + "working tree, so the head is where the pass was taken and not what it read.\n"
      + `${read} — only where the tree has moved since, which this cannot see and you can.`;
  }
  const short = unread.length
    ? ` It read ${listed(plan.judged.files ?? [])}, so ${listed(unread)} ${unread.length === 1 ? "was" : "were"} not among them.`
    : "";
  const cut = part.length ? ` It carried no whole body for ${listed(part)}, so that much of the set is unread.` : "";
  return `consult ${of} is the last answered one on these files and it found nothing, so there is nothing to recheck.${short}${cut}\n`
    + `${read} — the read of the whole set is what earns the review; a recheck follows a finding and nothing else.`;
};
/* A recheck's rulings are the verdict on what it re-verified: REFUTED is a finding the tree no longer
   shows. 37 consults with findings closed with nothing recorded, and 10 of them had a recheck that
   said exactly what became of each. The n-th ruling answers the n-th risk, whatever else the reply
   says; a CONFIRMED one stays open, and the caller's own verdict overrides this one. */
export const verdictFromRulings = (plan, offset, reply, recheckId, prior = null) => {
  const rulings = new Map(rulingsIn(reply).map((one) => [one.n, one.ruling]));
  const kept = [];
  const open = [];
  plan.ids.forEach((id, at) => {
    const ruling = rulings.get(offset + at + 1);
    if (ruling === "REFUTED") kept.push(id);
    else if (ruling === "CONFIRMED" || ruling === "CANNOT TELL") open.push(id);
  });
  if (!kept.length && !open.length) return null;
  const of = plan.judged.id ?? plan.judged.at;
  const note = `from recheck ${recheckId}${open.length ? `; still open: ${open.join(", ")}` : ""}`;
  const held = joined(prior, kept.map((id) => ({ id })), open.map((id) => ({ id, reopen: true })), numbered(plan.judged.reply).length);
  return {
    record: { kind: "verdict", at: new Date().toISOString(), of, files: plan.judged.files, ...held, from: recheckId, note },
    said: `verdict on ${of} recorded from this recheck — accepted: ${kept.join(", ") || "none"}`
      + `${open.length ? `; still open: ${open.join(", ")}` : ""}. \`forge codex verdict --of ${of}\` overrides it.`,
  };
};

/* Added to the prior record, never over it; the newer word wins, and a reopened finding leaves both sides. */
const joined = (prior, kept, dropped, total) => {
  const said = new Set([...kept, ...dropped].map((one) => one.id));
  const keptAll = [...(prior?.kept ?? []).filter((id) => !said.has(id)), ...kept.map((one) => one.id)];
  const droppedAll = {
    ...Object.fromEntries(Object.entries(prior?.dropped ?? {}).filter(([id]) => !said.has(id))),
    ...Object.fromEntries(dropped.filter((one) => !one.reopen).map((one) => [one.id, one.why ?? ""])),
  };
  /* A count-form prior decided every id it never named; only what a recheck reopens is open again.
     Its totals are carried for `log --score`, the rejected side first and the accepted side capped so
     the two never exceed the findings made: a count cannot say which of its ids a later word moved. */
  const counted = Boolean(prior && (prior.counted || (!prior.kept && !prior.dropped)));
  const reopened = [...(prior?.reopened ?? []).filter((id) => !said.has(id)), ...dropped.filter((one) => one.reopen).map((one) => one.id)];
  const rejected = counted ? Math.max(prior.rejected ?? 0, Object.keys(droppedAll).length) : Object.keys(droppedAll).length;
  return {
    accepted: counted ? Math.max(keptAll.length, Math.min(prior.accepted ?? 0, total - rejected)) : keptAll.length,
    rejected,
    kept: keptAll,
    dropped: droppedAll,
    ...(counted ? { counted } : {}),
    ...(reopened.length ? { reopened } : {}),
  };
};

/* The ids a verdict has not decided: a recheck's leaves CONFIRMED and CANNOT TELL open, and the gate
   is about decisions, not records. A count-form verdict from before ids decided everything at once. */
export const undecidedIn = (ids, held) => {
  if (!held) return ids;
  if (held.counted) return ids.filter((id) => held.reopened?.includes(id));
  if (!held.kept && !held.dropped) return [];
  return ids.filter((id) => !held.kept?.includes(id) && !(id in (held.dropped ?? {})));
};

/* For the commit gate. A later consult that found nothing does not answer for an earlier one's findings. */
export const unverdicted = (entries, root) => {
  const scored = verdictsBy(entries);
  const last = answered(entries).filter((one) => one.root === root && numbered(one.reply).length).at(-1);
  if (!last) return null;
  const ids = numbered(last.reply).map((one) => one.id);
  const open = undecidedIn(ids, scored.get(last.id ?? last.at));
  return open.length ? { id: last.id ?? last.at, ids, open, files: last.files ?? [], at: last.at } : null;
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

export const logLine = (stored, full) => {
  const entry = maskedDeep(stored);
  if (entry.kind === "started") {
    return `${entry.id ? `${entry.id}  ` : ""}${entry.at}  ${startedState(entry)} on ${(entry.files ?? []).join(" ")}`;
  }
  if (entry.kind === "verdict") {
    const note = entry.note ? `  ${entry.note}` : "";
    return `${entry.at}  verdict on ${entry.of}: ${entry.accepted} accepted, ${entry.rejected} rejected${note}`;
  }
  const answer = stored.ok ? `${(stored.reply ?? "").length}ch` : `failed: ${entry.error ?? "?"}`;
  const id = entry.id ? `${entry.id}  ` : "";
  const at = entry.head ? `${entry.head}${entry.dirty ? "+dirty" : ""}` : "no commit";
  const served = entry.served?.length ? `  +${entry.served.length} served` : "";
  const counted = countedIn(stored.reply);
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

export const modelKey = (one) => `${one.model ?? one.slot ?? "?"}${one.effort ? ` @${one.effort}` : ""}`;

export const scoreOf = (entries) => {
  const scored = verdictsBy(entries);
  const rows = new Map();
  for (const one of answered(entries)) {
    const key = modelKey(one);
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
    if (one.ms !== undefined) row.seconds.push(Math.round(one.ms / 1000));
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
  const { note, of } = flags(r2, "codex verdict");
  if (!accepted.length && !rejected.length && !note) {
    fail('Usage: forge codex verdict --accepted F1,F3 --rejected F2=why [--note "why"] [--of id]');
  }
  /* This repository's last consult that made findings and heard nothing back, not the last answer:
     after a converged recheck the last answer found nothing, and a verdict landed on it twice. */
  const entries = logEntries();
  const own = answered(entries).filter((one) => !root || one.root === root);
  const last = of
    ? own.find((one) => one.id === of)
    : unverdicted(entries, root) && own.find((one) => one.id === unverdicted(entries, root).id) || own.at(-1);
  if (!last) fail(of ? `codex: no consult ${of} has answered here.` : `codex: no consult has answered${root ? " for this repository" : ""} yet.`);
  const held = verdictRecord(last, {
    accepted: accepted.length ? accepted.join(",") : undefined,
    rejected: rejected.length ? rejected.join(",") : undefined,
    note,
  }, verdictsBy(entries).get(last.id ?? last.at) ?? null);
  if (held.problem) fail(`codex: ${held.problem}`);
  logConsult(held.record);
  console.log(`recorded against consult ${last.id ?? last.at} on ${(last.files ?? []).join(", ")}`);
  if (held.undecided > 0) console.error(`codex: ${held.undecided} finding(s) undecided — say what happened to them.`);
};
