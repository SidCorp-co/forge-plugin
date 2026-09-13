/* The readings both harness evals write at a mark and read back as a pinned before window: one store, kept as the
   consult log keeps its entries. A runs reading carries the root whose corpus was counted; a consult reading is the device's and carries none. docs/cli/stats-the-mark.md. */
import { join } from "node:path";

import { appendJsonl, jsonlAt } from "../hooks/hook-log-file.mjs";
import { configDir } from "../resolve/config.mjs";
import { fail } from "../resolve/settings.mjs";

export const RUNS = "runs";
export const CONSULTS = "consults";
/* A kind of its own, so a count mark and the release that landed at that count never compete. */
export const RELEASES = "releases";

export const marksPath = () => join(configDir("forge"), "eval-marks.jsonl");

const readAll = () => jsonlAt(marksPath());

export const marksOf = (kind, root = null) =>
  readAll().filter((one) => one.kind === kind && (root === null || one.root === root));

/* A release is one version and not one count: two can land at the same count, and holding them by count discards the second and leaves the version nothing to resolve. */
const identityOf = (record) => (record.kind === RELEASES ? record.version ?? null : record.mark);

const sameMark = (held, record) =>
  held.kind === record.kind && identityOf(held) === identityOf(record) && (held.root ?? null) === (record.root ?? null);

export const WRITTEN = "written";
export const HELD = "held";
export const FAILED = "failed";

/** Appends unless the same reading is held, and says which — written, held or failed. A failed write is said and carried past, as the consult log's is: the mark line it accompanies is worth more than a stats file. No two writers race here — a runs mark is written under the ship's lock, and a consult crossing belongs to exactly the record that landed on it. */
export const writeMark = (record) => {
  try {
    if (readAll().some((one) => sameMark(one, record))) return HELD;
    appendJsonl(marksPath(), record, configDir("forge"));
    return WRITTEN;
  } catch (error) {
    console.error(`stats: could not write ${marksPath()} (${error.message}); this reading is not held.`);
    return FAILED;
  }
};

export const wroteSaid = (outcome, mark, verb) => ({
  [WRITTEN]: `The reading is held as mark ${mark} (\`${verb} --against ${mark}\`).`,
  [HELD]: `Mark ${mark} was already held, so nothing was written.`,
  [FAILED]: `The reading could not be written, so mark ${mark} is not held.`,
}[outcome]);

/** The same three outcomes said in a release's own identity, a count being none of it. */
export const releaseSaid = (outcome, version) => ({
  [WRITTEN]: "The reading is held at that version.",
  [HELD]: `Version ${version} was already held, so nothing was written.`,
  [FAILED]: `The reading could not be written, so ${version} holds none.`,
}[outcome]);

/* Pulled out before `flags`, which cannot read a flag standing alone: alone is `null`, the newest. */
export const againstIn = (argv, verb) => {
  const at = argv.indexOf("--against");
  if (at < 0) return { against: undefined, rest: argv };
  const next = argv[at + 1];
  if (next === undefined || next.startsWith("--")) return { against: null, rest: argv.filter((one, n) => n !== at) };
  const mark = Number(next);
  if (!Number.isInteger(mark) || mark < 1) fail(`${verb}: --against takes a mark — the count the mark line printed — not \`${next}\`.`);
  return { against: mark, rest: argv.filter((one, n) => n !== at && n !== at + 1) };
};

/* Pulled out before `flags` as `againstIn` is; a version where that takes a count. */
export const sinceReleaseIn = (argv) => {
  const at = argv.indexOf("--since-release");
  if (at < 0) return { release: undefined, rest: argv };
  const next = argv[at + 1];
  if (next === undefined || next.startsWith("--")) return { release: null, rest: argv.filter((one, n) => n !== at) };
  return { release: next, rest: argv.filter((one, n) => n !== at && n !== at + 1) };
};

/** The release reading a version names, or the newest held for this project. */
export const resolveRelease = (root, asked, { verb, list, writes }) => {
  const held = marksOf(RELEASES, root);
  if (!held.length) {
    fail(`${verb}: --since-release names no reading — none is held for this project yet; ${writes}. \`${list}\` lists what is held.`);
  }
  if (asked === null) return held.at(-1);
  const found = held.findLast((one) => one.version === asked);
  if (found) return found;
  fail(`${verb}: no release reading for version ${asked} on this project. \`${list}\` lists what is held.`);
  return null;
};

