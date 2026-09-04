/* How long each green run took, beside the step records it shares a directory with. The gate
   measures it and the process takes it away, so nothing said whether this gate had grown (ISS-166). */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { gitCommonDir } from "../checkout.mjs";

const FILE = "runs";
const KEPT = 20;
const RUN = /^(\S+) (\d+)s (\d+)\/(\d+)$/u;

export const PLANTS = "npm run check -- --full";

export const recordDir = (root) => join(gitCommonDir(root), "gate-ledger");

const seriesFile = (dir) => join(dir, FILE);

export const runSeries = (dir) => {
  let text;
  try {
    text = readFileSync(seriesFile(dir), "utf8");
  } catch {
    return [];
  }
  return text.split("\n").map((line) => RUN.exec(line.trim())).filter(Boolean)
    .map(([, at, seconds, ran, total]) =>
      ({ at, seconds: Number(seconds), ran: Number(ran), total: Number(total) }));
};

const whole = (run) => run.ran === run.total;

const line = (run) => `${run.at} ${run.seconds}s ${run.ran}/${run.total}`;

/* Staged and renamed like a step's own pass; a race loses one figure. The newest two whole-gate runs
   outlive the window scoped runs fill: by age alone, the run needing a predecessor is what evicts it. */
export const recordRun = (dir, { seconds, ran, total }) => {
  const held = [...runSeries(dir), { at: new Date().toISOString(), seconds, ran, total }];
  const kept = held.slice(-KEPT);
  for (const run of held.filter(whole).slice(-2).reverse()) if (!kept.includes(run)) kept.unshift(run);
  const staging = `${seriesFile(dir)}.${process.pid}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(staging, `${kept.map(line).join("\n")}\n`);
  renameSync(staging, seriesFile(dir));
};

const said = (run) => `${run.seconds}s over ${run.ran} of ${run.total} step(s) on ${run.at.slice(0, 10)}`;

const changeFrom = (newest, before) => before.seconds > 0
  ? `${(newest.seconds / before.seconds).toFixed(2)}x the ${before.seconds}s before it`
  : `${newest.seconds}s more than the one before it, which took under a second, so there is no ratio`;

const compared = (wholes) => wholes.length > 1
  ? `${said(wholes.at(-1))}, ${changeFrom(wholes.at(-1), wholes.at(-2))}`
  : `${said(wholes[0])}, the only whole-gate figure recorded`;

/** Two figures that each spent the whole table, never two adjacent runs: scoped runs sit between
 *  the full ones, so the newest two *runs* would subtract nothing. A scoped run still leads with
 *  its own figure, said to be scoped: shown as a change it would read as a gate that got quicker. */
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
