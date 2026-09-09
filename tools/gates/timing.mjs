/* How long each green run took, beside the step records it shares a directory with. The gate
   measures it and the process takes it away, so nothing said whether this gate had grown (ISS-166). */
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { gitCommonDir } from "../checkout.mjs";

const FILE = "runs";
const RUN = /^(\S+) (\d+)s (\d+)\/(\d+)(?: load (\d+(?:\.\d+)?)\/(\d+))?$/u;

export const PLANTS = "npm run check -- --full";

/* The figure the last gate review measured and the one-minute load it measured under, and the ceiling
   is the drift trigger applied to it; load on a run's own line is context, and never what it is judged by. */
export const REVIEW = { seconds: 211, load: 10.3, cores: 6, on: "2026-09-08", issue: "ISS-736" };
export const ceilingOf = (review) => Math.round(review.seconds * 1.25);
export const CEILING_SECONDS = ceilingOf(REVIEW);

export const recordDir = (root) => join(gitCommonDir(root), "gate-ledger");

export const seriesFile = (dir) => join(dir, FILE);

const beside = (dir, label, what) => join(dir, `${label.replace(/[^\w.-]+/gu, "-")}-${what}`);

export const fileTimesPath = (dir, label) => beside(dir, label, "files");

export const alonePath = (dir, label) => beside(dir, label, "alone");

export const casesPath = (dir, label) => beside(dir, label, "failed");

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

const reviewed = (now, review) => `${(now.seconds / review.seconds).toFixed(2)}x the ${review.seconds}s the review of `
  + `${review.on} measured under load ${review.load} on ${review.cores} core(s) (${review.issue})`
  + (now.seconds > ceilingOf(review) ? `, over the ceiling of ${ceilingOf(review)}s that review set` : "");

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

const compared = (wholes, review) => `${said(wholes.at(-1))}, ${reviewed(wholes.at(-1), review)}; ${rolling(wholes)}`;

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
