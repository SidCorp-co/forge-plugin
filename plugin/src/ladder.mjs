/* Which rung of the ladder an issue is at and what it stops owing; the report about it is
   ladder-report.mjs. Out of `flow/` because three trees read it and a primitive each could declare
   drifts on one side (docs/cli/the-primitives.md). Smallest first, so an index is a height. What each rung is for and what it may not buy: `forge guide contract`; why a doubtful reading resolves upward, here and in every function below: docs/cli/the-ladder.md. */
import { looksTo, planFlags } from "./flow/machine.mjs";

export const RUNGS = ["trivial", "fix", "feature"];
const [TRIVIAL, FIX] = RUNGS;
export { FIX };
export const FEATURE = RUNGS.at(-1);

const RETIRED_MARK = "size";

export const MARK_LINE = new RegExp(String.raw`^[ \t]*${RETIRED_MARK}:[ \t]*(?:${RUNGS.join("|")})\.?[ \t]*$`, "gimu");

/* `highest` is the heaviest of a list, the rule wherever two issues each claim a rung; the empty list is the caller's answer to give, since *no rung* is a word of its own to a run. */
export const highest = (rungs) => RUNGS[Math.max(...rungs.map(heightOf))];

export const heightOf = (rung) => Math.max(0, RUNGS.indexOf(rung));

/* The tracker's five complexities, smallest first, against the rung each claims: the one source of a rung. Keys and never a shown string — that field's own name costs a reader a round. `COMPLEXITY_NAMES` is exported for the check that keeps this table's only copy in this file, which asks about the values the table holds rather than about a second spelling of them (ISS-403). */
const COMPLEXITIES = { xs: TRIVIAL, s: FIX, m: FEATURE, l: FEATURE, xl: FEATURE };
export const COMPLEXITY_NAMES = Object.keys(COMPLEXITIES);
const SPLIT_FROM = 3;

export const rungFrom = (complexity) => COMPLEXITIES[String(complexity ?? "")] ?? null;

/* Which complexity a rung is written back as: declared, because three of the five claim `feature` and which of them a filing takes is a decision rather than the order `COMPLEXITIES` happens to spell. */
const CANONICAL = { [TRIVIAL]: "xs", [FIX]: "s", [FEATURE]: "m" };

export const complexityFor = (rung) => CANONICAL[rung] ?? null;

export const splits = (complexity) => COMPLEXITY_NAMES.indexOf(String(complexity ?? "")) >= SPLIT_FROM;

/** A rung below the top, which is the whole of what every lighter path asks: one predicate over the one source a rung has, `belowTop(rungFrom(complexity))`, and `BELOW_TOP` derived so a row's rungs are not a second spelling of it. */
export const belowTop = (rung) => Boolean(rung) && rung !== FEATURE;

const BELOW_TOP = RUNGS.filter((one) => belowTop(one));

export const FIELD_SAID = "the tracker's complexity";

/** The rung the complexity field claims: one source, so an issue holding no complexity reads as a `feature` by the upward rule rather than as the cheapest thing on the backlog. `complexity` is the field's own value, null where it claims nothing, and kept beside the rung because three of the five share a rung and the rank scores them apart. */
export const rungClaimed = ({ complexity = null } = {}) => {
  const rung = rungFrom(complexity);
  return rung ? { rung, complexity } : { rung: FEATURE, complexity: null };
};

/* Judged on the pair: where it points alone would let `feature -> fix` raise a trivial. Either spelling reads and `climbForm` writes the canonical one alone, so a correction posted before the rename still climbs. */
const CLIMB = new RegExp(String.raw`\b(?:rung|${RETIRED_MARK}):\s*(${RUNGS.join("|")})\s*(?:->|\u2192|to)\s*(${RUNGS.join("|")}|full)\b`, "giu");
const SPELT = { full: FEATURE };
const rungIn = (word) => (word ? SPELT[word.toLowerCase()] ?? word.toLowerCase() : null);

export const climbsIn = (text) => [...String(text ?? "").matchAll(CLIMB)]
  .map((found) => [rungIn(found[1]), rungIn(found[2])])
  .filter(([from, to]) => RUNGS.includes(from) && RUNGS.includes(to) && heightOf(to) > heightOf(from))
  .map(([, to]) => to);

const climbedTo = (moved) => (moved ?? []).flatMap(climbsIn);

export const climbForm = (ref, from = FIX) =>
  `forge record correction ${ref} --moved "Rung: ${from} -> ${RUNGS[Math.min(heightOf(from) + 1, RUNGS.length - 1)]}" `
  + `--why "<what the work turned out to be>"`;

/* One row per payload a rung below the top stops owing, so a status demanding several carries several. `kind` is the record kind the row drops, and it is what both readers below match on: `drops` and `because` are the report's own prose and no key. */
export const LIGHTER = [
  {
    status: "approved",
    rungs: BELOW_TOP,
    kind: "decision",
    drops: "a decision record",
    because: "the reading that mattered is the defect, and the confirmation held it",
  },
  {
    status: "approved",
    rungs: BELOW_TOP,
    kind: "plan",
    drops: "the plan field, and the declarations it would carry, which absent read `no`",
    because: "a fix's criteria are the one check that fails without it, which is the whole of its plan",
  },
  {
    status: "awaiting_release",
    rungs: BELOW_TOP,
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

export const overCeiling = (rung, { files, lines }) => {
  const held = CEILINGS[rung];
  if (!held) return null;
  const over = [
    ...(files > held.files ? [`files (${files} of ${held.files})`] : []),
    ...(lines > held.lines ? [`lines (${lines} of ${held.lines})`] : []),
  ];
  return over.length ? over : null;
};

/* One rung, not a jump to the top: a person will look at this is one reason among several. */
export const escalatedBy = (plan) => (looksTo(planFlags(plan)) ? 1 : 0);

export const rungOf = ({ plan, moved, whole, complexity = null }) => {
  if (whole === false) return FEATURE;
  const claimed = rungClaimed({ complexity }).rung;
  const climbed = Math.min(heightOf(claimed) + escalatedBy(plan), RUNGS.length - 1);
  return RUNGS[Math.max(climbed, ...climbedTo(moved).map(heightOf))];
};

/** Every row a rung grants at a status, in the table's own order. A status carries a row per payload it may drop, so this answers with a list and the two readers below take what each needs from it: taking the first would say one waiver where two are granted (ISS-1066). The rows are a parameter because the live table waives every kind of a status at the same rungs, and a case driving only that table could not tell keying on the kind from keying on the status. */
export const lighterRows = (status, fields, rows = LIGHTER) => {
  const rung = rungOf(fields);
  return rows.filter((one) => one.status === status && one.rungs.includes(rung));
};

export const lightens = (status, kind, fields, rows = LIGHTER) =>
  lighterRows(status, fields, rows).some((one) => one.kind === kind);
