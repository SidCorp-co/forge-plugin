/* What the current report is configured by, and where: the score and the two windows are the
   device's, since the report is one page over every project on it; which acts rewrite it is the
   project's, since a session start and a release are that project's own — docs/cli/stats.md. */
import { configPath, readJson } from "../../resolve/config.mjs";

/** The device key the report's score and windows are read from, beside `reports`. */
export const REPORT_KEY = "report";

/** The project key naming the acts that rewrite the current report, and the acts it may name. */
export const TRIGGERS_KEY = "reportOn";
export const SESSION = "session";
export const RELEASE = "release";
export const TRIGGERS = [SESSION, RELEASE];

/** The two formulas a score may be made by. `product` makes the days seen a power of the cost, so a
 *  cause seen on twice the days at the same daily cost scores twice as much; `sum` adds them. */
export const FORMULAS = {
  product: { said: "days seen ^ days × (calls a day × calls + wait minutes a day × minutes)",
    of: ({ days, calls, minutes }, weights) => (days ** weights.days) * (calls * weights.calls + minutes * weights.minutes) },
  sum: { said: "days seen × days + calls a day × calls + wait minutes a day × minutes",
    of: ({ days, calls, minutes }, weights) => days * weights.days + calls * weights.calls + minutes * weights.minutes },
};

export const DEFAULTS = { formula: "product", days: 1, calls: 1, minutes: 1, followDays: 7, earlyDays: 3 };

const WEIGHTS = ["days", "calls", "minutes"];
const WINDOWS = ["followDays", "earlyDays"];

const isTable = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

const aCount = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;

const wrong = (key, takes, given) => `stats report: \`${REPORT_KEY}.${key}\` in ${configPath()} is ${takes}, not `
  + `\`${JSON.stringify(given)}\`. Set it to one, or remove it to take ${JSON.stringify(DEFAULTS[key.split(".").at(-1)])}. Nothing was written.`;

/** The score's formula and weights and the two windows, each member read apart and defaulted where
 *  it is omitted; or the first member that is wrong, named in full. Read at the call, so a home the
 *  caller sets reaches it. */
export const reportSettings = () => {
  const given = (readJson(configPath()) ?? {})[REPORT_KEY];
  if (given === undefined) return { ...DEFAULTS, from: "the plugin's defaults" };
  if (!isTable(given)) {
    return { refused: `stats report: \`${REPORT_KEY}\` in ${configPath()} is a table of \`score\`, \`followDays\` `
      + `and \`earlyDays\`, not \`${JSON.stringify(given)}\`. Nothing was written.` };
  }
  const score = given.score ?? {};
  if (!isTable(score)) return { refused: wrong("score", "a table of `formula`, `days`, `calls` and `minutes`", score) };
  const held = { ...DEFAULTS, from: configPath() };
  if (score.formula !== undefined) {
    if (!Object.hasOwn(FORMULAS, score.formula)) {
      return { refused: wrong("score.formula", `one of ${Object.keys(FORMULAS).join(", ")}`, score.formula) };
    }
    held.formula = score.formula;
  }
  for (const key of WEIGHTS) {
    if (score[key] === undefined) continue;
    if (!aCount(score[key])) return { refused: wrong(`score.${key}`, "a number at or above zero", score[key]) };
    held[key] = score[key];
  }
  for (const key of WINDOWS) {
    if (given[key] === undefined) continue;
    if (!aCount(given[key])) return { refused: wrong(key, "a number at or above zero", given[key]) };
    held[key] = given[key];
  }
  return held;
};

/** The acts a project's record names, where its report is on: both where the key is unset. */
export const triggersOf = (record) => {
  const named = record?.[TRIGGERS_KEY];
  return Array.isArray(named) ? named.filter((one) => TRIGGERS.includes(one)) : TRIGGERS;
};

/** What the project file's writer says of a `reportOn` value, or null where it holds. */
export const triggersRefusal = (given, said) => (Array.isArray(given) && given.every((one) => TRIGGERS.includes(one))
  ? null : said(TRIGGERS_KEY, `a list naming ${TRIGGERS.join(", ")} or both`, given));
