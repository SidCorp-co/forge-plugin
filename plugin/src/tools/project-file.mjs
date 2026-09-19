/* The project's own configuration file as a thing that can be written: where one key's pair sits in
   its text, which paths take a value and how a word is spelled into one, and whose reader says what
   that value may not be. The file is committed and read by every session, so a write edits the span it
   changes and nothing else — a document re-serialized from its parse lands a diff nobody asked for in
   somebody else's review. What a key means: README.md's Configuration. */
import { compiles } from "../codex/codex.mjs";
import { reviewRefusalOf } from "../git/reviewed.mjs";
import { DECLARABLE, declares } from "../stats/corpus/classes.mjs";
import { foldWeights } from "../rank/weights.mjs";
import {
  CHECK_MS_TAKES,
  DRAINS,
  FEEDBACK_CHANNELS,
  FROM_PROJECT,
  LANDING_ROUTES,
  OWED_DOORS,
  RUNS_TAKES,
  checkMsOf,
  chosen,
  codexOwedOf,
  jobsOf,
  runsOf,
  workPatternOf,
} from "../resolve/settings.mjs";

const SPACE = /\s/u;

const pastSpace = (text, at) => {
  let held = at;
  while (held < text.length && SPACE.test(text[held])) held += 1;
  return held;
};

const endOfString = (text, at) => {
  let held = at + 1;
  while (held < text.length) {
    if (text[held] === "\\") held += 2;
    else if (text[held] === `"`) return held + 1;
    else held += 1;
  }
  return -1;
};

const endOfValue = (text, at) => {
  if (text[at] === `"`) return endOfString(text, at);
  if (!"{[".includes(text[at])) {
    let held = at;
    while (held < text.length && !`,}]\r\n\t `.includes(text[held])) held += 1;
    return held;
  }
  let depth = 0;
  let held = at;
  while (held < text.length) {
    if (text[held] === `"`) {
      held = endOfString(text, held);
      if (held < 0) return -1;
      continue;
    }
    if ("{[".includes(text[held])) depth += 1;
    else if ("}]".includes(text[held]) && --depth === 0) return held + 1;
    held += 1;
  }
  return -1;
};

/* One object's pairs, from the brace that opens it. A key of the same name inside another object is
   not this key, which is why the walk descends rather than searching. */
const pairIn = (text, open, key) => {
  let previous = null;
  let at = pastSpace(text, open + 1);
  while (text[at] === `"`) {
    const nameEnd = endOfString(text, at);
    if (nameEnd < 0) return { broken: true };
    const colon = pastSpace(text, nameEnd);
    if (text[colon] !== ":") return { broken: true };
    const valueAt = pastSpace(text, colon + 1);
    const valueEnd = endOfValue(text, valueAt);
    if (valueEnd < 0) return { broken: true };
    if (JSON.parse(text.slice(at, nameEnd)) === key) {
      return { open, name: at, at: valueAt, end: valueEnd, previous };
    }
    previous = valueEnd;
    at = pastSpace(text, valueEnd);
    if (text[at] !== ",") return text[at] === "}" ? { absent: true } : { broken: true };
    at = pastSpace(text, at + 1);
  }
  return text[at] === "}" ? { absent: true } : { broken: true };
};

/** One top-level pair, with where the pair before it ended — what a removal cuts back to, so the file
 *  is left without a hole where the key was. */
const valueSpan = (text, key) => {
  const open = pastSpace(text, 0);
  if (text[open] !== "{") return null;
  const held = pairIn(text, open, key);
  return held.absent || held.broken ? null : held;
};

/** Where the pair a path of keys names sits, or where the walk stopped short of it: `end` present is
 *  the pair itself, `left` is the segments still to be created inside the object at `open`, and null
 *  is a document this cannot walk or a path whose parent holds something other than an object. */
const pathSpan = (text, segments) => {
  let open = pastSpace(text, 0);
  if (text[open] !== "{") return null;
  for (let index = 0; index < segments.length; index += 1) {
    const held = pairIn(text, open, segments[index]);
    if (held.broken) return null;
    if (held.absent) return { open, left: segments.slice(index) };
    if (index + 1 === segments.length) return held;
    open = pastSpace(text, held.at);
    if (text[open] !== "{") return null;
  }
  return null;
};

/* Two lines in, so the key a call named is the one the diff shows moving and the document keeps the
   order its owner chose for the rest. */
const inserted = (text, open, key, value) => {
  const pair = `${JSON.stringify(key)}: ${JSON.stringify(value)}`;
  const first = pastSpace(text, open + 1);
  return text[first] === "}"
    ? `${text.slice(0, open + 1)}\n  ${pair}\n${text.slice(first)}`
    : `${text.slice(0, open + 1)}\n  ${pair},${text.slice(open + 1)}`;
};

