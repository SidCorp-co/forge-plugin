/* The one table `forge next` scores against, and the one place a project overrides a weight. Every
   number here was set by the issue that asked for the verb; what each is FOR, and why the window is
   derived rather than chosen, is docs/cli/next.md's. */
import { rankConvention } from "../resolve/settings.mjs";

export const TAKEABLE = ["open", "confirmed", "clarified", "approved", "reopen"];

export const DEFAULTS = {
  priority: { critical: 40, high: 30, medium: 20, low: 10, none: 0 },
  kind: { bug: 8, enhancement: 4, feature: 0 },
  band: { xs: 8, s: 6, m: 4, l: 2, xl: 0, unset: 3 },
  agePerDay: 1,
  ageCap: 10,
  reopened: 5,
  blocks: 3,
  similarity: 0.78,
  batchCap: 3,
  windowCap: 12,
  readCap: 60,
};

const TABLES = ["priority", "kind", "band"];

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
export const foldWeights = (given) => {
  if (!given) return { value: DEFAULTS, from: "the built-in table", refusal: null };
  const refusal = wrongIn(given);
  if (refusal) return { value: DEFAULTS, from: null, refusal };
  const value = { ...DEFAULTS, ...Object.fromEntries(NUMBERS.map((key) => [key, given[key] ?? DEFAULTS[key]])) };
  for (const key of TABLES) value[key] = { ...DEFAULTS[key], ...(given[key] ?? {}) };
  return { value, from: ".forge.json", refusal: null };
};

export const weightsFrom = () => foldWeights(rankConvention().value);

/** How far a body can still move a row: the band is the only weight a body decides, so its spread is
 *  the whole of it, and a window this wide orders as the whole list would. */
export const bandSpread = (weights) => {
  const points = Object.values(weights.band);
  return Math.max(...points) - Math.min(...points);
};

const row = (label, said) => `  ${label.padEnd(16)}${said}`;

const table = (held) => Object.entries(held).map(([name, points]) => `${name} ${points}`).join(", ");

/** The table as `forge next -h` prints it, off the same constant the score reads. */
export const weightLines = (weights) => [
  "The weight table, which a `rank` object in this checkout's .forge.json overrides one weight at a",
  "time. A weight it names that is not below is refused rather than dropped.",
  "",
  row("priority", table(weights.priority)),
  row("kind", `${table(weights.kind)} — a defect in the tool the flow runs on is paid by every later run`),
  row("band", `${table(weights.band)} — smaller first, a light path paying back sooner`),
  row("agePerDay", `${weights.agePerDay} per day since it was filed, so nothing starves`),
  row("ageCap", `${weights.ageCap} — the most age alone can be worth`),
  row("reopened", `${weights.reopened}`),
  row("blocks", `${weights.blocks} per open issue this one blocks, counted through the chain`),
  row("similarity", `${weights.similarity} — the floor a search hit is read back as related at`),
  row("batchCap", `${weights.batchCap} members, and every one of them fix-size`),
  row("windowCap", `${weights.windowCap} — candidates whose body is read in one pass`),
  row("readCap", `${weights.readCap} — the most bodies read in all, whatever the passes ask for`),
  "",
  "Ties break on the filing date, oldest first.",
];
