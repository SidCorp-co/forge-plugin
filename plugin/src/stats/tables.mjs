/* The two tables a run's time is divided by, the listing every other block is printed through, the
   lines the token and the condition readings print, and what a class this reading could not
   recognise prints instead — docs/cli/stats-the-tables.md. */
import { DECLARABLE, DECLARES, declares } from "./corpus/declared.mjs";
import { FROM_PROJECT } from "../resolve/settings.mjs";
import { MARKERS, RUNG_UNKNOWN } from "./corpus/transcripts.mjs";
import { PHASES } from "../guides/phases.mjs";
import { RUNGS } from "../ladder.mjs";
import { medianOrZero, minutes, scaled } from "./figures.mjs";

const ROWS = 10;
export const UNRECOGNISED = "unrecognised";

export const emptyPhase = () => PHASES.map(() => ({ seconds: 0, calls: 0, byClass: new Map() }));

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
  /* The closing report is generation the wall counts and no phase did, off the loop's own cursor (ISS-308). */
  if (calls.length) phases[calls.at(-1).phase].seconds += Math.max(0, endedAt - last) / 1000;
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
  "a rung here is the run's own record and nothing else: this reading asks the tracker nothing, so a "
  + "run whose record never reached its transcript is at no rung however the backlog reads",
  `${"rung".padEnd(RUNG_WIDTH)}${"runs".padStart(5)}${"min med".padStart(9)}${"min sum".padStart(9)}`
  + `${"calls med".padStart(11)}${"consults".padStart(10)}${"gates".padStart(GATES)}`,
  ...held.rungs.map((row) =>
    `${row.rung.padEnd(RUNG_WIDTH)}${String(row.runs).padStart(5)}${row.medianMinutes.toFixed(1).padStart(9)}`
    + `${row.totalMinutes.toFixed(0).padStart(9)}${row.medianCalls.toFixed(1).padStart(11)}`
    + `${row.medianConsults.toFixed(1).padStart(10)}`
    + `${String(countIn(held, "gate", row.medianGates.toFixed(1))).padStart(GATES)}`),
];

export const capped = (rows, all) => (all ? rows : rows.slice(0, ROWS));
export const elided = (rows, all) =>
  (!all && rows.length > ROWS ? [`  (${rows.length - ROWS} more; --json for all)`] : []);

export const listing = (title, rows, line, all) =>
  (rows.length ? ["", title, ...capped(rows, all).map(line), ...elided(rows, all)] : []);

/* Which row leaves a phase unreachable: the row itself where nothing was classed as anything it opens on, else the row its `after` names — a row whose own classes are recognised is still shut where the phase it waits on cannot open, and the last phase is now such a row rather than one a fallback to the nearest number reached (ISS-1586, ISS-1714). */
const blocking = (held, row) => {
  if (!row) return null;
  if (row.classes.every((one) => held.unrecognised.includes(one))) return row;
  return row.after === undefined ? null : blocking(held, MARKERS.find((one) => one.phase === row.after));
};

/* A phase opened by nothing this reading recognises has no runs for a reason it can state, which is not the same answer as a flow that never reached it. The nearest marker at or below the row, because a phase past an unrecognised one is unreachable for that same reason and would otherwise print the most confident zero in the table (ISS-1586). */
const phaseReason = (held, at) => {
  const marker = blocking(held, MARKERS.filter((row) => row.phase <= at).at(-1));
  if (!marker) return null;
  const said = marker.classes.join(" or ");
  return marker.phase === at
    ? `${UNRECOGNISED}: nothing here was classed ${said}`
    : `${UNRECOGNISED}: reached only past a call classed ${said}, and nothing here was`;
};

const phaseRow = (held, phase, at) => {
  const reason = phaseReason(held, at);
  if (reason) return `${phase.name.padEnd(12)}${reason}`;
  return `${phase.name.padEnd(12)}${String(phase.runs).padStart(5)}${phase.medianMinutes.toFixed(1).padStart(9)}`
    + `${phase.totalMinutes.toFixed(0).padStart(9)}${phase.medianCalls.toFixed(1).padStart(11)}  `
    + phase.byClass.map(([label, one]) => `${label} ${one.calls} ${minutes(one.wait).toFixed(0)}m`).join(" · ");
};

export const phaseLines = (held) => [
  "",
  `${"phase".padEnd(12)}${"runs".padStart(5)}${"min med".padStart(9)}${"min sum".padStart(9)}`
  + `${"calls med".padStart(11)}  what fills it (calls, wait)`,
  ...held.phases.map((phase, at) => phaseRow(held, phase, at)),
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
  ? [`  declare ${held.unrecognised.map((one) => `\`${DECLARES}.${one}\``).join(", ")} `
    + `in the ${FROM_PROJECT} at the root of the checkout profiled, or this reading counts none of it`]
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
