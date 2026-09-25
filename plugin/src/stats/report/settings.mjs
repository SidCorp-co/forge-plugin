/* What the current report is configured by, and where: the score and the two windows are the
   device's, since the report is one page over every project on it; which acts rewrite it is the
   project's, since a session start and a release are that project's own — docs/cli/stats.md. */
import { configPath, readJson } from "../../resolve/config.mjs";

/** The device key the report's score and windows are read from, beside `reports`. */
const REPORT_KEY = "report";

/** The project key naming the acts that rewrite the current report, and the acts it may name. */
export const TRIGGERS_KEY = "reportOn";
export const SESSION = "session";
export const RELEASE = "release";
const TRIGGERS = [SESSION, RELEASE];

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

const wrong = (key, takes, given) => `stats daily --current: \`${REPORT_KEY}.${key}\` in ${configPath()} is ${takes}, not `
  + `\`${JSON.stringify(given)}\`. Set it to one, or remove it to take ${JSON.stringify(DEFAULTS[key.split(".").at(-1)])}. Nothing was written.`;

/** The score's formula and weights and the two windows, each member read apart and defaulted where
 *  it is omitted; or the first member that is wrong, named in full. */
export const reportSettings = () => {
  const given = (readJson(configPath()) ?? {})[REPORT_KEY];
  if (given === undefined) return { ...DEFAULTS, from: "the plugin's defaults" };
  if (!isTable(given)) {
    return { refused: `stats daily --current: \`${REPORT_KEY}\` in ${configPath()} is a table of \`score\`, \`followDays\` `
      + `and \`earlyDays\`, not \`${JSON.stringify(given)}\`. Nothing was written.` };
  }
  const score = given.score === undefined ? {} : given.score;
  if (!isTable(score)) return { refused: wrong("score", "a table of `formula`, `days`, `calls` and `minutes`", score) };
  const stranger = Object.keys(given).find((key) => !["score", ...WINDOWS].includes(key))
    ?? Object.keys(score).map((key) => `score.${key}`).find((key) => !["score.formula", ...WEIGHTS.map((one) => `score.${one}`)].includes(key));
  if (stranger) {
    return { refused: `stats daily --current: \`${REPORT_KEY}.${stranger}\` in ${configPath()} is no member this report reads: it reads `
      + "`score.formula`, `score.days`, `score.calls`, `score.minutes`, `followDays` and `earlyDays`. Remove it. Nothing was written." };
  }
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

/** The acts a project's `reportOn` names, where its report is on: both where the key is unset, and
 *  none where it holds anything its writer would refuse, since a value nothing could have written
 *  decides nothing. */
export const triggersOf = (named) => {
  if (named === undefined) return TRIGGERS;
  return Array.isArray(named) && named.every((one) => TRIGGERS.includes(one)) ? named : [];
};

/** What the project file's writer says of a `reportOn` value, or null where it holds. */
export const triggersRefusal = (given, said) => (Array.isArray(given) && given.every((one) => TRIGGERS.includes(one))
  ? null : said(TRIGGERS_KEY, `a list naming ${TRIGGERS.join(", ")} or both`, given));
