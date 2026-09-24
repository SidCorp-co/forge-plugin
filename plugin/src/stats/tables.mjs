/* The two tables a run's time is divided by, the listing every other block is printed through, the
   lines the token and the condition readings print, and what a class this reading could not
   recognise prints instead — docs/cli/stats-the-tables.md. */
import { DECLARABLE, DECLARES, declares } from "./corpus/declared.mjs";
import { RUNG_UNKNOWN } from "./corpus/transcripts.mjs";
import { PHASES } from "../guides/phases.mjs";
import { RUNGS } from "../ladder.mjs";
import { FORGE_ROW } from "./corpus/classes.mjs";
import { medianOrZero, minutes, scaled, share } from "./figures.mjs";

const ROWS = 10;
export const UNRECOGNISED = "unrecognised";

const emptyPhase = () => PHASES.map(() => ({ seconds: 0, calls: 0, byClass: new Map() }));

export const foldPhases = (calls, startedAt, endedAt) => {
  const phases = emptyPhase();
  let last = startedAt;
  for (const call of calls) {
    const held = phases[call.phase];
    held.calls += 1;
    held.seconds += Math.max(0, call.endedAt - last) / 1000;
    const was = held.byClass.get(call.class) ?? { calls: 0, wait: 0 };
    held.byClass.set(call.class, { calls: was.calls + 1, wait: was.wait + call.wait });
    last = Math.max(last, call.endedAt);
  }
  /* The closing report is generation the wall counts and no phase did, credited to the phase the run
     stands in and never to the last call's own row, which a row declared `only` books elsewhere
     (ISS-308, ISS-1913). */
  if (calls.length) phases[calls.at(-1).cursor].seconds += Math.max(0, endedAt - last) / 1000;
  return phases;
};

/* One row per rung the ladder has, plus one for the runs that named none: folded into a rung those
   would flatter it, and dropped they would make the rows fail to add up to the corpus. The rungs'
   own order, so the table reads as the ladder and a rung no run reached still has its row saying so
   — a rung absent from a profile is indistinguishable from a rung that costs nothing. */
export const perRung = (runs) => [...RUNGS, RUNG_UNKNOWN].map((rung) => {
  const held = runs.filter((run) => run.rung === rung);
  const seconds = held.map((run) => run.seconds);
  return {
    rung,
    runs: held.length,
    medianMinutes: minutes(medianOrZero(seconds)),
    totalMinutes: minutes(seconds.reduce((sum, one) => sum + one, 0)),
    medianCalls: medianOrZero(held.map((run) => run.calls)),
    medianConsults: medianOrZero(held.map((run) => run.consults)),
    medianGates: medianOrZero(held.map((run) => run.gates)),
  };
});

const RUNG_WIDTH = 10;
/* Wide enough for the word rather than the figure, a rung's gate median being the second place the same unrecognised class would otherwise print a measured nought (consult 3a4f1e F1). */
const GATES = UNRECOGNISED.length + 2;
export const rungLines = (held) => [
  "",
  "a rung here is the run's own record and nothing else: this reading asks the tracker for this "
  + "project's release model and reads no issue, so a run whose record never reached its transcript "
  + "is at no rung however the backlog reads",
  `${"rung".padEnd(RUNG_WIDTH)}${"runs".padStart(5)}${"min med".padStart(9)}${"min sum".padStart(9)}`
  + `${"calls med".padStart(11)}${"consults".padStart(10)}${"gates".padStart(GATES)}`,
  ...held.rungs.map((row) =>
    `${row.rung.padEnd(RUNG_WIDTH)}${String(row.runs).padStart(5)}${row.medianMinutes.toFixed(1).padStart(9)}`
    + `${row.totalMinutes.toFixed(0).padStart(9)}${row.medianCalls.toFixed(1).padStart(11)}`
    + `${row.medianConsults.toFixed(1).padStart(10)}`
    + `${String(countIn(held, "gate", row.medianGates.toFixed(1))).padStart(GATES)}`),
];

/* The two tables of a text a run reads on its own need — a guide part, and a verb's help — carry the
   same three columns at the same widths, so a reader can hold one against the other. */
const READ_WIDTH = 36;
export const readHeader = (title) =>
  `${title.padEnd(READ_WIDTH)}${"calls".padStart(7)}${"runs".padStart(6)}${"read again".padStart(12)}`;
export const readRow = ([key, one]) => `${key.padEnd(READ_WIDTH)}${String(one.calls).padStart(7)}`
  + `${String(one.runs).padStart(6)}${String(one.again).padStart(12)}`;

/* Help is the largest served surface this CLI has and the class table cannot report a read of it:
   `forge record verdict -h` and a verdict written are one class, so a per-class figure is a mixture
   of what a run did and what it looked up. The share is what says how much — over the calls made to
   this CLI, since a lookup is a lookup of one of those, and never over every call a run made. The
   median is over the runs that read any, which is the population it is a median of: a run that read
   none is not a run that found help cheap. */
export const helpOver = (runs, byClass) => {
  const reads = runs.map((run) => [...run.helpReads.values()].reduce((sum, many) => sum + many, 0));
  const read = reads.filter((many) => many > 0);
  const calls = reads.reduce((sum, many) => sum + many, 0);
  const forgeCalls = byClass
    .filter(([label]) => label.startsWith(FORGE_ROW))
    .reduce((sum, [, one]) => sum + one.calls, 0);
  return { calls, forgeCalls, share: share(calls, forgeCalls), runs: read.length, perRun: medianOrZero(read) };
};