/** The file's text with the key this path names set, every other byte as it was, or null where the
 *  document cannot be walked there. An absent path is created as far down as it is missing. */
export const withPath = (text, segments, value) => {
  const held = pathSpan(text, segments);
  if (!held) return null;
  if (held.left) {
    const nested = held.left.slice(1).reduceRight((inner, key) => ({ [key]: inner }), value);
    return inserted(text, held.open, held.left[0], nested);
  }
  return `${text.slice(0, held.at)}${JSON.stringify(value)}${text.slice(held.end)}`;
};

/** The same, for one top-level key, and inserting into a document the walk could not open rather than
 *  refusing: `forge doctor --flow` has already parsed the file and has a key to write either way. */
export const withKey = (text, key, value) => {
  const written = withPath(text, [key], value);
  return written === null ? inserted(text, text.indexOf("{"), key, value) : written;
};

const cutPair = (text, held) => {
  const after = pastSpace(text, held.end);
  if (held.previous !== null) return `${text.slice(0, held.previous)}${text.slice(held.end)}`;
  if (text[after] === ",") return `${text.slice(0, held.name)}${text.slice(pastSpace(text, after + 1))}`;
  return `${text.slice(0, held.open + 1)}${text.slice(after)}`;
};

/** The same walk the other way, and every declaration of that name rather than the first: a document
 *  declaring one key twice parses to the last of them, so removing one would report a key cleared
 *  that is still the value the resolver reads. */
export const withoutKey = (text, key) => {
  let held = text;
  for (let span = valueSpan(held, key); span; span = valueSpan(held, key)) held = cutPair(held, span);
  return held;
};

const said = (key, takes, given) =>
  `\`${key}\` in ${FROM_PROJECT} is ${takes}, not \`${JSON.stringify(given ?? null)}\`.`;

/* Stated here and not borrowed: these keys are read as they come, so there is no reader's sentence to
   reach for and the shape each reader needs to function is the whole of what a write can check. */
const aString = (key, given) =>
  (typeof given === "string" && given.trim() ? null : said(key, "a non-empty string", given));

const listOfNames = (key, given) =>
  (Array.isArray(given) && given.length > 0
    && given.every((one) => typeof one === "string" && one.trim())
    ? null : said(key, "a list of one or more non-empty names", given));

const eachString = (key, given) => {
  if (!given || typeof given !== "object" || Array.isArray(given)) return said(key, "a table", given);
  const wrong = Object.entries(given).find(([, one]) => typeof one !== "string" || !one.trim());
  return wrong ? aString(`${key}.${wrong[0]}`, wrong[1]) : null;
};

const outside = (key, given, allowed) => {
  const { unknown } = chosen(given, allowed, allowed[0]);
  return unknown === undefined ? null : said(key, `one of ${allowed.join(", ")}`, given);
};

const codexRefusal = (given) => {
  if (!given || typeof given !== "object" || Array.isArray(given)) return said("codex", "a table", given);
  if (given.pathRe !== undefined && !(typeof given.pathRe === "string" && compiles(given.pathRe))) {
    return said("codex.pathRe", "a regular expression this CLI can compile", given.pathRe);
  }
  if (given.check !== undefined && aString("codex.check", given.check)) {
    return aString("codex.check", given.check);
  }
  if (checkMsOf(given.checkMs).unknown !== undefined) {
    return said("codex.checkMs", CHECK_MS_TAKES, given.checkMs);
  }
  return codexOwedOf(given).unknown === undefined
    ? null : said("codex.owed", `a list of ${OWED_DOORS.join(", ")}`, given.owed);
};

const statsRefusal = (given) => {
  if (!given || typeof given !== "object" || Array.isArray(given)) return said("stats", "a table", given);
  const commands = given.commands;
  if (commands === undefined) return null;
  if (!commands || typeof commands !== "object" || Array.isArray(commands)) {
    return said("stats.commands", "a table", commands);
  }
  const unknown = Object.keys(commands).find((one) => !DECLARABLE.includes(one));
  if (unknown) return said(`stats.commands.${unknown}`, `one of ${DECLARABLE.join(", ")}`, commands[unknown]);
  const empty = Object.keys(commands).find((one) => declares(one, commands) === null);
  return empty ? said(`stats.commands.${empty}`, "a command, or a list of them", commands[empty]) : null;
};

const ROUTED = {
  flow: "forge doctor --flow <slug>, which writes it together with every key that flow asks this"
    + " project for",
  method: "forge doctor --flow <slug>: `method` is retired and the flow is what replaced it",
};

/** One row per top-level key of the project file. `paths` maps every path under it a value may be
 *  written to onto how a word is spelled into JSON, `*` being any one name the project chooses;
 *  `judge` is handed the sub-object the write would leave and answers with the reader's own refusal.
 *  A key routed rather than written carries no paths and names the verb that writes it. */