/** The reading `--against` names, or the newest of the scope; refused by name, with the list subject. */
export const resolveAgainst = (kind, asked, { root = null, verb, list, writes }) => {
  const held = marksOf(kind, root);
  const scope = kind === RUNS ? "for this project" : "on this device";
  if (asked === null) {
    if (held.length) return held.at(-1);
    fail(`${verb}: --against names no reading — none is held ${scope} yet; ${writes}. \`${list}\` lists what is held.`);
  }
  const found = held.findLast((one) => one.mark === asked);
  if (found) return found;
  fail(`${verb}: no ${kind} reading at mark ${asked} ${scope}. \`${list}\` lists what is held.`);
  return null;
};

/** The earliest reach any reading held for this project records, where that reaches further back
 *  than the corpus does now, and null where none does. A store that lost its history holds as few
 *  runs as one that never had any, and the record is the only thing on this machine that separates
 *  them. It says depth was once read and is gone; it never says why, and its silence says nothing at
 *  all — a mark is a snapshot of the moment a ship took it, not a history of the store.
 *  Both kinds are asked, a release mark being the one written at every release rather than at a
 *  multiple of the window, so the deepest reading is usually one of those. */
/* The corpus floor the reading carries, or the recent window's floor where it carries none. A window
   on a deep corpus begins long after the corpus does, so a mark read by its window alone hides most
   of the depth it was taken over; a mark written before the reading carried a floor gives what it
   has, which understates the loss rather than inventing one (consult c5d393 F1). */
const reachedBy = (one) => one.comparability?.reach?.from ?? one.now?.profile?.from;

export const earlierReach = (root, from) => {
  const held = [...marksOf(RUNS, root), ...marksOf(RELEASES, root)]
    .map((one) => ({ one, at: reachedBy(one) }))
    .filter((row) => Number.isFinite(row.at) && row.at < from);
  if (!held.length) return null;
  const deepest = held.reduce((deep, row) => (row.at < deep.at ? row : deep));
  return {
    from: deepest.at,
    by: deepest.one.kind === RELEASES ? `release ${deepest.one.version}` : `mark ${deepest.one.mark}`,
  };
};

const WHEN = 16;
const stamped = (iso) => iso.slice(0, 16).replace("T", " ");
const at = (ms) => stamped(new Date(ms).toISOString());

/** `earlierReach` above, paired with the floor it was asked about, and only ever read off a reading
 *  of the whole corpus: under a window the floor is the flag's own selection boundary, and a reach
 *  taken from it would report lost depth on every windowed call. */
export const reachOf = (root, from) =>
  (Number.isFinite(from) ? { from, earlier: earlierReach(root, from) } : null);

/** The reach said, in the words both subjects say it in. The second clause is what tells a corpus
 *  swept an hour ago from one that is young — and where nothing is held it says the record is silent,
 *  never that the corpus was never deeper, which no record here can know. */
export const reachSaid = (reach) =>
  `the corpus reaches back to ${at(reach.from)}; `
  + (reach.earlier
    ? `${reach.earlier.by}'s reading reached back to ${at(reach.earlier.from)}, `
      + "so depth this project once read is no longer here"
    : "no reading held for this project records an earlier reach, which is not to say the corpus was "
      + "never deeper — a mark is a snapshot and not a history");


/** The `--against` line both evals print, and the one sentence saying the two windows meet. The count is each eval's own unit and the span its own reading; the wording and the two spaces are neither, and a case pinning them could otherwise drift in one harness alone. */
export const heldAtMark = (count, mark, span, overlapping) =>
  `the ${count} held at mark ${mark}  ${span}`
  + (overlapping ? "  — overlapping the recent window, which begins before this one ends" : "");

/** One line per reading, newest first; `describe` says the recent window's size and bounds in its kind's units. */
export const markLines = (records, describe) =>
  [...records].reverse().map((one) => `mark ${String(one.mark).padStart(5)}  ${stamped(one.at).padEnd(WHEN)}  ${describe(one)}`);
