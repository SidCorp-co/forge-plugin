/* `forge stats models` — which model ran each run, and what a run of that model spent against what
   it got. The rows and the floor are `model-rows.mjs`; this is the subject and its lines. */
import { FLOOR, THIN, enough, readingOf, windowedIn } from "./model-rows.mjs";
import { checkoutFrom, derivedFrom, readingAside, sourceLines, windowFrom } from "./runs.mjs";
import { horizonOf, outcomeReadFor, saidHorizon, spend } from "./eval/eval.mjs";
import { UNRECOGNISED, capped, elided } from "./tables.mjs";
import { classesFor } from "./corpus/classes.mjs";
import { phase7For } from "./corpus/release.mjs";
import { declaredIn } from "./corpus/declared.mjs";
import { UNAVAILABLE } from "./eval/outcomes.mjs";
import { rootFor } from "./corpus/corpus.mjs";
import { flags } from "../resolve/flags.mjs";
import { stamp } from "./figures.mjs";

const VERB = "stats models";

export const MODELS_USAGE = [
  "Usage: forge stats models [--since 3d] [--checkout <dir>] [--horizon 1d] [--requests n] [--json]",
  "Which model ran each issue-flow run of a checkout, and what a run of that model spent against what",
  "it got — so a dispatcher can read which kinds of issue a cheaper model handles as well. Nothing is",
  "written. The spend figures are `stats runs`'s own; the outcome figures read the tracker, as",
  "`stats eval`'s do, and so does a rung the run's own record did not reach the transcript with —",
  "which is why a run can sit at a rung here and at none under `stats runs`.",
  "",
  "Every figure prints the population it was counted over. A figure under ten observations of its own",
  "carries `thin`, and two arms are compared only where that figure reaches ten on both of them inside",
  "one cell — so an arm with runs to spare is still thin in a rung it barely entered.",
  "",
  "  --since 3d     the window, in d, h or m; the whole corpus unless you say otherwise",
  "  --checkout <dir>  an absolute directory, whose transcript root is derived from its path;",
  "                 the checkout the working directory belongs to unless you say otherwise",
  "  --horizon 1d   how long after a run an outcome still counts as its own; one day otherwise",
  "  --requests n   the tracker requests this reading may spend; past it an outcome figure prints",
  "                 unavailable, or `cut short` with the pairs it left unread where it read some,",
  "                 and every cost figure still prints",
  "  --json         every figure, its population and every comparable pair, as one object",
].join("\n");

const thin = (over, runs) => (enough(over, runs) ? "" : `  ${THIN}`);
const said = (figure) => (figure.count === null ? UNAVAILABLE : `${figure.count}/${figure.over}`);

/* On the row and not only in JSON: a count over the part a read reached prints like a whole one, and
   the budget it ran out of is the flag that reads more. */
const shortfall = (figure, read) => {
  if (!figure.unreadPairs) return "";
  const unread = `${figure.unreadPairs} pair(s) unread`;
  return figure.cut ? `  cut short, ${unread}: --requests above ${read?.most}` : `  ${unread}`;
};

const MODEL_WIDE = 26;
const FIGURE_WIDE = 26;
const CELL_WIDE = 18;
const COUNT_WIDE = 14;
const RUNS_WIDE = 6;
/* Wide enough for the word rather than the figure, as the rung table's gate column is. */
const MEASURED = UNRECOGNISED.length + 2;

/* A median over a class this reading never recognised is the confident nought `stats runs` refuses
   to print, so the word stands in its place here too. */
const spent = (row, name, value) =>
  ((row.spend.unrecognised ?? []).includes(name) ? UNRECOGNISED : value.toFixed(1));

const spendLines = (rows) => [
  "",
  `${"model".padEnd(MODEL_WIDE)}${"runs".padStart(6)}${"wall med".padStart(10)}${"tool med".padStart(10)}`
  + `${"calls med".padStart(11)}${"gate".padStart(MEASURED)}${"consult".padStart(9)}${"recheck".padStart(9)}`,
  ...rows.map((row) =>
    `${row.model.padEnd(MODEL_WIDE)}${String(row.spend.over).padStart(6)}`
    + `${row.spend.wall.toFixed(1).padStart(10)}${row.spend.tool.toFixed(1).padStart(10)}`
    + `${row.spend.calls.toFixed(1).padStart(11)}${spent(row, "gate", row.spend.gate).padStart(MEASURED)}`
    + `${row.spend.consult.toFixed(1).padStart(9)}${row.spend.recheck.toFixed(1).padStart(9)}`
    + thin(row.spend.over, row.runs)),
];

/* The runs behind a figure beside its count, because a pair figure's count is not its runs: forty-one
   pairs can be one run, and only `--json` said which. */
const delivered = (one, row, read) => {
  const runs = one.runs ?? row.runs;
  return `${said(one).padStart(COUNT_WIDE)}${String(runs).padStart(RUNS_WIDE)}`
    + `${thin(one.over, runs)}${shortfall(one, read)}`;
};

const gotLines = (rows, read) => [
  "",
  `what a run of each model got — horizon ${saidHorizon(read.horizon)}, read ${stamp(read.now)}`,
  `${"model".padEnd(MODEL_WIDE)}${"figure".padEnd(FIGURE_WIDE)}${"count/over".padStart(COUNT_WIDE)}`
  + `${"runs".padStart(RUNS_WIDE)}`,
  ...rows.flatMap((row) => row.got.map((one) =>
    `${row.model.padEnd(MODEL_WIDE)}${one.name.padEnd(FIGURE_WIDE)}${delivered(one, row, read)}`)),
];

