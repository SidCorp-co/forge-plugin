/* How long each green run took, beside the step records it shares a directory with. The gate
   measures it and the process takes it away, so nothing said whether this gate had grown (ISS-166). */
import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

import { gitCommonDir } from "../checkout.mjs";

const FILE = "runs";
const RUN = /^(\S+) (\d+)s (\d+)\/(\d+)(?: load (\d+(?:\.\d+)?)\/(\d+))?$/u;

export const PLANTS = "npm run check -- --full";

/* The figure the last gate review measured and the one-minute load it measured under: a dated
   anchor kept as context on a run's own line, and never the drift trigger — a ceiling fixed to one
   sample was crossed by 72% of this ledger's own whole runs within weeks of being set, which taught
   a reader to ignore it rather than to trust it (ISS-1142). Load stays context beside it, and never
   what either figure is judged by. */
export const REVIEW = { seconds: 211, load: 10.3, cores: 6, on: "2026-09-08", issue: "ISS-736" };

// Below this many prior whole runs at the table size being judged, a percentile is a single reading wearing a formula.
export const MIN_CEILING_POPULATION = 10;
// Rare enough that crossing it is unusual against what this box has actually been doing, not a coin flip most ordinary runs win.
export const CEILING_PERCENTILE = 0.9;

const percentileOf = (sorted, fraction) => {
  const at = (sorted.length - 1) * fraction;
  const below = Math.floor(at);
  const above = Math.ceil(at);
  return below === above ? sorted[below] : sorted[below] + (sorted[above] - sorted[below]) * (at - below);
};

/** The ceiling the newest whole run is judged against: the CEILING_PERCENTILE of every whole run
 *  this ledger holds at the same table size *before* this one, `null` below MIN_CEILING_POPULATION
 *  of them. Drawn from what came before rather than from the population including this run, so a
 *  population that has genuinely grown flags the runs that grew it instead of absorbing its own
 *  outlier and staying silent — which is the property a ceiling fixed to one sample never had. */
export const ceilingFromLedger = (wholes) => {
  const now = wholes.at(-1);
  const before = wholes.slice(0, -1).filter((one) => one.total === now.total);
  if (before.length < MIN_CEILING_POPULATION) return null;
  const seconds = before.map((one) => one.seconds).sort((one, other) => one - other);
  return { seconds: Math.round(percentileOf(seconds, CEILING_PERCENTILE)), population: before.length, through: before.at(-1).at };
};

export const recordDir = (root) => join(gitCommonDir(root), "gate-ledger");

/* Linked worktrees share one record directory, and the place a gate waits for is this checkout's
   rather than this worktree's: named for the step alone, one gate reads what another wrote. */
export const treeKey = (root) => `${basename(root).replace(/[^\w.-]+/gu, "-")}`
  + `.${createHash("sha256").update(root).digest("hex").slice(0, 8)}`;

export const runKey = (root, pid = process.pid) => `${treeKey(root)}.${pid}`;

export const seriesFile = (dir) => join(dir, FILE);

const beside = (dir, label, what) => join(dir, `${label.replace(/[^\w.-]+/gu, "-")}-${what}`);

export const fileTimesPath = (dir, label) => beside(dir, label, "files");

// Read before the step is spawned, which rewrites it with whatever set that spend was; absent is nothing priced, which is not nothing costed.
const TIMED = /^(\d+(?:\.\d+)?)s (.+)$/u;

export const fileSeconds = (dir, label) => {
  let text;
  try {
    text = readFileSync(fileTimesPath(dir, label), "utf8");
  } catch {
    return new Map();
  }
  return new Map(text.split("\n").map((one) => TIMED.exec(one.trim())).filter(Boolean)
    .map(([, seconds, file]) => [file, Number(seconds)]));
};

export const alonePath = (dir, label) => beside(dir, label, "alone");

export const casesPath = (dir, label) => beside(dir, label, "failed");

export const roomPath = (dir, label, run) => beside(dir, label, `room.${run}`);

export const runSeries = (dir) => {
  let text;
  try {
    text = readFileSync(seriesFile(dir), "utf8");
  } catch {
    return [];
  }
  return text.split("\n").map((one) => RUN.exec(one.trim())).filter(Boolean)
    .map(([, at, seconds, ran, total, load, cores]) => ({
      at, seconds: Number(seconds), ran: Number(ran), total: Number(total),
      load: load === undefined ? null : Number(load), cores: cores === undefined ? null : Number(cores),
    }));
};

const whole = (run) => run.ran === run.total;

