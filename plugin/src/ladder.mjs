/* Which rung of the ladder an issue is at and what it stops owing; the report about it is
   ladder-report.mjs. Out of `flow/` because three trees read it and a primitive each could declare
   drifts on one side (docs/cli/the-primitives.md). Smallest first, so an index is a height. What
   each rung is for and what it may not buy: `forge guide contract`. Why a doubtful reading resolves
   upward, here and in every function below: docs/cli/the-ladder.md. */
import { looksTo, planFlags } from "./flow/machine.mjs";

export const TIERS = ["trivial", "fix", "feature"];
const [TRIVIAL, FIX] = TIERS;
export const FEATURE = TIERS.at(-1);

const markLine = (tier) => new RegExp(String.raw`^size:[ \t]*${tier}\.?[ \t]*$`, "imu");

/* A mark inside an example is not a mark, and not a doubt either: docs/cli/the-ladder.md. */
const EXAMPLE = new RegExp([
  String.raw`^[ \t]*(?<wall>\x60{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^[ \t]*\k<wall>[^\n]*$|$)`,
  String.raw`^(?: {4}|\t)[^\n]*$`,
].join("|"), "gmu");
const prose = (text) => String(text ?? "").replaceAll(EXAMPLE, "");

/* Null, not the top rung: a body carrying `Size: feature.` is not one carrying no mark. */
export const markedIn = (description) => {
  const found = TIERS.filter((tier) => markLine(tier).test(prose(description)));
  return found.length ? found.at(-1) : null;
};

export const tierIn = (description) => markedIn(description) ?? FEATURE;

export const heightOf = (tier) => Math.max(0, TIERS.indexOf(tier));

/* Judged on the pair: where it points alone would let `feature -> fix` raise a trivial. */
const RESIZE = new RegExp(String.raw`\bsize:\s*(${TIERS.join("|")})\s*(?:->|\u2192|to)\s*(${TIERS.join("|")}|full)\b`, "giu");
const SPELT = { full: FEATURE };
const rungIn = (word) => (word ? SPELT[word.toLowerCase()] ?? word.toLowerCase() : null);

export const climbsIn = (text) => [...String(text ?? "").matchAll(RESIZE)]
  .map((found) => [rungIn(found[1]), rungIn(found[2])])
  .filter(([from, to]) => TIERS.includes(from) && TIERS.includes(to) && heightOf(to) > heightOf(from))
  .map(([, to]) => to);

const resizedTo = (moved) => (moved ?? []).flatMap(climbsIn);

export const resizeForm = (ref, from = FIX) =>
  `forge record correction ${ref} --moved "Size: ${from} -> ${TIERS[Math.min(heightOf(from) + 1, TIERS.length - 1)]}" `
  + `--why "<what the work turned out to be>"`;

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

export const SPARES = {
  [TRIVIAL]: [
    "Phase 0 is the brief alone, where no source of it is stale",
    "one consult, which is the whole-set read at the replayed head, and no recheck after a clean pass",
    "no gate run after the ship, the ship having spent it",
  ],
  [FIX]: ["no recheck after a consult that raised nothing"],
  [FEATURE]: [],
};

/* The arithmetic catching a claim the work outgrew, spent after the judging and refusing nothing. */
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

/* One rung, not a jump to the top: a person will look at this is one reason among several. */
export const escalatedBy = (plan) => (looksTo(planFlags(plan)) ? 1 : 0);

export const tierOf = ({ description, plan, moved, whole }) => {
  if (whole === false) return FEATURE;
  const climbed = Math.min(heightOf(tierIn(description)) + escalatedBy(plan), TIERS.length - 1);
  return TIERS[Math.max(climbed, ...resizedTo(moved).map(heightOf))];
};

/** A row lightens a status: taking one out restores the demand, not just the report. */
export const lightens = (status, size) => {
  const tier = tierOf(size);
  return LIGHTER.some((one) => one.status === status && one.tiers.includes(tier));
};
