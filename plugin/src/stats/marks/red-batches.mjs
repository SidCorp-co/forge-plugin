/* How a landing resolved each red set, written by the landing and read by `stats runs` and the daily
   page: never read off what the landing printed, since a landing run in the background leaves no
   transcript. Two records a set — one the moment its candidate reads red, one once it is resolved —
   so a set whose resolution never reached the store is still a set, counted as unknown rather than
   as one that cost nothing. docs/cli/stats-the-landing.md. */
import { BATCHES, WRITTEN, marksOf, scopeOf, writeMark } from "./marks.mjs";

const OPENED = "opened";
const RESOLVED = "resolved";

export const ATTRIBUTED = "attributed";
export const SPLIT = "split";
export const ALONE = "one-by-one";
/* A search a declined gate place stopped: it resolved nothing, and the landing that takes it up again
   meets the set afresh. */
export const UNREAD = "unread";

const RESOLVING = new Set([ATTRIBUTED, SPLIT, ALONE]);

/* Said and carried past: the release or hand-back the record describes goes on whatever the store
   answers, and what the reader then makes of the gap is what this line tells the landing's reader. */
const written = (record, what) => {
  let outcome;
  try {
    outcome = writeMark(record);
  } catch (error) {
    console.error(`stats: could not write the red-batch record (${error.message}).`);
  }
  if (outcome === WRITTEN) return;
  console.error(`red batch: ${what} is not on record, so \`forge stats runs\` counts this set as unknown; `
    + "the landing goes on as it would have.");
};

/** The opening record, written before any gate of the search is spent, and the handle its
 *  resolution is written against. */
export const batchOpened = ({ root, members, candidate, pin, strategy }) => {
  const at = new Date().toISOString();
  let scope = null;
  try {
    scope = scopeOf(root);
  } catch {
    /* A checkout whose project file cannot be read is held under no scope: the daily page, which
       reads every scope, still counts the set, and the landing is not stopped over a figure. */
  }
  const opened = { kind: BATCHES, scope, batch: `${candidate}@${at}`, strategy, members };
  written({ ...opened, phase: OPENED, at, candidate, pin }, "the red set's opening");
  return opened;
};

/** The resolution: `gates` is every gate the resolution itself ran, the combined one among them, and
 *  `alone` the members it left to be landed one at a time, each owing a gate of its own. */
export const batchResolved = (opened, { outcome, gates, back = [], alone = [], rounds = 0 }) =>
  written({ ...opened, phase: RESOLVED, at: new Date().toISOString(), outcome, gates, back, alone, rounds },
    `how the red set of ${opened.members.join(" ")} was resolved`);

const setsOf = (records) => {
  const sets = new Map();
  for (const one of records) {
    if (typeof one.batch !== "string") continue;
    const held = sets.get(one.batch) ?? {};
    held[one.phase] = one;
    sets.set(one.batch, held);
  }
  return [...sets.values()].filter((one) => one[OPENED] || one[RESOLVED]);
};

const momentOf = (set) => Date.parse((set[OPENED] ?? set[RESOLVED]).at) || 0;

/* A resolution a figure can be built from: one that resolved, with a whole gate count and the members
   the alone baseline is counted from. Anything short of that is unknown and adds to neither sum. */
const resolvedOf = (set) => {
  const one = set[RESOLVED];
  if (!one || !RESOLVING.has(one.outcome) || !Number.isInteger(one.gates)) return null;
  if (!Array.isArray(one.members) || !Array.isArray(one.alone)) return null;
  return one;
};

/** The red sets opened in `[from, to)` — either bound null for none — under one project's scope, or
 *  every scope where `scope` is null. `spent` counts a member landed alone as the gate it owes, and
 *  `alone` is what landing every member alone would have spent: one each and the combined one. */
export const redBatchesOver = (scope, from = null, to = null, records = marksOf(BATCHES, scope)) => {
  const sets = setsOf(records).filter((one) => {
    const at = momentOf(one);
    return (from === null || at >= from) && (to === null || at < to);
  });
  const held = { sets: sets.length, attributed: 0, split: 0, rounds: 0, oneByOne: 0, unknown: 0, spent: 0, alone: 0 };
  for (const set of sets) {
    const one = resolvedOf(set);
    if (!one) {
      held.unknown += 1;
      continue;
    }
    if (one.outcome === ATTRIBUTED) held.attributed += 1;
    if (one.outcome === SPLIT) {
      held.split += 1;
      held.rounds += Number.isInteger(one.rounds) ? one.rounds : 0;
    }
    if (one.outcome === ALONE) held.oneByOne += 1;
    held.spent += one.gates + one.alone.length;
    held.alone += one.members.length + 1;
  }
  return held;
};

/** The sentence both readers print, the unknown sets named apart from the two gate figures. */
export const redBatchSaid = (held) => (held.sets
  ? `${held.sets} red set(s) recorded: ${held.attributed} attributed by paths, ${held.split} split over `
    + `${held.rounds} round(s), ${held.oneByOne} landed one by one, ${held.unknown} unknown · the `
    + `${held.sets - held.unknown} resolved spent ${held.spent} gate(s) where landing each member alone `
    + `would have spent ${held.alone}`
  : "none recorded, so no red set's gates are read");

export const redBatchLine = (held) => `red batches     ${redBatchSaid(held)}`;
