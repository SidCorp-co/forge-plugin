/* The log is codex's memory and its eval set at once. It has no session of its own — one HTTPS request knows nothing of the last — so continuity is these entries replayed, and scoring the advice later is the same file read a different way. This half is the file itself: what is written to it, what is read back, and every question answerable off the rows without reading a word of what the reviewer wrote. docs/cli/codex-the-log.md. */
import { isAbsolute, join } from "node:path";

import { appendJsonl, jsonlAt, jsonlBytes } from "../hooks/log/hook-log-file.mjs";
import { configDir, NO_SESSION, sessionSourced } from "../resolve/config.mjs";
import { masked } from "../hooks/log/scrub.mjs";

export const logPath = () => join(configDir("forge"), "codex-log.jsonl");
/* One seat, not a list of the fields that may carry a credential (the transport's); at every depth, since the last leak got through a redaction that missed one; per value, since a line-wide mask eats a quote. */
export const maskedDeep = (value) => {
  if (typeof value === "string") return masked(value);
  if (Array.isArray(value)) return value.map(maskedDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, one]) => [key, maskedDeep(one)]));
  }
  return value;
};

/** Which run is writing, and the source row that answered for its id — an inherited id is a wave's and a saved one a machine's, so either alone attributes a wave's rulings to one run. Minting none: docs/cli/codex-the-log.md. */
export const writingRun = () => {
  const held = sessionSourced();
  return held.id ? { run: held.id, runFrom: held.source } : { runFrom: NO_SESSION };
};

/* It warns and carries on: failing closed would mean a full disk costs the review itself. */
export const logConsult = (record) => {
  try {
    appendJsonl(logPath(), maskedDeep({ ...record, ...writingRun() }), configDir("forge"));
    return true;
  } catch (error) {
    console.error(`codex: could not write ${logPath()} (${error.message}); this consult is unlogged.`);
    return false;
  }
};

export const logEntries = () => jsonlAt(logPath());

export const logBytes = () => jsonlBytes(logPath());

/** The kind a reading that is not a review writes under. It is named here, beside the readers that
 *  decide what a consult is, because the claim is about them: every figure `forge codex stats`,
 *  `eval` and `replay` print goes through `answered()`, so a row under this kind is counted by none
 *  of them and the consult corpus is what it was before the reading was taken. */
export const DIAGNOSTIC = "diagnostic";

export const consults = (entries) => entries.filter((one) => one.kind === "consult");

/* A failed consult carries no advice: "3 accepted" against a gateway timeout is not a verdict. */
export const isAnswered = (one) => one.kind === "consult" && Boolean(one.ok) && Boolean(one.reply);

export const answered = (entries) => entries.filter(isAnswered);

/* Every hundredth answered consult, the log says so and names the verb that reads it — by this record's own place in the log, and identified by more than its id. docs/cli/codex-the-log.md. */
export const MARK = 100;

export const markedAt = (ordinal) => (ordinal > 0 && ordinal % MARK === 0 ? ordinal : null);

export const markOf = (entries, record) => {
  const of = (one) => `${one.id ?? ""}|${one.at}|${one.root ?? ""}`;
  const same = (one) => of(one) === of(record);
  const mark = markedAt(answered(entries).findLastIndex(same) + 1);
  /* `entries` rides along because the caller's next act is to slice them: the log as it stood when this record landed is the mark's window, and reading the file again would cost the parse twice and pick up whatever landed in between. */
  return mark
    ? { mark, at: entries.findLastIndex(same), said: `codex: ${mark} answered consults in the log — \`forge codex eval\`.`, entries }
    : null;
};

export const loggedWithMark = (record) => (logConsult(record) ? markOf(logEntries(), record) : null);

/** Text kept only where git never can — an absolute `rel` is `locate`'s word for outside the root, and a file inside it is the review payload the log is not a copy of. A cap drops the text whole and names itself, since a row that just left it out would read as one from before this (ISS-531). A row carries the text sent and not the file: a clipped part went clipped, and its `sha` is of the whole. */
export const KEPT_CHARS = 20_000;
export const KEPT_TOTAL = 40_000;

