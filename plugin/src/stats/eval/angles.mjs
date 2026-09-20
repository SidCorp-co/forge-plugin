/* The angles one corpus read serves: a closed set, each over the population it names and judged
   against this corpus's own adjacent-block floor rather than against zero. What an angle is, what
   its population means and what the floor is not — docs/cli/stats-the-angles.md. */
import { median } from "../median.mjs";
import { profileOf } from "../runs.mjs";
import { UNAVAILABLE } from "./outcomes.mjs";
import { fail } from "../../resolve/settings.mjs";

/** How many positions the floor needs before its p95 is a percentile rather than the largest shift it
 *  happened to see. Under this the verdict is withheld and the count said. */
export const POSITIONS = 20;

/** The four, and no fifth without a release — the third is the common answer at these window sizes
 *  and the fourth is a span too thin to judge, which is a different sentence from a judgement. */
export const DISPOSITIONS = {
  improved: "improved",
  declined: "declined",
  same: "not distinguishable from this harness compared with itself",
  unevaluable: "not evaluable",
};

/* A figure a profile does not carry is null and never nought: a held reading written before the
   figure existed, and a window whose population is empty, are both the absence of a measurement. */
const carried = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);

const partPairs = (profile) => (profile.guideParts ?? []).reduce((sum, [, one]) => sum + one.runs, 0);
const partsAgain = (profile) => (profile.guideParts ?? []).reduce((sum, [, one]) => sum + one.again, 0);

const RUNS = "run(s) in the window";

/** The closed set. Each entry is one shipped surface with its own case: what it asks, the population
 *  it asks it over, the direction that counts as better, the reader that takes its figure off a
 *  profile and the one that counts that profile's population. Three are over the runs of a window and
 *  the fourth is over run-and-part pairs, which is why both readers exist — two angles over different
 *  populations are two readings, and the block says so on every line. */
export const ANGLES = {
  wall: {
    asks: "median minutes a run took end to end",
    over: RUNS,
    better: -1,
    of: (profile) => carried(profile.medianMinutes),
    countOf: (profile) => profile.runs ?? 0,
  },
  calls: {
    asks: "median tool calls a run made",
    over: RUNS,
    better: -1,
    of: (profile) => carried(profile.medianCalls),
    countOf: (profile) => profile.runs ?? 0,
  },
  "edit-chars": {
    asks: "median characters a run wrote through an edit route",
    over: RUNS,
    better: -1,
    of: (profile) => carried(profile.editCharsPerRun),
    countOf: (profile) => profile.runs ?? 0,
  },
  "guide-reread": {
    asks: "the share of run-and-part pairs whose run read that part more than once",
    over: "run-and-part pair(s) this window's runs read",
    better: -1,
    of: (profile) => (partPairs(profile) ? partsAgain(profile) / partPairs(profile) : null),
    countOf: partPairs,
  },
};

const NAMES = Object.keys(ANGLES);

/** Which angles this call asks for, refused before anything is read. A name the set does not hold is
 *  refused with the set, as the subject slot already refuses one; a name given twice is refused
 *  rather than quietly read once, since a duplicate silently collapsed reads to the caller exactly
 *  like the thing they asked for happening. */
export const anglesAsked = (raw, verb = "stats eval") => {
  if (raw === undefined) return NAMES;
  const asked = String(raw).split(",").map((one) => one.trim()).filter((one) => one.length);
  if (!asked.length) fail(`${verb}: --angles was given no angle name. There is: ${NAMES.join(", ")}.`);
  const unknown = asked.find((one) => !Object.hasOwn(ANGLES, one));
  if (unknown) fail(`${verb}: no angle named ${unknown}. There is: ${NAMES.join(", ")}.`);
  const twice = asked.find((one, at) => asked.indexOf(one) !== at);
  if (twice) {
    fail(`${verb}: --angles names ${twice} twice, and an angle is read once. `
      + `Ask for each once: \`--angles ${[...new Set(asked)].join(",")}\`.`);
  }
  return asked;
};

/** The profile of every block of `size` consecutive runs, in the order handed over. */
export const blocksOf = (ordered, size) => {
  const held = [];
  for (let at = 0; at + size <= ordered.length; at += 1) held.push(profileOf(ordered.slice(at, at + size)));
  return held;
};

/* The middle is `median.mjs`'s, which is this repository's one answer to it. A percentile in the tail
   has no such home and takes the nearest rank — the smallest observation at or above the share asked
   for — which is what makes twenty the count a p95 stops being the largest shift seen at. */
const atRank = (sorted, at) => sorted[Math.max(0, Math.ceil(at * sorted.length) - 1)];

