/* What `forge advance --owed` prints about the rung: apart from ladder.mjs because that answers
   which rung and this answers how to say it, and a report is where prose accumulates. Printed at
   every rung, a route nobody is shown being one they infer. */
import {
  FEATURE, LIGHTER, SPARES, TIERS, heightOf, markedIn, resizeForm, tierIn, tierOf,
} from "./ladder.mjs";
import { looksTo, planFlags } from "./flow/machine.mjs";

/* Past the widest label, so a hanging line clears it. */
const WIDTH = 18;
const lighterLines = (tier) => LIGHTER.filter((one) => one.tiers.includes(tier)).map((one) =>
  `  ${`at ${one.status}`.padEnd(WIDTH)}not owed: ${one.drops}\n  ${" ".repeat(WIDTH)}  because ${one.because}`);

const spareLines = (tier) => SPARES[tier].map((one, at) =>
  `  ${(at ? "" : "and fewer rounds").padEnd(WIDTH)}${one}`);

const markSaid = (description) => {
  const claimed = markedIn(description);
  return claimed
    ? `This issue is marked \`Size: ${claimed}.\`, so it is a \`${claimed}\``
    : `This issue carries no size mark, so it is a \`${FEATURE}\``;
};

const climbSaid = ({ description, plan }, tier) => {
  const claimed = tierIn(description);
  if (tier === claimed) return null;
  const declared = looksTo(planFlags(plan));
  const byPlan = declared && heightOf(claimed) < TIERS.length - 1;
  return byPlan && TIERS[heightOf(claimed) + 1] === tier
    ? `its plan declares ${declared}, which moves it one rung to \`${tier}\``
    : `a correction re-sized it to \`${tier}\``;
};

const routesOff = (tier, ref) => (tier === FEATURE ? [] : [
  "Two routes up, both belonging before the plan —",
  `  a plan declaring a screen change or a user-facing outcome:  forge plan ${ref} <plan.md>`,
  `  the work turned out larger:  ${resizeForm(ref, tier)}`,
]);

export const sizeReport = (size, ref) => {
  const { description, whole } = size;
  if (whole === false) {
    return [`${markSaid(description)}, and the page above was shortened: a cut cannot show a`,
      "correction that re-sized it, so the tier is not applied and the full set is asked."].join("\n");
  }
  const tier = tierOf(size);
  const climbed = climbSaid(size, tier);
  const opened = `${markSaid(description)}${climbed ? `, and ${climbed}` : ""}. The entry checks run that tier:`;
  const dropped = lighterLines(tier);
  return [
    opened,
    ...(dropped.length ? dropped : [`  ${"nothing dropped".padEnd(WIDTH)}a feature owes the whole set, which is what the tiers below it are measured against`]),
    ...spareLines(tier),
    "Every other demand below stands as a feature's does — the confirmation with its where, the",
    "criteria, the baseline, the merged mark, the review of the head that landed, a verdict on every",
    "criterion, the verification, and the migration classification where a plan declares schema",
    "coupling, which no tier drops.",
    ...routesOff(tier, ref),
  ].join("\n");
};