export const sentFrom = (parts) => {
  let room = KEPT_TOTAL;
  return parts.map((part) => {
    const row = { rel: part.rel, sha: part.sha, chars: part.chars, clipped: Boolean(part.clipped) };
    if (!isAbsolute(part.rel) || typeof part.text !== "string") return row;
    if (part.text.length > KEPT_CHARS) return { ...row, textOmitted: "the file cap" };
    if (part.text.length > room) return { ...row, textOmitted: "the record cap" };
    room -= part.text.length;
    return { ...row, text: part.text };
  });
};

/* Paired on `id`, which the finished entry copies from the started one. An unpaired start is a consult that died rather than one that failed, and only writing the start down tells them apart. */
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

const sharing = (one, rels) => (one.files ?? []).some((file) => rels.includes(file));

/** The answered consults of this root naming any of these files, oldest first: what a recheck here follows, and what codex-read.mjs asks the same question of. */
export const judgedBy = (entries, root, rels) =>
  answered(entries).filter((one) => one.root === root && sharing(one, rels));

/* A `sent` entry is not a body: `bundle` records one for a file it could not read, and a clipped one, a missing one and an empty one each close a review on something nobody read. */
export const bodied = (one) => one && !one.clipped && Number(one.chars) > 0;

/** What of this set a consult did not read whole, and whether it read the whole of it: `send` bodies with every file among its own and a whole body carried for each. The recheck explains a shortfall and the ship names the head there was none at, so what "whole" is has one home. Each of the three clauses is carried out beside the answer, `diffs` for the send mode as `unread` and `part` are for the set, because a caller that has only `whole: false` has to guess which one refused and names the wrong one (ISS-1542). */
export const shortOfWhole = (one, rels) => {
  const unread = rels.filter((rel) => !(one?.files ?? []).includes(rel));
  const carried = new Map((one?.sent ?? []).map((sent) => [sent.rel, sent]));
  const part = rels.filter((rel) => !unread.includes(rel) && !bodied(carried.get(rel)));
  const diffs = one?.send !== "bodies";
  return { unread, part, diffs, whole: !diffs && !unread.length && !part.length };
};

/* The passes one run took over one clean head, keyed on both: a shared head pins shared content only where the tree was clean at each, and one writing run is what makes them a sequence somebody declared rather than two unrelated consults having touched the same file at the same commit. Groups of one are left out, being what the single-consult answer already covers. */
const sequencesIn = (own) => {
  const held = new Map();
  for (const one of own) {
    if (one.dirty || one.send !== "bodies" || !one.run) continue;
    const key = `${one.head} ${one.run}`;
    held.set(key, [...(held.get(key) ?? []), one]);
  }
  return [...held.values()].filter((group) => group.length > 1);
};

const jointlyWhole = (group, rels) => {
  const carried = new Set();
  for (const one of group) {
    for (const rel of rels) if (shortOfWhole(one, [rel]).whole) carried.add(rel);
  }
  return carried.size === rels.length;
};

/** The last answered consult of this root that read the whole of this set at a recorded head — the read a review was earned by — or null. A set too large for one bodies pass is read across several, so a run's own sequence of them at one clean head answers here as one pass does, carrying `covering` for how many it took. An empty set answers null here rather than in `shortOfWhole`, which the recheck also reads: every consult ever taken read the empty set whole. What a `dirty` head is worth is the caller's, since only a caller comparing histories is troubled by it. */
export const wholeReadOf = (entries, root, rels) => {
  if (!rels.length) return null;
  const own = answered(entries).filter((one) => one.root === root && one.head);
  let at = own.findLastIndex((one) => shortOfWhole(one, rels).whole);
  let found = at < 0 ? null : own[at];
  for (const group of sequencesIn(own)) {
    const last = own.lastIndexOf(group.at(-1));
    if (last <= at || !jointlyWhole(group, rels)) continue;
    at = last;
    found = { ...group.at(-1), covering: group.length };
  }
  return found;
};
