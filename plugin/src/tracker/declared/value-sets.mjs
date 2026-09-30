/* Which of a verb's flags take one of a set of values this CLI declares, and the sentence a value
   outside one is refused with. The parser holds each flag's name and value together, so it judges
   the value where it judges the name and no verb writes a judge per flag: a verb that forgot one
   sent the value and composed its reply from whatever came back (ISS-936, ISS-1135). */
import { COMPLEXITY_NAMES, rungFrom } from "../../ladder.mjs";
import { didYouMean, nearestOutside, suggest } from "../../suggest.mjs";
import { KIND_NAMES } from "./kinds.mjs";
import { DECLARES, declaredFor } from "../routes.mjs";
import { rowFor } from "../../resolve/visibility.mjs";

/* The route past the set, borrowed by every refusal of a kind: a kind this CLI does not define is a
   section list nobody has decided, not a filing to fix by guessing. */
export const KIND_ROUTE = "a filing needing another category, or another section under one, files an issue"
  + " against this plugin rather than inventing the value";

export const kindRefusal = (given) =>
  `${didYouMean("category", given, KIND_NAMES)}\nIt names no shape to read the body against, and`
  + ` ${KIND_ROUTE}.`;

/** A complexity outside the tracker's five, refused by naming them: the field is the one source of
 *  the rung, so a value nothing maps reads later as an issue holding none. */
export const complexityRefusal = (given) =>
  `${didYouMean("complexity", given, COMPLEXITY_NAMES)} They are the tracker's own five, smallest first,`
  + ` and the rung each claims is \`forge guide contract\`'s: ${COMPLEXITY_NAMES.map((one) => `${one} a ${rungFrom(one)}`).join(", ")}.`;

/* What a filing is ranked, in one place. The kind's field is left empty and this one cannot be —
   left out, the tracker fills the middle of its own set; docs/cli/new.md holds the rest. */
export const UNRANKED = "none";

export const priorityFor = (given, allowed = []) => {
  const wanted = given ?? UNRANKED;
  const said = given === undefined ? `priority ${UNRANKED}, by default` : `priority ${given}, as given`;
  if (!allowed.length || allowed.includes(wanted)) return { value: wanted, said };
  if (given === undefined) {
    return { refusal: `This CLI files an issue nobody ranked as \`${UNRANKED}\`, and the tracker's set is`
      + ` now ${allowed.join(", ")}. Name one with --priority, and file this against the plugin: the`
      + " default is what has to change, not the filing." };
  }
  return { refusal: `${didYouMean("priority", given, allowed)} That set is what the route table `
    + "declares this tracker takes, and a value it has grown since is added there." };
};

/* What a field of an issue may hold, where a route takes field and value by hand: going round the
   entry checks is not going round a field's own set, and a field with no row is the tracker's to judge. */
const SET_VALUES = {
  category: { values: () => KIND_NAMES, said: kindRefusal },
  complexity: { values: () => COMPLEXITY_NAMES, said: complexityRefusal },
  priority: { values: () => declaredFor("forge_issues", "priority"),
    said: (given) => priorityFor(given, declaredFor("forge_issues", "priority")).refusal },
};

export const valueOutsideSet = (field, given) => {
  const row = SET_VALUES[field];
  if (!row) return null;
  const values = row.values();
  if (values.includes(given)) return null;
  const close = suggest(given, values);
  return { said: row.said(given), meant: close.length === 1 ? close[0] : null };
};

/* Keyed by the tool: `--kind` is a knowledge entry's kind on one verb and no set at all on another. */
const OWN_SETS = {
  "forge_issues.category": { held: "plugin/src/tracker/declared/kinds.mjs KIND_NAMES", values: KIND_NAMES },
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
