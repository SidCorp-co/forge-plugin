/* Which rung of the ladder an issue is at, what it stops owing and what rounds it may spend fewer
   of. Out of `flow/` because three trees read it — the entry checks, the stats verb and the ship —
   and a primitive each could declare drifts on one side (docs/cli/the-primitives.md). Smallest
   first, so an index is a height; the top rung owns no mark, an unmarked body being the feature
   every issue filed before this ladder reads as. Each rung's reason: `forge guide contract`. */
import { looksTo, planFlags } from "./flow/machine.mjs";

export const TIERS = ["trivial", "fix", "feature"];
const [TRIVIAL, FIX, FEATURE] = TIERS;

/* Anchored, so `Size: fix later` is not the mark and the full stop is the author's. */
const MARKED = TIERS.filter((one) => one !== FEATURE);
const markLine = (tier) => new RegExp(String.raw`^[ \t]*size:[ \t]*${tier}\.?[ \t]*$`, "imu");

export const tierIn = (description) =>
  MARKED.find((tier) => markLine(tier).test(String(description ?? ""))) ?? FEATURE;

export const heightOf = (tier) => Math.max(0, TIERS.indexOf(tier));

/* One direction: a downward pair unearns statuses held, so only the height climbed TO is read. */
const RESIZE = new RegExp(String.raw`\bsize:\s*(${TIERS.join("|")})\s*(?:->|\u2192|to)\s*(${TIERS.join("|")}|full)\b`, "iu");
const CLIMBED_TO = { full: FEATURE };
const resizedTo = (moved) => (moved ?? [])
  .map((one) => RESIZE.exec(String(one ?? ""))?.[2]?.toLowerCase())
  .map((word) => (word ? CLIMBED_TO[word] ?? word : null))
  .filter(Boolean);

export const resizeForm = (ref, from = FIX) =>
  `forge record correction ${ref} --moved "Size: ${from} -> ${TIERS[Math.min(heightOf(from) + 1, TIERS.length - 1)]}" `
  + `--why "<what the work turned out to be>"`;

/* A tier absent from a row owes that row's payload. */
export const LIGHTER = [
  {
    status: "clarified",
    tiers: [TRIVIAL, FIX],
    drops: "a decision record",
    because: "the reading that mattered is the defect, and the confirmation held it",
  },
  {
    status: "approved",
    tiers: [TRIVIAL, FIX],
    drops: "the plan field, and the declarations it would carry, which absent read `no`",
    because: "a fix's criteria are the one check that fails without it, which is the whole of its plan",
  },
  {
    status: "released",
    tiers: [TRIVIAL, FIX],
    drops: "a release note",
    because: "no person sees the change, so the withholding is the rule and not a record to type",
  },
];

/* What a tier buys that LIGHTER cannot hold: a round is a cost the run counts, not a shape a record
   has. `forge stats runs` reads these; nothing checks them. */
export const SPARES = {
  [TRIVIAL]: [
    "Phase 0 is the brief alone, where no source of it is stale",
    "one consult, which is the whole-set read at the replayed head, and no recheck after a clean pass",
    "no gate run after the ship, the ship having spent it",
  ],
  [FIX]: ["no recheck after a consult that raised nothing"],
  [FEATURE]: [],
};

/* What a landing of each tier stays under: the tier is claimed by meaning, and this is the
   arithmetic catching a claim the work outgrew, named by which of the two it is past. Spent by the
   ship after the judging and by nothing that refuses. `feature` has none, being the top rung. */
export const CEILINGS = {
  [TRIVIAL]: { files: 5, lines: 150 },
  [FIX]: { files: 15, lines: 500 },
};

export const overCeiling = (tier, { files, lines }) => {
  const held = CEILINGS[tier];
  if (!held) return null;
  const over = [
    ...(files > held.files ? [`files (${files} of ${held.files})`] : []),
    ...(lines > held.lines ? [`lines (${lines} of ${held.lines})`] : []),
  ];
  return over.length ? over : null;
};

/* One rung, not a jump to the top: a person will look at this is one reason among several. A cut
   page never lightens — losing a re-size would shrink a shortfall others only grow. */
export const escalatedBy = (plan) => (looksTo(planFlags(plan)) ? 1 : 0);

export const tierOf = ({ description, plan, moved, whole }) => {
  if (whole === false) return FEATURE;
  const climbed = Math.min(heightOf(tierIn(description)) + escalatedBy(plan), TIERS.length - 1);
  return TIERS[Math.max(climbed, ...resizedTo(moved).map(heightOf))];
};

/** A row lightens a status, so taking one out restores the demand and not just the report. */
export const lightens = (status, size) => {
  const tier = tierOf(size);
  return LIGHTER.some((one) => one.status === status && one.tiers.includes(tier));
};

const WIDTH = 18;
/* Past the widest label. Printed at every tier: a route nobody is shown is a route inferred. */
const lighterLines = (tier) => LIGHTER.filter((one) => one.tiers.includes(tier)).map((one) =>
  `  ${`at ${one.status}`.padEnd(WIDTH)}not owed: ${one.drops}\n  ${" ".repeat(WIDTH)}  because ${one.because}`);

const spareLines = (tier) => SPARES[tier].map((one, at) =>
  `  ${(at ? "" : "and fewer rounds").padEnd(WIDTH)}${one}`);

const markSaid = (description) => {
  const claimed = tierIn(description);
  return claimed === FEATURE
    ? "This issue carries no size mark, so it is a `feature`"
    : `This issue is marked \`Size: ${claimed}.\`, so it is a \`${claimed}\``;
};

const climbSaid = ({ description, plan, moved }) => {
  const claimed = tierIn(description);
  const tier = tierOf({ description, plan, moved, whole: true });
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
  const climbed = climbSaid(size);
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

