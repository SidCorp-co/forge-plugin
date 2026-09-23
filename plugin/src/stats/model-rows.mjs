/* The rows `forge stats models` prints and the one boundary it will compare across. Why each rule is
   the shape it is, and what the reading refuses to conclude: docs/cli/stats-the-model.md. */
import { afterRun, outcomesOf, pairsOf } from "./eval/outcomes.mjs";
import { MODEL_MIXED, MODEL_NONE, RUNG_UNKNOWN } from "./corpus/transcripts.mjs";
import { medianOrZero, minutes } from "./figures.mjs";
import { profileOf, runsUnder } from "./runs.mjs";
import { COMPLEXITY_NAMES, rungFrom } from "../ladder.mjs";

/** Ten observations of a figure's own and ten runs behind them, on both arms, inside one cell. Both,
 *  because a figure counted over run-and-issue pairs reaches forty-one on one run that claimed
 *  forty-one issues, and forty-one observations of one run is one observation of the model. */
export const FLOOR = 10;
export const enough = (over, runs) => over >= FLOOR && runs >= FLOOR;
export const THIN = "thin";
export const WHOLE = "all";

const REACHED = "reached the landing";
const ACCEPTED = "consult findings accepted";
const REJECTED = "consult findings rejected";
const CORRECTED = "corrected after the run";

/* Not that the landing succeeded, only that the run got that far. Both forms are `shipsIn`'s. */
const reachedOn = (run) => run.ships.passes > 0 || run.ships.ready > 0;

const countFigure = (name, count, over, runs = over) =>
  ({ name, count: over > 0 ? count : null, over, runs });

const correctionsIn = (pair, records) => records
  .filter((one) => one.kind === "correction" && one.at > pair.run.endedAt)
  .map((one) => one.at);

/* The complement of the rejected figure over one population, so neither number can move alone. */
const acceptedFrom = (rejected) =>
  countFigure(ACCEPTED, rejected.count === null ? 0 : rejected.over - rejected.count,
    rejected.over, rejected.runs);

const gotOf = (runs, read) => {
  const reached = countFigure(REACHED, runs.filter(reachedOn).length, runs.length);
  if (!read) return [reached];
  const held = outcomesOf(runs, read);
  const rejected = held.figures.find((one) => one.name === REJECTED);
  return [
    reached,
    ...(rejected ? [acceptedFrom(rejected)] : []),
    ...held.figures,
    afterRun(CORRECTED, pairsOf(runs, read.documents), read.threads, read.horizon, read.now, correctionsIn),
  ];
};

/** Medians over one population, the runs of that model, so the row carries the count once, and the
 *  reading's own `unrecognised`: an arm that ran none of a recognised class has a measured nought.
 *  The figure shape is `outcomes.mjs`'s, whose `figure` carries why a null count is not a zero. */
const spendOf = (runs, declared, unrecognised = []) => {
  const held = profileOf(runs, declared);
  return {
    over: runs.length,
    unrecognised,
    wall: held.medianMinutes,
    tool: minutes(medianOrZero(runs.map((run) => run.toolSeconds))),
    calls: held.medianCalls,
    gate: held.perRun.gate,
    consult: held.perRun.consult,
    recheck: held.perRun.recheck,
  };
};

const TOP = COMPLEXITY_NAMES.at(-1);

export const complexityOf = (run, complexities) => {
  const held = run.issues.map((reference) => complexities?.get(reference) ?? null);
  const read = held.filter((one) => COMPLEXITY_NAMES.includes(one));
  if (!read.length) return RUNG_UNKNOWN;
  const largest = read.reduce((deep, one) =>
    (COMPLEXITY_NAMES.indexOf(one) > COMPLEXITY_NAMES.indexOf(deep) ? one : deep));
  return read.length === held.length || largest === TOP ? largest : RUNG_UNKNOWN;
};

const grouped = (runs, key) => {
  const held = new Map();
  for (const run of runs) {
    const name = key(run);
    if (!held.has(name)) held.set(name, []);
    held.get(name).push(run);
  }
  return held;
};

/** Largest arm first; `mixed` and `unattributed` keep rows, so the rows add up to the corpus. */
const modelRows = (runs, read, declared, unrecognised = []) =>
  [...grouped(runs, (run) => run.model)]
    .map(([model, held]) =>
      ({ model, runs: held.length, spend: spendOf(held, declared, unrecognised), got: gotOf(held, read) }))
    .sort((left, right) => right.runs - left.runs || left.model.localeCompare(right.model));

