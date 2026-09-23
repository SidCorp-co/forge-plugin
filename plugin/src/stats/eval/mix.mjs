/* The covariates this corpus carries, and how unusual it is for two of its populations to differ on
   one of them by as much as these two do. What this reference licenses and what it does not —
   docs/cli/stats-the-change.md. */
import { median } from "../median.mjs";
import { POSITIONS, atRank } from "./angles.mjs";

/** The two a run row carries. Each is one dimension of the work a window did, not of what it cost:
 *  the rung is the kind of work the method ran at, the model is who ran it. Nothing else on a run is
 *  fixed before the run begins, and a covariate chosen after the outcome is a covariate that can be
 *  chosen for its answer. */
const COVARIATES = {
  rung: { asks: "the rung each run ran at", of: (run) => run.rung },
  model: { asks: "the model each run ran on", of: (run) => run.model },
};

const NAMES = Object.keys(COVARIATES);

export const tallyOf = (rows, of) => {
  const held = {};
  for (const row of rows) {
    const value = of(row) ?? "unstated";
    held[value] = (held[value] ?? 0) + 1;
  }
  return held;
};

/** Total variation distance between two tallies: half the sum, over every value either side holds, of
 *  the difference in shares. **A value one side never saw counts as nought on that side** rather than
 *  dropping out of the sum, which is the whole of what the measure is for: a population holding none of
 *  a value differs from one holding some of it by that value's whole share.
 *  An empty side answers null, a distance over no runs being the absence of a measurement. */
export const distanceOf = (before, now) => {
  const was = Object.values(before).reduce((sum, one) => sum + one, 0);
  const is = Object.values(now).reduce((sum, one) => sum + one, 0);
  if (!was || !is) return null;
  const values = new Set([...Object.keys(before), ...Object.keys(now)]);
  let apart = 0;
  for (const value of values) apart += Math.abs((now[value] ?? 0) / is - (before[value] ?? 0) / was);
  return apart / 2;
};

/* The rows of each block, in the order handed over; `blocksOf` gives profiles and a tally needs the
   runs themselves. One pass per size, as the angle floor takes one. */
const rowsOf = (ordered, size) => {
  const held = [];
  for (let at = 0; at + size <= ordered.length; at += 1) held.push(ordered.slice(at, at + size));
  return held;
};

/** The reference for each covariate, built over the positions `floorsOver` in `angles.mjs` builds an
 *  angle's floor over, with a tally distance where that takes a figure. A position whose either side is
 *  empty yields none and is counted as yielding none, so every quantile and the `POSITIONS` minimum are
 *  over the positions that yielded one.
 *
 *  **This is not a null and it is not an equivalence bound.** The corpus's own adjacent positions
 *  cross real releases and real drift, so what it measures is how unusual a mix shift of this size is
 *  here, and nothing more. It is read one way only: past it withholds, inside it licenses nothing. */
export const mixFloorsOver = (ordered, beforeSize, nowSize, names = NAMES) => {
  const befores = rowsOf(ordered, beforeSize);
  const nows = beforeSize === nowSize ? befores : rowsOf(ordered, nowSize);
  const last = ordered.length - beforeSize - nowSize;
  return new Map(names.map((name) => {
    const { of } = COVARIATES[name];
    const distances = [];
    let dropped = 0;
    for (let at = 0; at <= last; at += 1) {
      const one = distanceOf(tallyOf(befores[at], of), tallyOf(nows[at + beforeSize], of));
      if (one === null) dropped += 1;
      else distances.push(one);
    }
    distances.sort((left, right) => left - right);
    return [name, {
      before: beforeSize,
      now: nowSize,
      over: distances.length,
      dropped,
      median: median(distances),
      p90: distances.length ? atRank(distances, 0.9) : null,
      p95: distances.length ? atRank(distances, 0.95) : null,
    }];
  }));
};

const THIN = "thin reference";
const PAST = "past the reference";
const EMPTY = "no distance";

/** One covariate over the two populations, with whether it holds the comparison ineligible and why.
 *  `holds` is the only field the eligibility rule reads; the rest is what the screen prints. */
export const mixOf = (name, beforeRows, nowRows, floor) => {
  const { asks, of } = COVARIATES[name];
  const before = tallyOf(beforeRows, of);
  const now = tallyOf(nowRows, of);
  const distance = distanceOf(before, now);
  const held = (why, holds = true) => ({ name, asks, before, now, distance, floor: floor ?? null, holds, why });
  if (distance === null) return held(EMPTY);
  if (!floor || floor.over < POSITIONS) return held(THIN);
  return distance > floor.p95 ? held(PAST) : held(null, false);
};

export const mixOver = (beforeRows, nowRows, floors, names = NAMES) =>
  names.map((name) => mixOf(name, beforeRows, nowRows, floors.get(name) ?? null));

const percent = (value) => `${(value * 100).toFixed(1)}%`;

/** Why one covariate held a comparison ineligible, in the words the verdict carries. Off the reason
 *  the reading already decided rather than a second test of the same numbers.
 *
 *  **Branches rather than a map**, because a map's values are all evaluated before one is picked: the
 *  `past` sentence reads a floor that a population with an empty side does not have, and the reading
 *  that should have answered `undetermined` threw instead. */
export const mixWhy = (one) => {
  if (one.why === EMPTY) return `${one.name}: one of the two populations holds no run, so there is no mix distance to take`;
  if (one.why === THIN) {
    return `${one.name}: ${one.floor?.over ?? 0} adjacent position(s) of this corpus yielded a mix `
      + `distance at ${one.floor?.before ?? "?"} against ${one.floor?.now ?? "?"}, fewer than the `
      + `${POSITIONS} a p95 needs`;
  }
  if (one.why === PAST) {
    return `${one.name}: the mix moved ${percent(one.distance)}, past this corpus's own p95 of `
      + `${percent(one.floor.p95)} over ${one.floor.over} adjacent position(s)`;
  }
  return null;
};

const said = (tally) => Object.entries(tally).sort(([, a], [, b]) => b - a)
  .map(([value, count]) => `${value} ${count}`).join(", ") || "nothing";

const ROW = 9;

export const mixLines = (readings) => readings.flatMap((one) => [
  "",
  `${one.name} — ${one.asks}`,
  `  ${"before".padEnd(ROW)}${said(one.before)}`,
  `  ${"now".padEnd(ROW)}${said(one.now)}`,
  `  ${"moved".padEnd(ROW)}${one.distance === null ? "no distance: one side holds no run" : percent(one.distance)}`,
  `  ${"against".padEnd(ROW)}${one.floor?.over
    ? `${percent(one.floor.median)} at the median, ${percent(one.floor.p90)} at p90, ${percent(one.floor.p95)} at p95, `
      + `over ${one.floor.over} adjacent position(s) that yielded a distance and ${one.floor.dropped} that yielded none`
    : "no adjacent position of this corpus yielded a distance at these two sizes"}`,
  `  ${"holds".padEnd(ROW)}${one.holds ? mixWhy(one) : "this covariate holds nothing back, which establishes no comparability of its own"}`,
]);
