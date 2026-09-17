/* `forge stats models` — which model ran each run, what a run of that model spent and what it got,
   and the one boundary this reading will compare across: docs/cli/stats-the-model.md. */
import { UNAVAILABLE, afterRun, outcomesOf, pairsOf } from "./eval/outcomes.mjs";
import {
  checkoutFrom, derivedFrom, profileOf, readingAside, runsUnder, sourceLines, windowFrom,
} from "./runs.mjs";
import { horizonOf, outcomeReadFor, saidHorizon, spend } from "./eval/eval.mjs";
import { classesFor, declaredIn } from "./corpus/classes.mjs";
import { medianOrZero, minutes, stamp } from "./figures.mjs";
import { COMPLEXITY_NAMES } from "../ladder.mjs";
import { MODEL_MIXED, MODEL_NONE, RUNG_UNKNOWN } from "./corpus/transcripts.mjs";
import { capped, elided } from "./tables.mjs";
import { rootFor } from "./corpus/corpus.mjs";
import { flags } from "../resolve/flags.mjs";

const VERB = "stats models";

/** Ten observations of a figure's own, on both arms, inside one cell. Under it a dispatcher is
 *  reading a median that two runs wrote, which is the decision this reading exists to prevent. */
export const FLOOR = 10;
export const THIN = "thin";
/** The name the whole reading's own cell is keyed under, beside the cut's `rung/complexity`. */
export const WHOLE = "all";

const REACHED = "reached the landing";
const ACCEPTED = "consult findings accepted";
const REJECTED = "consult findings rejected";
const CORRECTED = "corrected after the run";

export const MODELS_USAGE = [
  "Usage: forge stats models [--since 3d] [--checkout <dir>] [--horizon 1d] [--requests n] [--json]",
  "Which model ran each issue-flow run of a checkout, and what a run of that model spent against what",
  "it got — so a dispatcher can read which kinds of issue a cheaper model handles as well. Nothing is",
  "written. The spend figures are `stats runs`'s own; the outcome figures read the tracker, as",
  "`stats eval`'s do.",
  "",
  "Every figure prints the population it was counted over. A figure under ten observations of its own",
  "carries `thin`, and two arms are compared only where that figure reaches ten on both of them inside",
  "one cell — so an arm with runs to spare is still thin in a rung it barely entered.",
  "",
  "  --since 3d     the window, in d, h or m; the whole corpus unless you say otherwise",
  "  --checkout <dir>  an absolute directory, whose transcript root is derived from its path;",
  "                 the working directory unless you say otherwise",
  "  --horizon 1d   how long after a run an outcome still counts as its own; one day otherwise",
  "  --requests n   the tracker requests this reading may spend; past it the outcome figures print",
  "                 unavailable and every cost figure still prints",
  "  --json         every figure, its population and every comparable pair, as one object",
].join("\n");

/* Not whether the landing succeeded, only that the run got that far — which is what a dispatcher
   asking whether a model finishes at all wants counted. The two forms it takes are `shipsIn`'s. */
const reachedOn = (run) => run.ships.passes > 0 || run.ships.ready > 0;

/* The shape `outcomes.mjs` builds its own figures in, so a figure this reading counts for itself is
   read by the same rule as one it took from there — `figure`'s comment carries that rule. */
const countFigure = (name, count, over) => ({ name, count: over > 0 ? count : null, over });

const correctionsIn = (pair, records) => records
  .filter((one) => one.kind === "correction" && one.at > pair.run.endedAt)
  .map((one) => one.at);

/* The findings a model's work survived, off the same pairing the rejected figure is counted from:
   one number is the other's complement over one population, so neither can move alone. */
const acceptedFrom = (rejected) =>
  countFigure(ACCEPTED, rejected.count === null ? 0 : rejected.over - rejected.count, rejected.over);