/** The floor for each named angle, off one pass of block profiles: two adjacent blocks of the sizes
 *  actually being compared, slid a run at a time, each angle's own figure taken over both sides.
 *
 *  **A geometric position is not a reading.** A historical block can hold no run that read a guide
 *  part, or a figure of zero, and a position whose before figure is zero or whose either side carries
 *  none yields no relative shift. Those are counted as yielding none, and everything the floor states
 *  — its quantiles, the `POSITIONS` minimum and the exceedance share read off it — is over the
 *  positions that yielded one. That is this reading's own rule applied to its floor before it is
 *  applied to anything else. */
export const floorsOver = (befores, nows, beforeSize, nowSize, total, names = NAMES) => {
  const last = total - beforeSize - nowSize;
  return new Map(names.map((name) => {
    const { of } = ANGLES[name];
    const shifts = [];
    let dropped = 0;
    for (let at = 0; at <= last; at += 1) {
      const was = of(befores[at]);
      const now = of(nows[at + beforeSize]);
      if (was === null || now === null || was === 0) dropped += 1;
      else shifts.push(Math.abs(now - was) / was);
    }
    shifts.sort((left, right) => left - right);
    return [name, {
      before: beforeSize,
      now: nowSize,
      over: shifts.length,
      dropped,
      median: median(shifts),
      p90: shifts.length ? atRank(shifts, 0.9) : null,
      p95: shifts.length ? atRank(shifts, 0.95) : null,
      shifts,
    }];
  }));
};

const withheld = (why) => ({ disposition: DISPOSITIONS.unevaluable, why, shift: null, past: null });

/* The one rule per disposition, in the order a reading can answer them: what the windows hold comes
   before what they say, and what the floor holds comes before what it is compared with. */
const verdictOf = ({ angle, before, now, floor, runFloor }) => {
  if (!before) return withheld("there is no window before this one");
  if (before.runs < runFloor) {
    return withheld(`the before window holds ${before.runs} run(s), fewer than the floor of ${runFloor}`);
  }
  if (now.runs < runFloor) {
    return withheld(`this window holds ${now.runs} run(s), fewer than the floor of ${runFloor}`);
  }
  if (before.figure === null) {
    return withheld(`the before window carries no value for this figure, over ${before.over} ${angle.over}`);
  }
  if (now.figure === null) {
    return withheld(`this window carries no value for this figure, over ${now.over} ${angle.over}`);
  }
  /* Before any judgement and not after one: two figures that both read zero have not moved, but
     saying so is still a verdict, and a floor too thin to support one supports none. */
  if (!floor || floor.over < POSITIONS) {
    return withheld(`${floor?.over ?? 0} adjacent position(s) of this corpus yielded a shift at `
      + `${floor?.before ?? before.runs} against ${floor?.now ?? now.runs}, fewer than the ${POSITIONS} a p95 needs`);
  }
  if (before.figure === 0 && now.figure !== 0) {
    return withheld("the before figure is zero, so there is no relative shift to take");
  }
  const shift = before.figure === 0 ? 0 : (now.figure - before.figure) / before.figure;
  const past = floor.shifts.filter((one) => one >= Math.abs(shift)).length / floor.over;
  if (Math.abs(shift) <= floor.p95) {
    return {
      disposition: DISPOSITIONS.same,
      why: before.figure === 0 ? "neither window's figure left zero" : "no further than the floor's p95",
      shift,
      past,
    };
  }
  return {
    disposition: Math.sign(shift) === angle.better ? DISPOSITIONS.improved : DISPOSITIONS.declined,
    why: null,
    shift,
    past,
  };
};

/* The shifts stay behind: they are the floor's working and not its reading, and a screen or a `--json`
   consumer handed them would be deriving the quantiles again outside the reader. */
const floorSaid = (floor) => ({
  before: floor.before,
  now: floor.now,
  over: floor.over,
  dropped: floor.dropped,
  median: floor.median,
  p90: floor.p90,
  p95: floor.p95,
});

/** One angle over the two windows and judged. `windows` is `{ before, now }`, each `{ runs, profile }`
 *  as `stats eval` holds them, and `before` is null where the corpus has no window before this one. */
export const angleOf = (name, windows, floor, runFloor, recomputed = null) => {
  const angle = ANGLES[name];
  const side = (window) => (window
    ? { runs: window.runs, figure: angle.of(window.profile), over: angle.countOf(window.profile) }
    : null);
  const before = side(windows.before);
  const now = side(windows.now);
  return {
    name,
    asks: angle.asks,
    over: angle.over,
    better: angle.better < 0 ? "lower" : "higher",
    before,
    now,
    recomputed,
    floor: floor ? floorSaid(floor) : null,
    ...verdictOf({ angle, before, now, floor, runFloor }),
  };
};