export const PROJECT_KEYS = {
  slug: { paths: { "": "text" }, judge: (given) => aString("slug", given) },
  translate: { paths: { "": "text" }, judge: (given) => aString("translate", given) },
  runs: {
    paths: { "": "number" },
    judge: (given) => (runsOf(given).unknown === undefined ? null : said("runs", RUNS_TAKES, given)),
  },
  deps: { paths: { "*": "text" }, judge: (given) => eachString("deps", given) },
  codex: {
    paths: { pathRe: "text", check: "text", checkMs: "number", owed: "list" },
    judge: codexRefusal,
  },
  stop: { paths: { agents: "list" }, judge: (given) => listOfNames("stop.agents", given?.agents) },
  jobs: { paths: { "*.verbs": "list", "*.skills": "list" }, judge: (given) => jobsOf(given).problems[0] ?? null },
  rank: { paths: { "*": "number", "*.*": "number" }, judge: (given) => foldWeights(given).refusal },
  review: { paths: { lines: "number", paths: "list" }, judge: reviewRefusalOf },
  feedback: {
    paths: { plugin: "text", project: "text" },
    judge: (given) => outside("feedback.plugin", given?.plugin, FEEDBACK_CHANNELS)
      || outside("feedback.project", given?.project, FEEDBACK_CHANNELS),
  },
  flow: { routed: ROUTED.flow },
  drainedBy: { paths: { "": "text" }, judge: (given) => outside("drainedBy", given, DRAINS) },
  landing: { paths: { "": "text" }, judge: (given) => outside("landing", given, LANDING_ROUTES) },
  lease: {
    paths: { workingRe: "text" },
    judge: (given) => (workPatternOf(given?.workingRe).unreadable
      ? said("lease.workingRe", "a regular expression this CLI can compile", given?.workingRe) : null),
  },
  stats: { paths: { "commands.*": "text" }, judge: statsRefusal },
  method: { routed: ROUTED.method },
};

/** The set a checker holds to the keys this plugin reads: a writable key nothing reads hands out a
 *  file with a line in it that does nothing. */
export const PROJECT_KEY_NAMES = Object.keys(PROJECT_KEYS).sort();

/** Whether the key names this file at all, path or no path, so a mistyped tail under a key of this table is answered by this file's own list rather than by a tracker that never held the name either. */
export const readsProjectKey = (given) => Object.hasOwn(PROJECT_KEYS, String(given).split(".")[0]);

const matches = (pattern, tail) => {
  const wanted = pattern === "" ? [] : pattern.split(".");
  return wanted.length === tail.length && wanted.every((one, index) => one === "*" || one === tail[index]);
};

/** What a dotted key names, or null where this plugin writes no such key: the segments to walk, how
 *  its value is spelled, and the key whose reader judges the result — or the verb that writes it. */
export const writableKey = (given) => {
  const segments = String(given).split(".");
  const row = PROJECT_KEYS[segments[0]];
  if (!row) return null;
  if (row.routed) return { top: segments[0], routed: row.routed };
  const tail = segments.slice(1);
  const pattern = Object.keys(row.paths).find((one) => matches(one, tail));
  return pattern === undefined ? null : { top: segments[0], segments, takes: row.paths[pattern] };
};

/** Every path a caller may name, so the refusal that lists this resource teaches the shapes too. */
export const writablePaths = () =>
  Object.entries(PROJECT_KEYS).flatMap(([key, row]) => (row.routed
    ? []
    : Object.keys(row.paths).map((tail) => [key, tail].filter(Boolean).join("."))));

const TRUE_FALSE = { true: true, false: false };

/** The command-line word as JSON: `null` is the value everywhere, a list is comma-separated, and a
 *  number that is not one is passed through as typed so the key's own reader is what says so. */
export const spelled = (takes, raw) => {
  if (raw === "null") return null;
  if (takes === "list") return raw.split(",").map((one) => one.trim()).filter(Boolean);
  if (takes === "number") return /^-?\d+$/u.test(raw) ? Number(raw) : raw;
  return Object.hasOwn(TRUE_FALSE, raw) ? TRUE_FALSE[raw] : raw;
};

/** The parsed document this write would leave, or the key on the way to it that holds something other
 *  than a table — the case the text walk refuses too, read first so the judgement comes before it. */
export const settingTo = (parsed, segments, value) => {
  const held = structuredClone(parsed);
  let at = held;
  for (const [index, key] of segments.slice(0, -1).entries()) {
    if (at[key] === undefined) at[key] = {};
    if (!at[key] || typeof at[key] !== "object" || Array.isArray(at[key])) {
      return { blocked: segments.slice(0, index + 1).join("."), holds: at[key] };
    }
    at = at[key];
  }
  at[segments.at(-1)] = value;
  return { parsed: held };
};

export const readAt = (parsed, segments) =>
  segments.reduce((at, key) => (at === null || typeof at !== "object" ? undefined : at[key]), parsed);
