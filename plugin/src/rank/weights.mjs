/* The one table `forge next` scores against, and the one place a project overrides a weight. Every
   number here was set by the issue that asked for the verb; what each is FOR is
   docs/cli/next-weights.md's, and why the reading stops where it does is docs/cli/next.md's. */
import { FROM_PROJECT, rankConvention } from "../resolve/settings.mjs";
import { KIND_NAMES } from "../tracker/issue-shape.mjs";

export const TAKEABLE = ["open", "confirmed", "approved", "reopen"];

export const UNSET = "unset";

/* Keyed off the tracker's kind vocabulary rather than off this object, so a kind this CLI can file
   and nobody weighed refuses in either direction rather than scoring by `points`'s fallback. */
const KIND_POINTS = { bug: 8, enhancement: 4, review: 2, feature: 0 };

export const kindWeights = (names = KIND_NAMES, points = KIND_POINTS) => {
  const unweighed = names.filter((name) => !Object.hasOwn(points, name));
  const unscored = Object.keys(points).filter((name) => !names.includes(name));
  if (unweighed.length || unscored.length) {
    throw new Error([
      "The rank's kind weights and the kinds this CLI can file are one list, and they disagree.",
      unweighed.length ? `Weighed by nothing: ${unweighed.join(", ")}.` : "",
      unscored.length ? `Weighing no kind this CLI files: ${unscored.join(", ")}.` : "",
      "Set or drop that row in `KIND_POINTS` in plugin/src/rank/weights.mjs;"
        + " the kinds are `KINDS` in plugin/src/tracker/issue-shape.mjs.",
    ].filter(Boolean).join(" "));
  }
  const ranked = [...names].sort((one, other) => points[other] - points[one]);
  return Object.fromEntries(ranked.map((name) => [name, points[name]]));
};

export const DEFAULTS = {
  priority: { critical: 40, high: 30, medium: 20, low: 10, none: 0 },
  kind: kindWeights(),
  complexity: { xs: 8, s: 6, m: 4, l: 2, xl: 1, [UNSET]: 0 },
  agePerDay: 1,
  ageCap: null,
  reopened: 5,
  blocks: 3,
  similarity: 0.78,
  batchCap: 3,
  windowCap: 12,
  readCap: 60,
};

const TABLES = ["priority", "kind", "complexity"];

const UNCAPPED = "ageCap";

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

/** Every weight a project may name, as the tail of its own `rank` key, in the two shapes this fold
 *  accepts and no third: a scalar by its own name, and a table's row under its table. A reading that
 *  offers one of these offers a key this fold takes rather than a word it would refuse. */
export const RANK_WEIGHTS = Object.keys(DEFAULTS).filter((key) => !TABLES.includes(key));
export const RANK_ROWS = TABLES
  .flatMap((key) => Object.keys(DEFAULTS[key]).map((name) => `${key}.${name}`));

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
    if (numeric(value) || (key === UNCAPPED && value === null)) continue;
    return key === UNCAPPED
      ? `\`rank.${UNCAPPED}\` is a number of points or \`null\` for no ceiling, not \`${JSON.stringify(value)}\`.`
      : `\`rank.${key}\` is a number, not \`${JSON.stringify(value)}\`.`;
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
  const value = { ...DEFAULTS, ...Object.fromEntries(RANK_WEIGHTS.map((key) => [key, given[key] ?? DEFAULTS[key]])) };
  for (const key of TABLES) value[key] = { ...DEFAULTS[key], ...(given[key] ?? {}) };
  return { value, from: FROM_PROJECT, refusal: null, said };
};

export const weightsFrom = () => foldWeights(rankConvention().value);

/** The ceiling in force and which of the two decided it: the fold's own `from` answers for the whole
 *  object, so reading that would tell a project its file decided the weights it left alone. */
export const ageCeiling = () => {
  const asked = rankConvention().value;
  const { value, from, refusal } = foldWeights(asked);
  const own = Boolean(asked) && Object.hasOwn(asked, UNCAPPED);
  return { value: value[UNCAPPED], from: own ? from : "the plugin's default", refusal };
};

/** How far a body can still move a row: the complexity is the only weight a body decides, so its
    spread is the whole of it, and a window this wide orders as the whole list would. */
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
  row("ageCap", weights.ageCap === null
    ? "none — age never stops, so anything left sitting rises until somebody works it or drops it"
    : `${weights.ageCap} — the most age alone can be worth, past which two filing dates score alike`),
  row("reopened", `${weights.reopened}`),
  row("blocks", `${weights.blocks} per open issue this one blocks, counted through the chain`),
  row("similarity", `${weights.similarity} — the floor a search hit is read back as related at`),
  row("batchCap", `${weights.batchCap} members, and every one of them at the fix rung or below`),
  row("windowCap", `${weights.windowCap} — candidates whose body is read in one pass`),
  row("readCap", `${weights.readCap} — the most bodies read in all, whatever the passes ask for`),
  "",
  "Ties break on the filing date, oldest first.",
];
