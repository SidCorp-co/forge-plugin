/* Which of a verb's flags take one of a set of values this CLI declares, and the sentence a value
   outside one is refused with. The parser holds each flag's name and value together, so it judges
   the value where it judges the name and no verb writes a judge per flag: a verb that forgot one
   sent the value and composed its reply from whatever came back (ISS-936, ISS-1135). */
import { COMPLEXITY_NAMES } from "../../ladder.mjs";
import { nearestOutside } from "../../suggest.mjs";
import { KIND_NAMES, valueOutsideSet } from "../issue-shape.mjs";
import { DECLARES, declaredFor } from "../routes.mjs";
import { rowFor } from "../../resolve/visibility.mjs";

/* Keyed by the tool: `--kind` is a knowledge entry's kind on one verb and no set at all on another. */
const OWN_SETS = {
  "forge_issues.category": { held: "plugin/src/tracker/issue-shape.mjs KIND_NAMES", values: KIND_NAMES },
  "forge_issues.complexity": { held: "plugin/src/ladder.mjs COMPLEXITY_NAMES", values: COMPLEXITY_NAMES },
};

/* A flag spelt otherwise than the field whose set it takes. */
const ALIAS = { statusNot: "status" };

/* What a caller outside a set is pointed at where the set is too long to print whole: seventeen names are a list rather than a sentence, so the route out is where they are counted. */
const HINTS = {
  "forge_issues.status": "`forge doctor` counts the statuses this project's issues carry.",
};

/* A field whose refusal already has a sentence of its own, which the filing route and a `--set`
   print: one spelling of it, held where the issue's fields are. */
const OWN_SENTENCE = {
  forge_issues: (field) => (given) => valueOutsideSet(field, given)?.said ?? null,
};

/* The route's own list of filters names flags, not a field of the record. */
const NOT_A_FIELD_OF_THE_RECORD = ["filters"];

/** Every field of a tool's record this CLI declares a set for, `declared` standing in for the route
 *  table where a case needs a field no route has yet. */
export const fieldSets = (tool, declared = DECLARES) => [
  ...Object.entries(declared[tool] ?? {})
    .filter(([name, held]) => Array.isArray(held) && !NOT_A_FIELD_OF_THE_RECORD.includes(name))
    .map(([field]) => ({ field, values: declaredFor(tool, field, declared) })),
  ...Object.entries(OWN_SETS)
    .filter(([key]) => key.startsWith(`${tool}.`))
    .map(([key, set]) => ({ field: key.slice(tool.length + 1), values: set.values })),
];

const setOf = (tool, { field, values }) => ({
  field, values,
  held: OWN_SETS[`${tool}.${field}`]?.held ?? `plugin/src/tracker/routes.mjs DECLARES.${tool}.${field}`,
  hint: HINTS[`${tool}.${field}`],
  said: OWN_SENTENCE[tool]?.(field),
});

/** A tool's sets keyed by the flag that carries each: the field's own name, and every alias of it. */
export const setsOf = (tool) => {
  const held = Object.fromEntries(fieldSets(tool).map((one) => [`--${one.field}`, setOf(tool, one)]));
  for (const [flag, field] of Object.entries(ALIAS)) {
    if (held[`--${field}`]) held[`--${flag}`] = held[`--${field}`];
  }
  return held;
};

/** Off the tool the verb's own row names, the verb being the first word of what the parser is told:
 *  `knowledge write` is the knowledge verb's. A verb with no row, or a row naming no tool, has none. */
export const setsFor = (verb) => {
  const tool = rowFor(String(verb ?? "").split(" ")[0])?.[3];
  return tool ? setsOf(tool) : {};
};

/** What the parser fails with, if anything, for one flag and the caller's own word after it. */
export const valueRefusal = (verb, flag, given, sets) => {
  const set = sets[flag];
  if (!set) return null;
  const near = nearestOutside(set.field, given, set.values, set.hint);
  if (!near) return null;
  return `${verb} ${flag}: ${set.said?.(given) ?? near}\nNothing was sent: the set is this CLI's own, `
    + `at ${set.held}, so a name outside it is answered here rather than by whatever came back.`;
};
