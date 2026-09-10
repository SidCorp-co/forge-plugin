/* What `forge advance --owed` prints about the rung: apart from ladder.mjs because that answers
   which rung and this answers how to say it, and a report is where prose accumulates. Printed at
   every rung, a route nobody is shown being one they infer. */
import {
  FEATURE, FIELD_SAID, LIGHTER, RUNGS, SPARES, climbForm, heightOf, rungClaimed, rungOf, splits,
} from "./ladder.mjs";
import { looksTo, planFlags } from "./flow/machine.mjs";

/* Past the widest label so a hanging line clears it, measured off the labels: a literal is a column only until a status is renamed longer than it (ISS-1022). */
const WIDTH = Math.max(...LIGHTER.map((one) => one.status.length + 4), 18);
const lighterLines = (rung) => LIGHTER.filter((one) => one.rungs.includes(rung)).map((one) =>
  `  ${`at ${one.status}`.padEnd(WIDTH)}not owed: ${one.drops}\n  ${" ".repeat(WIDTH)}  because ${one.because}`);

const spareLines = (rung) => SPARES[rung].map((one, at) =>
  `  ${(at ? "" : "and fewer rounds").padEnd(WIDTH)}${one}`);

/* Two sentences and no third: a rung something claimed, and an absence. A reader told it holds none learns what to set; one told a value learns which value the rung was read off, and neither has to be read as the other. */
const markSaid = ({ rung, complexity }) =>
  (complexity
    ? `This issue is a \`${rung}\`: ${FIELD_SAID} is \`${complexity}\``
    : `This issue holds no complexity on the tracker, so it is a \`${FEATURE}\``);

/* Advice and no demand: what a rung owes is the contract's, and asking is what the two largest
   values are worth. */
const splitAsk = (complexity) => (splits(complexity) ? [
  "Its complexity on the tracker is one of the two largest, so before the plan there is one question",
  "to answer: is this one change, or several? Several is one issue each, every body naming the",
  "others, and this one confirmed as the first of them. Nothing above is owed differently either way.",
] : []);

const climbSaid = (plan, claimed, rung) => {
  if (rung === claimed) return null;
  const declared = looksTo(planFlags(plan));
  const byPlan = declared && heightOf(claimed) < RUNGS.length - 1;
  return byPlan && RUNGS[heightOf(claimed) + 1] === rung
    ? `its plan declares ${declared}, which moves it one rung to \`${rung}\``
    : `a correction moved it up to \`${rung}\``;
};

const routesOff = (rung, ref) => (rung === FEATURE ? [] : [
  "Two routes up, both belonging before the plan —",
  `  a plan declaring a screen change or a user-facing outcome:  forge record plan ${ref} <plan.md>`,
  `  the work turned out larger:  ${climbForm(ref, rung)}`,
]);

export const rungReport = (fields, ref) => {
  const { whole } = fields;
  /* Read once and passed: both sentences below want the same answer, and it costs a fence strip. */
  const claimed = rungClaimed(fields);
  if (whole === false) {
    return [`${markSaid(claimed)}, and the page above was shortened: a cut cannot show a`,
      "correction that moved it up, so the rung is not applied and the full set is asked."].join("\n");
  }
  const rung = rungOf(fields);
  const climbed = climbSaid(fields.plan, claimed.rung, rung);
  const opened = `${markSaid(claimed)}${climbed ? `, and ${climbed}` : ""}. The entry checks run that rung:`;
  const dropped = lighterLines(rung);
  return [
    opened,
    ...(dropped.length ? dropped : [`  ${"nothing dropped".padEnd(WIDTH)}a feature owes the whole set, which is what the rungs below it are measured against`]),
    ...spareLines(rung),
    ...splitAsk(fields.complexity),
    "Every other demand below stands as a feature's does — the confirmation with its where, the",
    "criteria, the baseline, the merged mark, the review of the head that landed, a verdict on every",
    "criterion, the verification, and the migration classification where a plan declares schema",
    "coupling, which no rung drops.",
    ...routesOff(rung, ref),
  ].join("\n");
};
