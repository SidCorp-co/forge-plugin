/* Which rung of the ladder an issue is at and what it stops owing; the report about it is
   ladder-report.mjs. Out of `flow/` because three trees read it and a primitive each could declare
   drifts on one side (docs/cli/the-primitives.md). Smallest first, so an index is a height. What
   each rung is for and what it may not buy: `forge guide contract`. Why a doubtful reading resolves
   upward, here and in every function below: docs/cli/the-ladder.md. */
import { looksTo, planFlags } from "./flow/machine.mjs";

export const TIERS = ["trivial", "fix", "feature"];
export const [TRIVIAL, FIX] = TIERS;
export const FEATURE = TIERS.at(-1);

const markLine = (tier) => new RegExp(String.raw`^size:[ \t]*${tier}\.?[ \t]*$`, "imu");

export const MARK_LINE = new RegExp(String.raw`^[ \t]*size:[ \t]*(?:${TIERS.join("|")})\.?[ \t]*$`, "gimu");

/* A mark inside an example is not a mark, and not a doubt either: docs/cli/the-ladder.md. */
const EXAMPLE = new RegExp([
  String.raw`^[ \t]*(?<wall>(?<bar>\x60|~)\k<bar>{2,})[^\n]*\n[\s\S]*?(?:^[ \t]*\k<wall>\k<bar>*[ \t]*$|$(?![\s\S]))`,
  String.raw`^(?: {4}|\t)[^\n]*$`,
].join("|"), "gmu");
const prose = (text) => String(text ?? "").replaceAll(EXAMPLE, "");

/* Null, not the top rung: a body carrying `Size: feature.` is not one carrying no mark. */
export const markedIn = (description) => {
  const found = TIERS.filter((tier) => markLine(tier).test(prose(description)));
  return found.length ? found.at(-1) : null;
};

export const tierIn = (description) => markedIn(description) ?? FEATURE;

export const lightMark = (description) => {
  const claimed = markedIn(description);
  return claimed && claimed !== FEATURE ? claimed : null;
};

export const markFor = (tier) => `Size: ${tier}.`;

export const heightOf = (tier) => Math.max(0, TIERS.indexOf(tier));

/* The tracker's five sizes, smallest first, against the rung each claims: the second source of a
   size. Keys and never a shown string — that field's own name costs a reader a round. */
const BANDS = { xs: TRIVIAL, s: FIX, m: FEATURE, l: FEATURE, xl: FEATURE };
const BAND_NAMES = Object.keys(BANDS);
const SPLIT_FROM = 3;

export const rungFrom = (band) => BANDS[String(band ?? "")] ?? null;

export const bandFor = (tier) => BAND_NAMES.find((one) => BANDS[one] === tier) ?? null;

export const splits = (band) => BAND_NAMES.indexOf(String(band ?? "")) >= SPLIT_FROM;

export const lightBand = (band) => {
  const rung = rungFrom(band);
  return Boolean(rung) && rung !== FEATURE;
};

export const FIELD_SAID = "the tracker's size";
export const LINE_SAID = "the size mark in the body";

/** The rung two sources claim, and which claimed it: both read upward and the higher wins, so
 *  neither can lower a rung the other claimed. docs/cli/the-ladder.md. */
export const sizeFrom = ({ band = null, description = null } = {}) => {
  const claimed = [
    { rung: rungFrom(band), from: FIELD_SAID },
    { rung: markedIn(description), from: LINE_SAID },
  ].filter((one) => one.rung);
  if (!claimed.length) return { rung: FEATURE, claimed, decided: [], outranked: [] };
  const top = Math.max(...claimed.map((one) => heightOf(one.rung)));
  return {
    rung: TIERS[top],
    claimed,
    decided: claimed.filter((one) => heightOf(one.rung) === top),
    outranked: claimed.filter((one) => heightOf(one.rung) < top),
  };
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

export const tierOf = ({ description, plan, moved, whole, band = null }) => {
  if (whole === false) return FEATURE;
  const claimed = sizeFrom({ band, description }).rung;
  const climbed = Math.min(heightOf(claimed) + escalatedBy(plan), TIERS.length - 1);
  return TIERS[Math.max(climbed, ...resizedTo(moved).map(heightOf))];
};

/** A row lightens a status: taking one out restores the demand, not just the report. */
export const lightens = (status, size) => {
  const tier = tierOf(size);
  return LIGHTER.some((one) => one.status === status && one.tiers.includes(tier));
};
