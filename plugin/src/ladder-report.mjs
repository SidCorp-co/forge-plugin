/* What `forge advance --owed` prints about the rung: apart from ladder.mjs because that answers
   which rung and this answers how to say it, and a report is where prose accumulates. Printed at
   every rung, a route nobody is shown being one they infer. */
import {
  FEATURE, FIELD_SAID, LIGHTER, LINE_SAID, SPARES, TIERS, heightOf, resizeForm, sizeFrom, splits,
  tierOf,
} from "./ladder.mjs";
import { looksTo, planFlags } from "./flow/machine.mjs";

/* Past the widest label, so a hanging line clears it. */
const WIDTH = 18;
const lighterLines = (tier) => LIGHTER.filter((one) => one.tiers.includes(tier)).map((one) =>
  `  ${`at ${one.status}`.padEnd(WIDTH)}not owed: ${one.drops}\n  ${" ".repeat(WIDTH)}  because ${one.because}`);

const spareLines = (tier) => SPARES[tier].map((one, at) =>
  `  ${(at ? "" : "and fewer rounds").padEnd(WIDTH)}${one}`);

/* One sentence per source, so which of the two decided is read rather than inferred. */
const SOURCE_SAID = {
  [FIELD_SAID]: (rung) => `its size on the tracker is a \`${rung}\``,
  [LINE_SAID]: (rung) => `its body is marked \`Size: ${rung}.\``,
};

const said = (one) => SOURCE_SAID[one.from](one.rung);

const markSaid = ({ rung, decided, outranked }) => {
  if (!decided.length) return `This issue claims no size on either source, so it is a \`${FEATURE}\``;
  const under = outranked.map((one) => `${said(one)}, which does not lower a rung the other claimed`);
  return [`This issue is a \`${rung}\`: ${decided.map(said).join(", and ")}`, ...under].join("; ");
};

/* Advice and no demand: what a rung owes is the contract's, and asking is what the two largest
   values are worth. */
const splitAsk = (band) => (splits(band) ? [
  "Its size on the tracker is one of the two largest, so before the plan there is one question to",
  "answer: is this one change, or several? Several is one issue each, every body naming the others,",
  "and this one confirmed as the first of them. Nothing above is owed differently either way.",
] : []);

const climbSaid = (size, claimed, tier) => {
  const { plan } = size;
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
  const { whole } = size;
  /* Read once and passed: both sentences below want the same answer, and it costs a fence strip. */
  const claimed = sizeFrom(size);
  if (whole === false) {
    return [`${markSaid(claimed)}, and the page above was shortened: a cut cannot show a`,
      "correction that re-sized it, so the tier is not applied and the full set is asked."].join("\n");
  }
  const tier = tierOf(size);
  const climbed = climbSaid(size, claimed.rung, tier);
  const opened = `${markSaid(claimed)}${climbed ? `, and ${climbed}` : ""}. The entry checks run that tier:`;
  const dropped = lighterLines(tier);
  return [
    opened,
    ...(dropped.length ? dropped : [`  ${"nothing dropped".padEnd(WIDTH)}a feature owes the whole set, which is what the tiers below it are measured against`]),
    ...spareLines(tier),
    ...splitAsk(size.band),
    "Every other demand below stands as a feature's does — the confirmation with its where, the",
    "criteria, the baseline, the merged mark, the review of the head that landed, a verdict on every",
    "criterion, the verification, and the migration classification where a plan declares schema",
    "coupling, which no tier drops.",
    ...routesOff(tier, ref),
  ].join("\n");
};