/* The window a held reading covers, in the bounds its own profile carries. */
const heldIn = (ordered, window) =>
  ordered.filter((run) => run.startedAt >= window.profile.from && run.endedAt <= window.profile.to);

/** Both sides of a held comparison, computed here. **A stored profile is never read for an angle's
 *  figure**, however well its field names match: a reading written under an older admission or
 *  extraction rule carries the same names as this one and measures a different population, so a
 *  matching shape is no evidence at all — two admission tests over one of this repository's own
 *  transcript sets disagreed by a third. The before side is recomputed from the live corpus over the
 *  span the held window covers, so both sides come off this reader and the delta is the harness's
 *  rather than the reader's. What that span still recovers is said beside the figure, and a span
 *  this corpus no longer holds enough of is `not evaluable` rather than a delta with a caveat. */
const bothSides = (ordered, held) => {
  const before = held.before ?? null;
  if (!before || held.against === undefined) return { before, recomputed: null };
  const rows = heldIn(ordered, before);
  return {
    before: { runs: rows.length, profile: profileOf(rows) },
    recomputed: { held: before.runs, found: rows.length },
  };
};

/** Every asked angle over the two windows, off one pass of block profiles — the one corpus read
 *  serving several angles, which is what the floor is built the same way for. */
export const anglesOver = ({ ordered, held, names, runFloor }) => {
  const now = held.now;
  const { before, recomputed } = bothSides(ordered, held);
  let floors = new Map();
  if (before && before.runs > 0 && now.runs > 0) {
    const befores = blocksOf(ordered, before.runs);
    const nows = before.runs === now.runs ? befores : blocksOf(ordered, now.runs);
    floors = floorsOver(befores, nows, before.runs, now.runs, ordered.length, names);
  }
  return names.map((name) => angleOf(name, { before, now }, floors.get(name) ?? null, runFloor, recomputed));
};

const percent = (value) => `${(value * 100).toFixed(1)}%`;
const signed = (value) => `${value > 0 ? "+" : ""}${percent(value)}`;
/* Kept readable across four orders of magnitude: a share of 0.041 and an edit-character median of
   39119 print in one column and neither is rounded into the other's precision. */
const figure = (value) => (Math.abs(value) >= 1 ? String(Math.round(value * 10) / 10) : String(Number(value.toFixed(4))));

const NAME = 15;
const ROW = 9;

const sideLine = (when, side, angle) => `  ${when.padEnd(ROW)}`
  + (side === null
    ? "not in this reading"
    : `${side.figure === null ? UNAVAILABLE : figure(side.figure)} over ${side.over} ${angle.over}`);

const floorLine = (floor) => `  ${"floor".padEnd(ROW)}`
  + (floor.over
    ? `${percent(floor.median)} at the median, ${percent(floor.p90)} at p90, ${percent(floor.p95)} at p95, `
      + `over ${floor.over} adjacent position(s) that yielded a shift and ${floor.dropped} that yielded none`
    : `no adjacent position of this corpus yielded a shift at ${floor.before} against ${floor.now}, `
      + `${floor.dropped} yielded none`);

const movedLine = (one) => `  ${"moved".padEnd(ROW)}${signed(one.shift)}`
  + (one.past === null ? "" : `, and ${percent(one.past)} of those positions moved at least as far`);

const recomputedLine = (one) => `  ${"held".padEnd(ROW)}`
  + `the held reading recorded ${one.held} run(s); this corpus still holds ${one.found} of that span, `
  + "and both sides are computed here, so no reading's own admission rule is compared with another's";

const angleLines = (one) => [
  "",
  `${one.name.padEnd(NAME)}${one.asks} — ${one.better} is better`,
  ...(one.recomputed ? [recomputedLine(one.recomputed)] : []),
  sideLine("before", one.before, one),
  sideLine("now", one.now, one),
  ...(one.floor ? [floorLine(one.floor)] : []),
  ...(one.shift === null ? [] : [movedLine(one)]),
  `  ${"verdict".padEnd(ROW)}${one.disposition}${one.why ? `: ${one.why}` : ""}`,
];

/** The angle block of the screen: one corpus read, several angles, each saying what it was taken
 *  over and what it is judged against. */
export const anglesSaid = (readings) => [
  "",
  "angles on the same runs — each over the population it names, each judged against how far two "
    + "adjacent blocks of this corpus have themselves differed",
  ...readings.flatMap(angleLines),
];
