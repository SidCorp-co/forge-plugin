/* What the daily page opens with: one tile per goal metric, the day's value beside the seven days
   before and whether the move is better or worse. A metric's direction and the goal it serves are
   declared here, beside how it is read, and nowhere else: the page, `--json` and the terminal all
   read them off this table. Why a metric is per day or per closed issue and never per run, and what
   arithmetic this page does over the readers' figures: docs/cli/stats.md. */
import { weekBefore } from "./day.mjs";
import { MISSING, consultsSection, frictionOf, runsOn } from "./gather.mjs";
import { entriesOf } from "./opportunities.mjs";
import { median } from "../median.mjs";

const LOWER = "lower";
const HIGHER = "higher";
const PERCENT = "%";

/* The kind the opportunities ranking prices in minutes waited: a wait is a call that ran, not one lost. */
const WAIT = "wait";

const tenth = (value) => Math.round(value * 10) / 10;
const percentOf = (part, whole) => (whole ? tenth((part / whole) * 100) : null);

/** The calls the opportunities ranking counts as paid over a set of runs, waits apart, beside every
 *  call those runs made: one pricing of a lost call, so the tile and the friction list agree. */
const wastedOf = (reading, day) => {
  const runs = runsOn(reading.all, day);
  if (!runs.length) return null;
  const calls = runs.reduce((sum, run) => sum + run.calls, 0);
  const lost = entriesOf(frictionOf(runs)).filter((one) => one.kind !== WAIT).reduce((sum, one) => sum + one.calls, 0);
  return { value: percentOf(lost, calls), detail: `${lost} of ${calls} call(s)` };
};

const atBudgetOf = (reading, day) => {
  const { atBudget, budgeted } = consultsSection(reading.entries, day).headline;
  if (!budgeted) return null;
  return { value: percentOf(atBudget, budgeted), detail: `${atBudget} of ${budgeted} consult(s) that recorded a budget` };
};

const CLOSED_READER = { reading: "the issues closed a day and the agent minutes that went to them", issue: "ISS-2599" };

/* The figures of the page's reading a tile's value is made of: the day's refused calls and each listed
   opportunity's lost calls are wasted calls, a wait apart, and the consults at their budget over those
   that recorded one are that tile's two terms. */
const LISTED_CALLS = /^opportunities\.listed\[#(\d+)\]\.calls$/u;

const wastedFrom = (key, content) => {
  if (key === "friction.headline.refusals") return true;
  const listed = LISTED_CALLS.exec(key);
  return Boolean(listed) && content?.opportunities?.listed?.[Number(listed[1]) - 1]?.kind !== WAIT;
};

const atBudgetFrom = (key) => key === "consults.headline.atBudget" || key === "consults.headline.budgeted";

/** The metrics, in the order the tiles stand. `fedBy` says whether a figure of the page's reading, by
 *  its key, is one the tile's value is made of, so a decision citing it points at this tile; a metric
 *  no reader computes is made of no figure. `of` reads the metric's value for a day, and a metric
 *  without one names the reader it waits for. */
export const METRICS = [
  { id: "closed", label: "issues closed", unit: "", better: HIGHER, goal: "G-11", missing: CLOSED_READER },
  { id: "minutesPerClosed", label: "agent minutes per closed issue", unit: " min", better: LOWER, goal: "G-11", missing: CLOSED_READER },
  { id: "firstGate", label: "landings that passed their first gate", unit: PERCENT, better: HIGHER, goal: "G-11",
    missing: MISSING.firstGate },
  { id: "ownerWait", label: "owner wait minutes", unit: " min", better: LOWER, goal: "G-11",
    missing: { reading: "the minutes work waited on a person each day", issue: "ISS-2600" } },
  { id: "wasted", label: "wasted calls, of all calls", unit: PERCENT, better: LOWER, goal: "G-11", of: wastedOf, fedBy: wastedFrom },
  { id: "atBudget", label: "consults that ended at their call budget", unit: PERCENT, better: LOWER, goal: "G-06",
    of: atBudgetOf, fedBy: atBudgetFrom },
];

/** The tile a figure of the page's reading feeds, or null where it feeds none that is computed. */
export const tileFedBy = (key, content) => METRICS.find((one) => one.of && one.fedBy?.(key, content)) ?? null;

/** Which way a change reads under the metric's declared direction, or null where there is nothing to judge. */
export const verdictOf = (better, change) => {
  if (change === null) return null;
  if (change === 0) return "steady";
  return (change < 0) === (better === LOWER) ? "better" : "worse";
};

const tileOf = (metric, reading, day) => {
  const declared = { metric: metric.id, label: metric.label, unit: metric.unit, better: metric.better, goal: metric.goal };
  if (!metric.of) {
    return { ...declared, value: null, detail: null, baseline: null, baselineDays: 0, change: null, verdict: null, missing: metric.missing };
  }
  const held = metric.of(reading, day);
  const before = weekBefore(day).map((one) => metric.of(reading, one)?.value).filter((one) => one !== null && one !== undefined);
  const baseline = before.length ? tenth(median(before)) : null;
  const value = held?.value ?? null;
  const change = value === null || baseline === null ? null : tenth(value - baseline);
  return { ...declared, value, detail: held?.detail ?? null, baseline, baselineDays: before.length, change,
    verdict: verdictOf(metric.better, change), missing: null };
};

/** Every tile for a day, off the corpora and logs the page was read from. */
export const scorecardOf = (reading, day) => METRICS.map((metric) => tileOf(metric, reading, day));

/** A value with its unit, or the words for its absence. */
export const withUnit = (value, unit) => (value === null || value === undefined ? "none" : `${value}${unit}`);

/** A change signed, a percentage's in points, since a share moving from 10% to 12% moved two points and not 2%. */
export const changeSaid = (change, unit) => {
  if (change === null) return null;
  const sign = change > 0 ? "+" : "";
  return `${sign}${change}${unit === PERCENT ? " pt" : unit}`;
};

/** What a tile says of its move in words, which is what its colour and arrow repeat. */
export const moveSaid = (tile) => {
  if (tile.value === null) return "none on this day";
  if (tile.baseline === null) return "no baseline: the seven days before hold none";
  return `${changeSaid(tile.change, tile.unit)}, ${tile.verdict}`;
};

const lineOf = (tile) => {
  const declared = `${tile.better} is better, ${tile.goal}`;
  if (tile.missing) return `  ${tile.label}: not computed yet, ${tile.missing.issue} owes its reader (${declared})`;
  if (tile.value === null) return `  ${tile.label}: ${moveSaid(tile)} (${declared})`;
  const against = tile.baseline === null ? "" : ` against ${withUnit(tile.baseline, tile.unit)}`;
  return `  ${tile.label}: ${withUnit(tile.value, tile.unit)}${against}, ${moveSaid(tile)} (${declared})`;
};

/** The scorecard as the terminal prints it: one line per metric, under the line saying what it is set against. */
export const scorecardLines = (scorecard) => (scorecard?.length
  ? ["Scorecard, the day against the median of the seven days before:", ...scorecard.map(lineOf)]
  : []);
