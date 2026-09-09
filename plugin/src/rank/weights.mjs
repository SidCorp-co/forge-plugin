/* The one table `forge next` scores against, and the one place a project overrides a weight. Every
   number here was set by the issue that asked for the verb; what each is FOR, and why the reading
   stops where it does, is docs/cli/next.md's. */
import { FROM_PROJECT, rankConvention } from "../resolve/settings.mjs";

export const TAKEABLE = ["open", "confirmed", "clarified", "approved", "reopen"];

export const UNSET = "unset";

export const DEFAULTS = {
  priority: { critical: 40, high: 30, medium: 20, low: 10, none: 0 },
  kind: { bug: 8, enhancement: 4, feature: 0 },
  complexity: { xs: 8, s: 6, m: 4, l: 2, xl: 0, [UNSET]: 3 },
  agePerDay: 1,
  ageCap: 10,
  reopened: 5,
  blocks: 3,
  similarity: 0.78,
  batchCap: 3,
  windowCap: 12,
  readCap: 60,
};

const TABLES = ["priority", "kind", "complexity"];

const RETIRED_TABLE = "band";
const OWN_TABLE = "complexity";

/** A project's `rank` object with the retired spelling of the one table keyed by the tracker's field
 *  folded onto the canonical key, and the line saying which was read: a project that set the old key
 *  scores as it always did, and a weight read from a key nobody printed is an order nobody can
 *  account for. The caller says that line ahead of any refusal, which names the canonical key
 *  whatever a project spelled it as. */
export const canonicalKeys = (given) => {
  if (!given || !Object.hasOwn(given, RETIRED_TABLE)) return { given, said: null };
  const { [RETIRED_TABLE]: retired, ...rest } = given;
  const both = Object.hasOwn(given, OWN_TABLE);
  return {
    given: both ? rest : { ...rest, [OWN_TABLE]: retired },
    said: `\`rank.${RETIRED_TABLE}\` is the retired spelling of \`rank.${OWN_TABLE}\`. `
      + (both
        ? `This project sets both, so the score is on \`rank.${OWN_TABLE}\` and the other is passed over.`
        : `It is read as \`rank.${OWN_TABLE}\`, so the score is unchanged; rename it where it is set.`),
  };
};

const NUMBERS = Object.keys(DEFAULTS).filter((key) => !TABLES.includes(key));

const numeric = (value) => typeof value === "number" && Number.isFinite(value);

const wrongIn = (given) => {
  for (const [key, value] of Object.entries(given)) {
    if (!Object.hasOwn(DEFAULTS, key)) {
      return `\`rank.${key}\` is no weight of this table. It holds: ${Object.keys(DEFAULTS).join(", ")}.`;
    }
    if (TABLES.includes(key)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return `\`rank.${key}\` is a table of ${Object.keys(DEFAULTS[key]).join(", ")}, not a single value.`;
      }
      for (const [name, held] of Object.entries(value)) {
        if (!Object.hasOwn(DEFAULTS[key], name)) {
          return `\`rank.${key}.${name}\` names no row of that table. It holds: ${Object.keys(DEFAULTS[key]).join(", ")}.`;
        }
        if (!numeric(held)) return `\`rank.${key}.${name}\` is a number of points, not \`${JSON.stringify(held)}\`.`;
      }
      continue;
    }
    if (!numeric(value)) return `\`rank.${key}\` is a number, not \`${JSON.stringify(value)}\`.`;
  }
  return null;
};

/** The defaults with a project's `rank` object folded over them, and the refusal where it names
 *  something this table does not: a weight dropped in silence is an order nobody can account for. */
export const foldWeights = (asked) => {
  const { given, said } = canonicalKeys(asked);
  if (!given) return { value: DEFAULTS, from: "the built-in table", refusal: null, said };
  const refusal = wrongIn(given);
  if (refusal) return { value: DEFAULTS, from: null, refusal, said };
  const value = { ...DEFAULTS, ...Object.fromEntries(NUMBERS.map((key) => [key, given[key] ?? DEFAULTS[key]])) };
  for (const key of TABLES) value[key] = { ...DEFAULTS[key], ...(given[key] ?? {}) };
  return { value, from: FROM_PROJECT, refusal: null, said };
};

export const weightsFrom = () => foldWeights(rankConvention().value);

/** How far a body can still move a row: the complexity is the only weight a body decides, so its
 *  spread is the whole of it, and a window this wide orders as the whole list would. */
export const complexitySpread = (weights) => {
  const points = Object.values(weights.complexity);
  return Math.max(...points) - Math.min(...points);
};

const row = (label, said) => `  ${label.padEnd(16)}${said}`;

const table = (held) => Object.entries(held).map(([name, points]) => `${name} ${points}`).join(", ");

/** The table as `forge next -h` prints it, off the same constant the score reads. */
export const weightLines = (weights) => [
  "The weight table, which a `rank` object in this project's own settings overrides one weight at a",
  "time — `forge doctor` names the file. A weight it names that is not below is refused, not dropped.",
  "",
  row("priority", table(weights.priority)),
  row("kind", `${table(weights.kind)} — a defect in the tool the flow runs on is paid by every later run`),
  row("complexity", `${table(weights.complexity)} — smaller first, a light path paying back sooner`),
  row("agePerDay", `${weights.agePerDay} per day since it was filed, so nothing starves`),
  row("ageCap", `${weights.ageCap} — the most age alone can be worth`),
  row("reopened", `${weights.reopened}`),
  row("blocks", `${weights.blocks} per open issue this one blocks, counted through the chain`),
  row("similarity", `${weights.similarity} — the floor a search hit is read back as related at`),
  row("batchCap", `${weights.batchCap} members, and every one of them at the fix rung or below`),
  row("windowCap", `${weights.windowCap} — candidates whose body is read in one pass`),
  row("readCap", `${weights.readCap} — the most bodies read in all, whatever the passes ask for`),
  "",
  "Ties break on the filing date, oldest first.",
];