export const gotOf = (runs, read) => {
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

/** What a run of one model spent. Every one of these is a median over the same population — the runs
 *  of that model — so the row carries the count once and each figure answers to it. */
export const spendOf = (runs, declared) => {
  const held = profileOf(runs, declared);
  return {
    over: runs.length,
    wall: held.medianMinutes,
    tool: minutes(medianOrZero(runs.map((run) => run.toolSeconds))),
    calls: held.medianCalls,
    gate: held.perRun.gate,
    consult: held.perRun.consult,
    recheck: held.perRun.recheck,
  };
};

/* The batch rule the rung already keeps: a run of three issues is as heavy as its heaviest, so the
   cut files it under the largest complexity any issue it owned carries. */
export const complexityOf = (run, complexities) => {
  const held = run.issues
    .map((reference) => complexities?.get(reference) ?? null)
    .filter((one) => COMPLEXITY_NAMES.includes(one));
  if (!held.length) return RUNG_UNKNOWN;
  return held.reduce((deep, one) =>
    (COMPLEXITY_NAMES.indexOf(one) > COMPLEXITY_NAMES.indexOf(deep) ? one : deep));
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

/** One row per model, largest arm first; `mixed` and `unattributed` keep rows of their own, so the
 *  rows add up to the runs the reading counted rather than to the ones it could name a model for. */
export const modelRows = (runs, read, declared) =>
  [...grouped(runs, (run) => run.model)]
    .map(([model, held]) => ({ model, runs: held.length, spend: spendOf(held, declared), got: gotOf(held, read) }))
    .sort((left, right) => right.runs - left.runs || left.model.localeCompare(right.model));

/** The cut a dispatcher chooses on: the rung the run worked at by the complexity of the issue it
 *  owned. A run at no rung keeps its own row, or the cut comes out short of the corpus it cut. */
export const cutRows = (runs, read, declared) =>
  [...grouped(runs, (run) => `${run.rung}/${complexityOf(run, read?.complexities)}`)]
    .flatMap(([cell, held]) =>
      [...grouped(held, (run) => run.model)].map(([model, mine]) => ({
        cell,
        model,
        runs: mine.length,
        spend: spendOf(mine, declared),
        got: gotOf(mine, read),
      })))
    .sort((left, right) => right.runs - left.runs || left.cell.localeCompare(right.cell));

/* A row that names no model a dispatcher could choose is accounting and not an arm: `mixed` holds
   runs of several models, one of which may be the very model it would be set against, and
   `unattributed` names nothing at all. Both keep every row and figure; neither is ever a side. */
const BUCKETS = new Set([MODEL_MIXED, MODEL_NONE]);

/* One arm's figure against another's, and the whole of what this reading will say is comparable:
   both populations at the floor, on the same figure, inside the same cell. Everything outside that
   region prints its count and `thin`; nothing here widens it for an arm with runs to spare. */
const pairsOver = (arms) => {
  const held = [];
  for (let one = 0; one < arms.length; one += 1) {
    for (let two = one + 1; two < arms.length; two += 1) held.push([arms[one], arms[two]]);
  }
  return held;
};

export const comparableIn = (cells) => cells.flatMap(({ cell, figures }) =>
  [...figures].flatMap(([figure, arms]) =>
    pairsOver(arms.filter((arm) => arm.over >= FLOOR && !BUCKETS.has(arm.model))
      .map((arm) => arm.model).sort())
      .map((pair) => ({ cell, figure, pair }))));

const SPEND_FIGURES = ["wall", "tool", "calls", "gate", "consult", "recheck"];

/* Every figure of every row under the cell it was counted in, which is what the floor is asked of; a
   cell is read exactly as the whole reading is. A spend figure's population is the row's run count,
   an outcome figure's its own. */
const figuresIn = (rows) => {
  const held = new Map();
  const put = (name, model, over) => {
    if (!held.has(name)) held.set(name, []);
    held.get(name).push({ model, over });
  };
  for (const row of rows) {
    for (const name of SPEND_FIGURES) put(name, row.model, row.spend.over);
    for (const one of row.got ?? []) put(one.name, row.model, one.over);
  }
  return held;
};

export const cellsOf = (rows, cut) => [
  { cell: WHOLE, figures: figuresIn(rows) },
  ...[...grouped(cut, (row) => row.cell)].map(([cell, held]) => ({ cell, figures: figuresIn(held) })),
];

const thin = (over) => (over < FLOOR ? `  ${THIN}` : "");
const said = (figure) => (figure.count === null ? UNAVAILABLE : `${figure.count}/${figure.over}`);

const MODEL_WIDE = 26;
const FIGURE_WIDE = 26;

const spendLine = (name, row) =>
  `${name.padEnd(MODEL_WIDE)}${String(row.spend.over).padStart(6)}${row.spend.wall.toFixed(1).padStart(10)}`
  + `${row.spend.tool.toFixed(1).padStart(10)}${row.spend.calls.toFixed(1).padStart(11)}`
  + `${row.spend.gate.toFixed(1).padStart(7)}${row.spend.consult.toFixed(1).padStart(9)}`
  + `${row.spend.recheck.toFixed(1).padStart(9)}${thin(row.spend.over)}`;

const spendLines = (rows) => [
  "",
  `${"model".padEnd(MODEL_WIDE)}${"runs".padStart(6)}${"wall med".padStart(10)}${"tool med".padStart(10)}`
  + `${"calls med".padStart(11)}${"gate".padStart(7)}${"consult".padStart(9)}${"recheck".padStart(9)}`,
  ...rows.map((row) => spendLine(row.model, row)),
];

const gotLines = (rows, read) => [
  "",
  `what a run of each model got — horizon ${saidHorizon(read.horizon)}, read ${stamp(read.now)}`,
  `${"model".padEnd(MODEL_WIDE)}${"figure".padEnd(FIGURE_WIDE)}${"count/over".padStart(14)}`,
  ...rows.flatMap((row) => row.got.map((one) =>
    `${row.model.padEnd(MODEL_WIDE)}${one.name.padEnd(FIGURE_WIDE)}${said(one).padStart(14)}${thin(one.over)}`)),
];

const CELL_WIDE = 18;

const cutLines = (cut, all) => [
  "",
  `${"model".padEnd(MODEL_WIDE)}${"rung/complexity".padEnd(CELL_WIDE)}${"runs".padStart(6)}`
  + `${"wall med".padStart(10)}${"calls med".padStart(11)}${"gate".padStart(7)}`,
  ...capped(cut, all).map((row) =>
    `${row.model.padEnd(MODEL_WIDE)}${row.cell.padEnd(CELL_WIDE)}${String(row.runs).padStart(6)}`
    + `${row.spend.wall.toFixed(1).padStart(10)}${row.spend.calls.toFixed(1).padStart(11)}`
    + `${row.spend.gate.toFixed(1).padStart(7)}${thin(row.spend.over)}`),
  ...elided(cut, all),
];

/** What each cell delivered, beside what it cost: the cut is where a dispatcher decides, so it is
 *  the last place a comparison may be left standing on minutes alone. */
const cutGotLines = (cut, all) => {
  const rows = cut.flatMap((row) => row.got.map((one) => ({ ...one, cell: row.cell, model: row.model })));
  return [
    "",
    `${"model".padEnd(MODEL_WIDE)}${"rung/complexity".padEnd(CELL_WIDE)}${"figure".padEnd(FIGURE_WIDE)}`
    + `${"count/over".padStart(14)}`,
    ...capped(rows, all).map((one) =>
      `${one.model.padEnd(MODEL_WIDE)}${one.cell.padEnd(CELL_WIDE)}${one.name.padEnd(FIGURE_WIDE)}`
      + `${said(one).padStart(14)}${thin(one.over)}`),
    ...elided(rows, all),
  ];
};

/** The shortfall said in full where nothing clears the floor: a reader given an empty block cannot
 *  tell a reading that compared nothing from one whose comparisons were left out. */
export const comparableLines = (comparable, models, all) => {
  if (!comparable.length) {
    return ["", "what this reading compares",
      `  no pair of models reaches ${FLOOR} observation(s) on one figure inside one cell, over `
      + `${models} model(s), so this reading compares no model with another`];
  }
  return ["", "what this reading compares",
    ...capped(comparable, all).map((one) =>
      `  ${one.cell.padEnd(18)}${one.figure.padEnd(FIGURE_WIDE)}${one.pair.join(" with ")}`),
    ...elided(comparable, all)];
};

export const modelLines = (held, all = false) => [
  ...spendLines(held.models),
  ...gotLines(held.models, held.read),
  ...cutLines(held.cut, all),
  ...cutGotLines(held.cut, all),
  ...comparableLines(held.comparable, held.models.length, all),
];

export const readingOf = (runs, read, declared, corpus = runs.length) => {
  const models = modelRows(runs, read, declared);
  const cut = cutRows(runs, read, declared);
  return {
    runs: runs.length,
    corpus,
    from: runs.length ? runs[0].startedAt : null,
    to: runs.length ? Math.max(...runs.map((run) => run.endedAt)) : null,
    floor: FLOOR,
    models,
    cut,
    comparable: comparableIn(cellsOf(models, cut)),
    read: { horizon: read.horizon, now: read.now, requests: read.spent.requests },
  };
};

/** The whole corpus and the part of it a window leaves, kept apart. The pairing a ruling and a park
 *  are resolved by is the whole corpus's — a competitor outside the window still spoils a match, so
 *  a narrower `--since` that hid it would hand the run inside the window evidence nobody earned. */
export const windowedIn = (root, from, classes) => {
  const read = runsUnder(root, null, classes);
  const runs = from ? read.runs.filter((run) => run.endedAt >= from) : read.runs;
  return { ...read, corpus: read.runs, runs, outsideWindow: read.runs.length - runs.length };
};

export const printModels = async (rest) => {
  const { since, checkout, horizon, requests, json } = flags(rest, VERB, ["--json"], { usage: MODELS_USAGE });
  const from = windowFrom(since);
  const directory = checkoutFrom(checkout, VERB);
  const root = rootFor(directory);
  const declared = declaredIn(directory);
  const { corpus, runs, skipped, outsideWindow, unreadable, sources } =
    windowedIn(root, from, classesFor(declared));
  const aside = readingAside({ skipped, outsideWindow, unreadable });
  if (!runs.length) {
    return console.log(`No issue-flow run for this project${since ? ` in the last ${since}` : ""}. ${aside}.\n`
      + `${sourceLines(sources).join("\n")}`
      + derivedFrom(directory));
  }
  const read = await outcomeReadFor(corpus, runs, directory,
    { horizon: horizonOf(horizon, VERB), most: spend(requests, VERB) });
  const held = readingOf(runs, read, declared, corpus.length);
  if (json) return console.log(JSON.stringify({ root, sources, project: directory, ...held }, null, 2));
  console.log(`${held.runs} issue-flow run(s)${since ? ` in the last ${since}` : ""} over `
    + `${held.models.length} model(s), ${stamp(held.from)} to ${stamp(held.to)}`);
  console.log(`${sourceLines(sources).join("\n")}\n${aside}`);
  for (const line of modelLines(held)) console.log(line);
  return null;
};