/* Which reading answered the rung, said on the table that prints it: `stats runs` reads the same
   corpus and asks the tracker for no issue, so the two verbs class a run of this count differently
   and a reader meeting them apart has no other way to tell which reading each made (ISS-1979). */
const rungsRead = (held) =>
  `${held.rungsOffComplexity} of ${held.runs} run(s) are at the rung their issue's complexity `
  + "claims, no rung of their own having survived into the transcript; every other run is at the "
  + "rung it recorded there, or at none where neither source answered";

const cutLines = (cut, all, said) => [
  "",
  said,
  `${"model".padEnd(MODEL_WIDE)}${"rung/complexity".padEnd(CELL_WIDE)}${"runs".padStart(6)}`
  + `${"wall med".padStart(10)}${"calls med".padStart(11)}${"gate".padStart(MEASURED)}`,
  ...capped(cut, all).map((row) =>
    `${row.model.padEnd(MODEL_WIDE)}${row.cell.padEnd(CELL_WIDE)}${String(row.runs).padStart(6)}`
    + `${row.spend.wall.toFixed(1).padStart(10)}${row.spend.calls.toFixed(1).padStart(11)}`
    + `${spent(row, "gate", row.spend.gate).padStart(MEASURED)}${thin(row.spend.over, row.runs)}`),
  ...elided(cut, all),
];

/** What each cell delivered, beside what it cost. The rows are capped before their figures are
 *  spread, and by the cap the table above used: a row printed there and cut short here reads as an
 *  arm that delivered less. */
const cutGotLines = (cut, all, read) => [
  "",
  `${"model".padEnd(MODEL_WIDE)}${"rung/complexity".padEnd(CELL_WIDE)}${"figure".padEnd(FIGURE_WIDE)}`
  + `${"count/over".padStart(COUNT_WIDE)}${"runs".padStart(RUNS_WIDE)}`,
  ...capped(cut, all).flatMap((row) => row.got.map((one) =>
    `${row.model.padEnd(MODEL_WIDE)}${row.cell.padEnd(CELL_WIDE)}${one.name.padEnd(FIGURE_WIDE)}`
    + delivered(one, row, read))),
  ...elided(cut, all),
];

/** The shortfall said in full where nothing clears the floor: a reader given an empty block cannot
 *  tell a reading that compared nothing from one whose comparisons were left out. */
export const comparableLines = (comparable, models, all) => {
  if (!comparable.length) {
    return ["", "what this reading compares",
      `  no pair of models reaches ${FLOOR} observation(s) of one figure and ${FLOOR} run(s) behind `
      + `them inside one cell, over `
      + `${models} model(s), so this reading compares no model with another`];
  }
  return ["", "what this reading compares",
    ...capped(comparable, all).map((one) =>
      `  ${one.cell.padEnd(CELL_WIDE)}${one.figure.padEnd(FIGURE_WIDE)}${one.pair.join(" with ")}`),
    ...elided(comparable, all)];
};

export const modelLines = (held, all = false) => [
  ...spendLines(held.models),
  ...gotLines(held.models, held.read),
  ...cutLines(held.cut, all, rungsRead(held)),
  ...cutGotLines(held.cut, all, held.read),
  ...comparableLines(held.comparable, held.models.length, all),
];

export const printModels = async (rest) => {
  const { since, checkout, horizon, requests, json } = flags(rest, VERB, ["--json"], { usage: MODELS_USAGE });
  const from = windowFrom(since, VERB);
  const directory = checkoutFrom(checkout, VERB);
  const root = rootFor(directory);
  const declared = declaredIn(directory);
  const { corpus, runs, skipped, outsideWindow, unreadable, sources } =
    windowedIn(root, from, classesFor(declared, await phase7For(directory)));
  const aside = readingAside({ skipped, outsideWindow, unreadable });
  /* What the reading left out travels in JSON as it does in prose, `stats runs` carrying the same three. */
  const shape = { root, sources, project: directory, skipped, outsideWindow, unreadable };
  /* An empty window answers a reader asking for JSON in JSON: a consumer diffing two weeks meets the
     empty one first, and prose with a zero exit status is the shape it cannot parse. */
  if (!runs.length) {
    if (json) {
      return console.log(JSON.stringify({ ...shape, ...readingOf([], null, declared, corpus.length) }, null, 2));
    }
    return console.log(`No issue-flow run for this project${since ? ` in the last ${since}` : ""}. ${aside}.\n`
      + `${sourceLines(sources).join("\n")}`
      + derivedFrom(directory));
  }
  const read = await outcomeReadFor(corpus, runs, directory,
    { horizon: horizonOf(horizon, VERB), most: spend(requests, VERB) });
  const held = readingOf(runs, read, declared, corpus.length);
  if (json) return console.log(JSON.stringify({ ...shape, ...held }, null, 2));
  console.log(`${held.runs} issue-flow run(s)${since ? ` in the last ${since}` : ""} over `
    + `${held.models.length} model(s), ${stamp(held.from)} to ${stamp(held.to)}`);
  console.log(`${sourceLines(sources).join("\n")}\n${aside}`);
  for (const line of modelLines(held)) console.log(line);
  return null;
};