/** Which cell one run falls in, and whether its rung came off the tracker: the run's own record
 *  answers first, being the rung it was worked at rather than the one its issue reads at now, and
 *  the complexity this reading already holds answers where the transcript kept no record to read —
 *  a run that wrote none, or one whose record reached the transcript without the tag that says
 *  which record it is, can be classed from nothing else (ISS-1979). Where neither answers, the run
 *  is at no rung, which is what a run nothing knew the issue of reads as. */
const cellFor = (run, complexities) => {
  const complexity = complexityOf(run, complexities);
  const off = run.rung === RUNG_UNKNOWN ? rungFrom(complexity) : null;
  return { cell: `${off ?? run.rung}/${complexity}`, offComplexity: Boolean(off) };
};

/** How many of this reading's rungs the tracker answered rather than the run — the disclosure that
 *  keeps this verb's cut readable beside `stats runs`, which asks the tracker for no issue and so
 *  classes the same run at no rung. */
const rungsOffComplexity = (runs, complexities) =>
  runs.filter((run) => cellFor(run, complexities).offComplexity).length;

/** A run at no rung keeps its own row, or the cut comes out short of the corpus it cut; a run of
 *  several takes the largest complexity among them, and none where one it could not read may beat it. */
export const cutRows = (runs, read, declared, unrecognised = []) =>
  [...grouped(runs, (run) => cellFor(run, read?.complexities).cell)]
    .flatMap(([cell, held]) =>
      [...grouped(held, (run) => run.model)].map(([model, mine]) => ({
        cell,
        model,
        runs: mine.length,
        spend: spendOf(mine, declared, unrecognised),
        got: gotOf(mine, read),
      })))
    .sort((left, right) => right.runs - left.runs || left.cell.localeCompare(right.cell));

/* Rows that name no model anyone could dispatch to: every figure of theirs prints, none is a side. */
const BUCKETS = new Set([MODEL_MIXED, MODEL_NONE]);

const pairsOver = (arms) => {
  const held = [];
  for (let one = 0; one < arms.length; one += 1) {
    for (let two = one + 1; two < arms.length; two += 1) held.push([arms[one], arms[two]]);
  }
  return held;
};

/** The whole of what this reading will call comparable; outside it a row prints its count and `thin`. */
export const comparableIn = (cells) => cells.flatMap(({ cell, figures }) =>
  [...figures].flatMap(([figure, arms]) =>
    pairsOver(arms.filter((arm) => enough(arm.over, arm.runs) && !BUCKETS.has(arm.model))
      .map((arm) => arm.model).sort())
      .map((pair) => ({ cell, figure, pair }))));

const SPEND_FIGURES = ["wall", "tool", "calls", "gate", "consult", "recheck"];

/* What the floor is asked of: a spend figure's population is the row's run count, an outcome
   figure's its own, and a class never recognised measured nothing, so it stands as no population. */
const figuresIn = (rows) => {
  const held = new Map();
  const put = (name, row, over, runs) => {
    if (!held.has(name)) held.set(name, []);
    held.get(name).push({ model: row.model, over, runs });
  };
  for (const row of rows) {
    for (const name of SPEND_FIGURES) {
      if (!(row.spend.unrecognised ?? []).includes(name)) put(name, row, row.spend.over, row.runs);
    }
    /* The figure's own contributing runs, never the row's: nine unread threads leave one run. */
    for (const one of row.got ?? []) put(one.name, row, one.over, one.runs ?? row.runs);
  }
  return held;
};

export const cellsOf = (rows, cut) => [
  { cell: WHOLE, figures: figuresIn(rows) },
  ...[...grouped(cut, (row) => row.cell)].map(([cell, held]) => ({ cell, figures: figuresIn(held) })),
];

export const readingOf = (runs, read, declared, corpus = runs.length) => {
  const unrecognised = profileOf(runs, declared).unrecognised;
  const models = modelRows(runs, read, declared, unrecognised);
  const cut = cutRows(runs, read, declared, unrecognised);
  return {
    runs: runs.length,
    corpus,
    from: runs.length ? runs[0].startedAt : null,
    to: runs.length ? Math.max(...runs.map((run) => run.endedAt)) : null,
    floor: FLOOR,
    unrecognised,
    rungsOffComplexity: rungsOffComplexity(runs, read?.complexities),
    models,
    cut,
    comparable: comparableIn(cellsOf(models, cut)),
    read: read ? { horizon: read.horizon, now: read.now, requests: read.spent.requests } : null,
  };
};

/** The whole corpus and the part of it a window leaves, kept apart: a ruling is paired over the
 *  corpus, where a competitor the window hid would hand the run inside it evidence nobody earned. */
export const windowedIn = (root, from, classes) => {
  const read = runsUnder(root, null, classes);
  const runs = from ? read.runs.filter((run) => run.endedAt >= from) : read.runs;
  return { ...read, corpus: read.runs, runs, outsideWindow: read.runs.length - runs.length };
};