/* The record goes back weeks and the figure a caller waiting now wants is what this box has been doing lately: over all of it the median is a suite and a load that no longer exist, and over one run it is an outlier. */
const RECENT_WHOLE_RUNS = 20;

/** The newest whole gates this record holds, as a median and a count, `null` where none is recorded; of the size the last whole one was, by the rule `rolling` already states — a gate that gained a step is another gate. The record sits under the common git directory, so this population is the checkout's and every worktree sharing it has appended to it: a line carries no tree and this derives none. */
export const wholeGatesRecorded = (dir, most = RECENT_WHOLE_RUNS) => {
  const wholes = runSeries(dir).filter(whole);
  const now = wholes.at(-1);
  if (!now) return null;
  const seconds = wholes.filter((one) => one.total === now.total).slice(-most)
    .map((one) => one.seconds).sort((one, other) => one - other);
  const middle = seconds.length / 2;
  const median = seconds.length % 2 === 1
    ? seconds[Math.floor(middle)]
    : Math.round((seconds[middle - 1] + seconds[middle]) / 2);
  return { median, runs: seconds.length, steps: now.total };
};

const loaded = (run) => (run.load === null ? "" : ` load ${run.load.toFixed(2)}/${run.cores}`);

const line = (run) => `${run.at} ${run.seconds}s ${run.ran}/${run.total}${loaded(run)}`;

const said = (run) => `${run.seconds}s over ${run.ran} of ${run.total} step(s) on ${run.at.slice(0, 10)}`
  + (run.load === null ? "" : `, load ${run.load.toFixed(1)} on ${run.cores} core(s)`);

/** Only ever appended: worktrees share this file, and a rewrite carries what one run read over what another
 *  wrote between, so the run being looked for is the one at risk. Nothing trims it — forty bytes a green run. */
export const recordRun = (dir, { seconds, ran, total, load = null, cores = null }) => {
  const fresh = { at: new Date().toISOString(), seconds, ran, total, load, cores };
  mkdirSync(dir, { recursive: true });
  appendFileSync(seriesFile(dir), `${line(fresh)}\n`);
  return said(fresh);
};

const changeFrom = (newest, before) => before.seconds > 0
  ? `${(newest.seconds / before.seconds).toFixed(2)}x the ${before.seconds}s before it`
  : `${newest.seconds}s more than the one before it, which took under a second, so there is no ratio`;

const ceilingSaid = (ceiling) => `, over the ${Math.round(CEILING_PERCENTILE * 100)}th percentile of `
  + `${ceiling.population} whole run(s) this ledger holds on this table through ${ceiling.through.slice(0, 10)}, ${ceiling.seconds}s`;

const reviewed = (now, review, ceiling) => `${(now.seconds / review.seconds).toFixed(2)}x the ${review.seconds}s the review of `
  + `${review.on} measured under load ${review.load} on ${review.cores} core(s) (${review.issue})`
  + (ceiling && now.seconds > ceiling.seconds ? ceilingSaid(ceiling) : "");

// Over the same table: a gate that gained a step is another gate, and the arithmetic would report the addition as drift.
const rolling = (wholes) => {
  const now = wholes.at(-1);
  const same = wholes.filter((one) => one.total === now.total);
  if (same.length > 1) {
    const before = same.at(-2);
    return `${changeFrom(now, before)}${before.load === null ? "" : ` (its line said${loaded(before)})`}`;
  }
  const other = wholes.at(-2);
  return other
    ? `the one before it was ${said(other)} — a table of another size, so nothing is subtracted`
    : "the only whole-gate figure recorded";
};

const compared = (wholes, review) => `${said(wholes.at(-1))}, ${reviewed(wholes.at(-1), review, ceilingFromLedger(wholes))}; ${rolling(wholes)}`;

/** Never two adjacent runs: scoped runs sit between the full ones, so the newest two *runs* subtract nothing. A
 *  scoped run leads with its own figure, said to be scoped: as a change it would read as a gate that got quicker. */
export const runSays = (dir, review = REVIEW) => {
  const series = runSeries(dir);
  const newest = series.at(-1);
  if (!newest) return `no run is recorded, so nothing says whether this gate has grown; ${PLANTS} plants a figure`;
  const wholes = series.filter(whole);
  if (wholes.length === 0) {
    return `${said(newest)}, and no run recorded spent the whole table; ${PLANTS} plants a figure`;
  }
  return whole(newest)
    ? compared(wholes, review)
    : `${said(newest)}, which is scoped and measures less; the whole gate last took ${compared(wholes, review)}`;
};