export const helpLine = (held) =>
  `help reads      ${held.help.calls} of ${held.help.forgeCalls} call(s) to this CLI (${held.help.share}), `
  + `read in ${held.help.runs} of ${held.runs} run(s), median ${held.help.perRun}/run over those`;

export const capped = (rows, all) => (all ? rows : rows.slice(0, ROWS));
export const elided = (rows, all) =>
  (!all && rows.length > ROWS ? [`  (${rows.length - ROWS} more; --json for all)`] : []);

export const listing = (title, rows, line, all) =>
  (rows.length ? ["", title, ...capped(rows, all).map(line), ...elided(rows, all)] : []);

/* Every phase is reachable on every project, so a zero here is a run that did not get there and
   never a class this reading could not see: the last phases were the two that read `unrecognised`,
   for want of a marker that is not a command a project declares, and they now open on this CLI's own
   records as the ones before them always have (ISS-1586, ISS-1975). */
const phaseRow = (held, phase) => {
  return `${phase.name.padEnd(12)}${String(phase.runs).padStart(5)}${phase.medianMinutes.toFixed(1).padStart(9)}`
    + `${phase.totalMinutes.toFixed(0).padStart(9)}${phase.medianCalls.toFixed(1).padStart(11)}  `
    + phase.byClass.map(([label, one]) => `${label} ${one.calls} ${minutes(one.wait).toFixed(0)}m`).join(" · ");
};

export const phaseLines = (held) => [
  "",
  `${"phase".padEnd(12)}${"runs".padStart(5)}${"min med".padStart(9)}${"min sum".padStart(9)}`
  + `${"calls med".padStart(11)}  what fills it (calls, wait)`,
  ...held.phases.map((phase) => phaseRow(held, phase)),
];

/** A class this reading could not recognise: nothing in the window was classed as it and the checkout declares no command for it. Zero and unrecognised are different answers, which is the rule this verb's outcome figures already keep (ISS-1586). */
export const unrecognisedIn = (byClass, declared) =>
  DECLARABLE.filter((label) =>
    !declares(label, declared) && !byClass.some(([one]) => one === label));

export const countIn = (held, label, value) => (held.unrecognised.includes(label) ? UNRECOGNISED : value);

/* The ships line in full or not at all: a pass count and a median over a class nothing was ever classed as are two more zeroes a reader would take for measurement. */
export const shipLine = (held) => {
  if (held.unrecognised.includes("ship")) return `ships           ${UNRECOGNISED}`;
  return `ships           ${held.ships.passes} pass(es), median ${held.ships.perRun}/run, `
    + `${held.ships.resumed} resumed with --from, a push rejected in ${held.ships.rejectedRuns} run(s)`;
};

/** What an unrecognised class says to do about it, and nothing where every class was recognised. */
export const declareLines = (held) => (held.unrecognised.length
  /* Named as a command and not as a file: the record belongs to the checkout that was PROFILED and
     `fromProject()` would answer for the one this process stands in, which is a different project
     whenever a reading is taken of somewhere else. Typed in that checkout, the verb resolves it. */
  ? [`  declare ${held.unrecognised.map((one) => `\`${DECLARES}.${one}\``).join(", ")} `
    + "with `forge doctor --set` in the checkout profiled, or this reading counts none of it"]
  : []);

const priced = (held) => `${scaled(held.cacheRead)} cache read, ${scaled(held.cacheCreate)} cache written, `
  + `${scaled(held.output)} out, ${scaled(held.input)} in`;

/* Three readings and so three lines, each naming what it was taken over: the median a run cost, the
   window's own sums, and what one request cost. The middle line is what makes the ratio per run
   derivable without the median being offered as it — they are two statistics. */
export const tokenLines = (held) => [
  `tokens          median/run ${priced(held.perRun)}, over ${held.runs} run(s) holding a `
    + `measured request and ${held.unmeasuredRuns} holding none`,
  `in all          ${priced(held.total)}, over ${held.requests} measured request(s), `
    + `and ${held.unmeasured} record(s) carried no measurement`,
  `per request     ${priced(held.perRequest)}`,
];

/* Prints what `runs.mjs`'s `conditionOver` folds; the reason each of the three belongs here is
   stated on that function and not repeated — docs/cli/stats-the-condition.md. */
export const conditionLines = (held, population, all) => [
  `compactions     ${scaled(held.compactions.met)} across ${scaled(held.compactions.runs)} of `
    + `${population} run(s), a run that lost what it knew and carried on`,
  `api errors      ${scaled(held.apiErrors)} request(s) came back as errors, apart from any refusal `
    + "this plugin wrote",
  `human prompts   ${scaled(held.humanPrompts.met)} typed inside ${scaled(held.humanPrompts.runs)} `
    + `of ${population} run(s) — a person present inside a run this harness dispatched, never `
    + "whether the run was itself a person's own session",
  ...listing("run(s) a human prompt showed up inside, named rather than folded into a share",
    held.humanPrompts.named, (one) => `  ${String(one.prompts).padStart(4)}  ${one.ref}`, all),
];
