/* Which rung of the ladder an issue is at and what it stops owing; the report about it is
   ladder-report.mjs. Out of `flow/` because three trees read it and a primitive each could declare
   drifts on one side (docs/cli/the-primitives.md). Smallest first, so an index is a height. What each rung is for and what it may not buy: `forge guide contract`; why a doubtful reading resolves upward, here and in every function below: docs/cli/the-ladder.md. */
import { looksTo, planFlags } from "./flow/machine.mjs";

export const TIERS = ["trivial", "fix", "feature"];
const [TRIVIAL, FIX] = TIERS;
export { FIX };
export const FEATURE = TIERS.at(-1);

export const MARK_LINE = new RegExp(String.raw`^[ \t]*size:[ \t]*(?:${TIERS.join("|")})\.?[ \t]*$`, "gimu");

/* `highest` is the heaviest of a list, the rule wherever two issues each claim a rung; the empty list is the caller's answer to give, since *no rung* is a word of its own to a run. */
export const highest = (rungs) => TIERS[Math.max(...rungs.map(heightOf))];

export const heightOf = (tier) => Math.max(0, TIERS.indexOf(tier));

/* The tracker's five complexities, smallest first, against the rung each claims: the one source of a rung. Keys and never a shown string — that field's own name costs a reader a round. `BAND_NAMES` is exported for the check that keeps this table's only copy in this file, which asks about the values the table holds rather than about a second spelling of them (ISS-403). */
const BANDS = { xs: TRIVIAL, s: FIX, m: FEATURE, l: FEATURE, xl: FEATURE };
export const BAND_NAMES = Object.keys(BANDS);
const SPLIT_FROM = 3;

export const rungFrom = (band) => BANDS[String(band ?? "")] ?? null;

/* Which band a rung is written back as: declared, because three of the five claim `feature` and which of them a filing takes is a decision rather than the order `BANDS` happens to spell. */
const CANONICAL = { [TRIVIAL]: "xs", [FIX]: "s", [FEATURE]: "m" };

export const bandFor = (tier) => CANONICAL[tier] ?? null;

export const splits = (band) => BAND_NAMES.indexOf(String(band ?? "")) >= SPLIT_FROM;

/** A rung below the top, which is the whole of what every lighter path asks: one predicate over the one source a rung has, `belowTop(rungFrom(band))`, and `BELOW_TOP` derived so a row's rungs are not a second spelling of it. */
export const belowTop = (rung) => Boolean(rung) && rung !== FEATURE;

const BELOW_TOP = TIERS.filter((one) => belowTop(one));

export const FIELD_SAID = "the tracker's complexity";

/** The rung the complexity field claims: one source, so a body carrying `Size: fix.` and no field reads as a `feature` by the upward rule rather than as a fix. `band` is the field's own value, null where it claims nothing, and kept beside the rung because three of the five share a rung and the rank scores them apart. */
export const sizeFrom = ({ band = null } = {}) => {
  const rung = rungFrom(band);
  return rung ? { rung, band } : { rung: FEATURE, band: null };
};

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

/* One row per status a rung below the top stops owing something at. `kind` is the record kind the row drops, so a reader deciding what a status is still earned by matches the row to a payload by that key rather than by reading `drops`, which with `because` is the report's own prose for it. */
export const LIGHTER = [
  {
    status: "clarified",
    tiers: BELOW_TOP,
    kind: "decision",
    drops: "a decision record",
    because: "the reading that mattered is the defect, and the confirmation held it",
  },
  {
    status: "approved",
    tiers: BELOW_TOP,
    kind: "plan",
    drops: "the plan field, and the declarations it would carry, which absent read `no`",
    because: "a fix's criteria are the one check that fails without it, which is the whole of its plan",
  },
  {
    status: "released",
    tiers: BELOW_TOP,
    kind: "note",
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

export const tierOf = ({ plan, moved, whole, band = null }) => {
  if (whole === false) return FEATURE;
  const claimed = sizeFrom({ band }).rung;
  const climbed = Math.min(heightOf(claimed) + escalatedBy(plan), TIERS.length - 1);
  return TIERS[Math.max(climbed, ...resizedTo(moved).map(heightOf))];
};

/** A row lightens a status: taking one out restores the demand, not just the report. */
export const lightens = (status, size) => {
  const tier = tierOf(size);
  return LIGHTER.some((one) => one.status === status && one.tiers.includes(tier));
};
