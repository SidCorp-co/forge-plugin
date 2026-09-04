/* How long each green run took, beside the step records it shares a directory with. The gate
   measures it and the process takes it away, so nothing said whether this gate had grown (ISS-166). */
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { gitCommonDir } from "../checkout.mjs";

const FILE = "runs";
const RUN = /^(\S+) (\d+)s (\d+)\/(\d+)$/u;

export const PLANTS = "npm run check -- --full";

export const recordDir = (root) => join(gitCommonDir(root), "gate-ledger");

export const seriesFile = (dir) => join(dir, FILE);

export const runSeries = (dir) => {
  let text;
  try {
    text = readFileSync(seriesFile(dir), "utf8");
  } catch {
    return [];
  }
  return text.split("\n").map((one) => RUN.exec(one.trim())).filter(Boolean)
    .map(([, at, seconds, ran, total]) =>
      ({ at, seconds: Number(seconds), ran: Number(ran), total: Number(total) }));
};

const whole = (run) => run.ran === run.total;

const line = (run) => `${run.at} ${run.seconds}s ${run.ran}/${run.total}`;

const said = (run) => `${run.seconds}s over ${run.ran} of ${run.total} step(s) on ${run.at.slice(0, 10)}`;

/** Only ever appended: worktrees share this file, and a rewrite carries what one run read over what another
 *  wrote between, so the run being looked for is the one at risk. Nothing trims it — forty bytes a green run. */
export const recordRun = (dir, { seconds, ran, total }) => {
  const fresh = { at: new Date().toISOString(), seconds, ran, total };
  mkdirSync(dir, { recursive: true });
  appendFileSync(seriesFile(dir), `${line(fresh)}\n`);
  return said(fresh);
};

const changeFrom = (newest, before) => before.seconds > 0
  ? `${(newest.seconds / before.seconds).toFixed(2)}x the ${before.seconds}s before it`
  : `${newest.seconds}s more than the one before it, which took under a second, so there is no ratio`;

// Over the same table: a gate that gained a step is another gate, and the arithmetic would report the addition as drift.
const compared = (wholes) => {
  const now = wholes.at(-1);
  const same = wholes.filter((one) => one.total === now.total);
  if (same.length > 1) return `${said(now)}, ${changeFrom(now, same.at(-2))}`;
  const other = wholes.at(-2);
  return other
    ? `${said(now)}, and the one before it was ${said(other)} — a table of another size, so nothing is subtracted`
    : `${said(now)}, the only whole-gate figure recorded`;
};

/** Never two adjacent runs: scoped runs sit between the full ones, so the newest two *runs* subtract nothing. A
 *  scoped run leads with its own figure, said to be scoped: as a change it would read as a gate that got quicker. */
export const runSays = (dir) => {
  const series = runSeries(dir);
  const newest = series.at(-1);
  if (!newest) return `no run is recorded, so nothing says whether this gate has grown; ${PLANTS} plants a figure`;
  const wholes = series.filter(whole);
  if (wholes.length === 0) {
    return `${said(newest)}, and no run recorded spent the whole table; ${PLANTS} plants a figure`;
  }
  return whole(newest)
    ? compared(wholes)
    : `${said(newest)}, which is scoped and measures less; the whole gate last took ${compared(wholes)}`;
};
