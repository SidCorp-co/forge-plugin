/* What the judge's answer is kept as. A decision stands only where one command of this CLI carries it
   out, and code composes that command from the fields the judge named, so what the page prints is a
   command that runs rather than a string a model wrote; a section's better or worse stands only beside
   the baseline it moved against. An answer failing a check comes back as the reason it was dropped,
   for the caller to count: docs/cli/stats-the-reading.md. */
import { ACTIONS, CATEGORIES, ISSUE_KEY, MOVED, PRIORITIES, TEXT_CHARS, VERDICTS } from "./roles.mjs";

const SETTLED = new Set(["closed", "dropped"]);
const ONE_KEY = /^ISS-\d+$/u;

export const trimmed = (value) => String(value ?? "").trim();

/** A value a POSIX shell passes as exactly one argument, whatever quotes it holds. */
export const quoted = (value) => `'${String(value).replaceAll("'", "'\\''")}'`;

const raiseCommand = (key, priority, figure) =>
  `forge issue ${key} --set priority=${priority} --why ${quoted(`${figure.said}: ${figure.value}`)}`;

const fileCommand = (title, category) => `forge new - --title ${quoted(title)} --category ${category}`;

const commentCommand = (key, title, cause) => `printf '%s\\n' ${quoted(`${title}: ${cause}`)} | forge comment ${key} -`;

const keysIn = (value) => String(value ?? "").match(ISSUE_KEY) ?? [];

const dropped = (reason) => ({ dropped: reason });

const overlong = (...values) => values.some((value) => !value || value.length > TEXT_CHARS);

const raiseOf = (one, base, held) => {
  const key = trimmed(one.issue).toUpperCase();
  if (!ONE_KEY.test(key) || !held.keys.has(key)) return dropped("raised an issue key the page does not name");
  const known = held.issues.get(key);
  if (!known?.status || !PRIORITIES.includes(known.priority)) return dropped("raised an issue whose status and priority the backlog did not give");
  if (SETTLED.has(known.status)) return dropped("raised an issue that is closed or dropped");
  if (!PRIORITIES.includes(one.priority)) return dropped("raised to a priority the tracker does not take");
  if (PRIORITIES.indexOf(one.priority) <= PRIORITIES.indexOf(known.priority)) return dropped("raised to a priority no higher than the issue's own");
  return { kept: { ...base, issue: key, from: known.priority, to: one.priority, command: raiseCommand(key, one.priority, base.figure) } };
};

const fileOf = (one, base) => {
  const title = trimmed(one.title);
  const cause = trimmed(one.cause);
  if (overlong(title, cause)) return dropped(`filed with no title or cause, or one over ${TEXT_CHARS} characters`);
  if (!CATEGORIES.includes(one.category)) return dropped(`filed under no category of ${CATEGORIES.join(" or ")}`);
  return { kept: { ...base, title, cause, category: one.category, command: fileCommand(title, one.category) } };
};

/** A decision as `{ kept }`, or `{ dropped }` with why. `held` is the page's figures by key, the keys
 *  it offers, and each offered key's status and priority as the backlog gave them. */
export const decisionOf = (one, held) => {
  const action = ACTIONS.includes(one?.action) ? one.action : null;
  if (!action) return dropped("named no action a command of this CLI carries out");
  const figure = held.figures.get(trimmed(one.figure));
  if (!figure) return dropped("cited a figure the page does not hold");
  const what = trimmed(one.what);
  if (overlong(what)) return dropped(`said nothing, or more than ${TEXT_CHARS} characters`);
  if ([what, one.title, one.cause].flatMap(keysIn).some((key) => !held.keys.has(key))) return dropped("named an issue key the page does not name");
  const base = { action, what, figure };
  return action === "raise" ? raiseOf(one, base, held) : fileOf(one, base);
};

/** A filing an open issue already covers, as a comment on that issue; one the backlog could not be
 *  asked about, kept and saying so; otherwise the filing as it stands. */
export const routedFiling = (decision, { match = null, unchecked = null }) => {
  if (match) return { ...decision, action: "comment", issue: match.key, command: commentCommand(match.key, decision.title, decision.cause) };
  return unchecked ? { ...decision, unchecked } : decision;
};

/** A section's line as `{ line }`, or `{ dropped, verdict }`: better or worse owes a baseline figure
 *  of that same section, the window the day moved against. */
export const sectionLineOf = (one, figures) => {
  const why = trimmed(one?.why);
  if (!VERDICTS.includes(one?.verdict) || overlong(why)) return dropped("gave a section line with no verdict, or one over the length");
  if (!MOVED.includes(one.verdict)) return { line: { verdict: one.verdict, why } };
  const baseline = figures.get(trimmed(one.baseline));
  if (!baseline?.baseline) return { ...dropped("gave better or worse citing no baseline figure of its section"), verdict: one.verdict };
  return { line: { verdict: one.verdict, why, baseline } };
};
