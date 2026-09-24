/* The project's own configuration file as a thing that can be written: where one key's pair sits in
   its text, which paths take a value and how a word is spelled into one, and whose reader says what
   that value may not be. The file is this machine's record of one project and is read by every
   session standing in any checkout of it, so a write edits the span it changes and nothing else — a
   document re-serialized from its parse loses the shape whoever wrote it by hand was reading, and a
   file adopted out of a checkout carries that shape in. What a key means: README.md's
   Configuration. */
import { closeSync, existsSync, fchmodSync, mkdirSync, openSync, readFileSync, realpathSync,
  renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { compiles } from "../../codex/codex.mjs";
import { reviewRefusalOf } from "../../git/reviewed.mjs";
import { DECLARABLE, declares } from "../../stats/corpus/declared.mjs";
import { REPORT_MODES } from "../../stats/daily/trigger.mjs";
import { RANK_ROWS, RANK_WEIGHTS, foldWeights } from "../../rank/weights.mjs";
import {
  CHECK_MS_AT_MOST,
  CHECK_MS_TAKES,
  Refusal,
  projectFilePath,
  fail,
  DRAINS,
  FEEDBACK_CHANNELS,
  fromProject,
  LANDING_ROUTES,
  OWED_DOORS,
  PROJECT_SHAPES,
  RELEASE_MODES,
  RUNS_TAKES,
  SHIP_MODES,
  checkMsOf,
  slugRouteHere,
  chosen,
  codexOwedOf,
  jobsOf,
  runsOf,
  workPatternOf,
} from "../../resolve/settings.mjs";

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

/* Beside the pairs the object already holds and in the shape they are written in — one written on a line takes the new pair on that line, one broken over lines takes it at the indentation its own pairs sit at, and one with no pair at all has no shape to copy — so the key a call named is the one line somebody's review has to read. */
const inserted = (text, open, key, value) => {
  const pair = `${JSON.stringify(key)}: ${JSON.stringify(value)}`;
  const first = pastSpace(text, open + 1);
  if (text[first] === "}") return `${text.slice(0, open + 1)}\n  ${pair}\n${text.slice(first)}`;
  const between = text.slice(open + 1, first);
  const line = between.includes("\n") ? between.slice(between.lastIndexOf("\n")) : " ";
  return `${text.slice(0, open + 1)}${line}${pair},${text.slice(open + 1)}`;
};

/** The file's text with the key this path names set, every other byte as it was, or null where the
 *  document cannot be walked there. An absent path is created as far down as it is missing. */
const withPath = (text, segments, value) => {
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
  `\`${key}\` in ${fromProject()} is ${takes}, not \`${JSON.stringify(given ?? null)}\`.`;

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
  const clock = checkMsOf(given.checkMs);
  if (clock.unknown !== undefined) {
    return said("codex.checkMs", CHECK_MS_TAKES, given.checkMs);
  }
  /* The second of this key's two refusals, and the one the shape alone cannot reach: a number of
     exactly the form asked for that no consult can honour is written, read past, and never used, so
     it is refused where it is typed rather than reported by whichever caller happens to notice. */
  if (clock.over !== undefined) {
    return said("codex.checkMs", CHECK_MS_AT_MOST(), given.checkMs);
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
  if (unknown !== undefined) {
    return said(`stats.commands.${unknown}`, `one of ${DECLARABLE.join(", ")}`, commands[unknown]);
  }
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
 *  A key routed rather than written carries no paths and names the verb that writes it, and one
 *  whose call depends on where the reader stands carries `route`, which answers it for this call. */
export const PROJECT_KEYS = {
  /* The slug is settable like any key and is still not offered like one: in a checkout standing on
     a file this machine has not taken over, the call that works is the adoption. One reading
     answers that for every message that offers the way out, this row included. */
  slug: { paths: { "": "text" }, judge: (given) => aString("slug", given), route: slugRouteHere },
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
  jobs: {
    paths: { "*": "list", "*.verbs": "list", "*.skills": "list" },
    judge: (given) => jobsOf(given).problems[0] ?? null,
  },
  rank: {
    paths: { "*": "number", "*.*": "number" },
    names: { "*": RANK_WEIGHTS, "*.*": RANK_ROWS },
    judge: (given) => foldWeights(given).refusal,
  },
  review: { paths: { lines: "number", paths: "list" }, judge: reviewRefusalOf },
  feedback: {
    paths: { plugin: "text", project: "text" },
    judge: (given) => outside("feedback.plugin", given?.plugin, FEEDBACK_CHANNELS)
      || outside("feedback.project", given?.project, FEEDBACK_CHANNELS),
  },
  flow: { routed: ROUTED.flow },
  drainedBy: { paths: { "": "text" }, judge: (given) => outside("drainedBy", given, DRAINS) },
  landing: { paths: { "": "text" }, judge: (given) => outside("landing", given, LANDING_ROUTES) },
  ship: { paths: { "": "text" }, judge: (given) => outside("ship", given, SHIP_MODES) },
  shape: { paths: { "": "text" }, judge: (given) => outside("shape", given, PROJECT_SHAPES) },
  release: { paths: { "": "text" }, judge: (given) => outside("release", given, RELEASE_MODES) },
  report: { paths: { "": "text" }, judge: (given) => outside("report", given, REPORT_MODES) },
  lease: {
    paths: { workingRe: "text" },
    judge: (given) => (workPatternOf(given?.workingRe).unreadable
      ? said("lease.workingRe", "a regular expression this CLI can compile", given?.workingRe) : null),
  },
  stats: {
    paths: { "commands.*": "commands" },
    names: { "commands.*": DECLARABLE.map((one) => `commands.${one}`) },
    judge: statsRefusal,
  },
  /* Routed and retired both, which is not the same offer: the reading that says what a project
     may still declare skips this row, a key its own writer refuses being no decision left to take. */
  method: { routed: ROUTED.method, retired: true },
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
  /* An empty segment is a key with no name, which a wildcard would otherwise take: `stats.commands.`
     would write a label nothing reads and read back as the value it was sent. */
  if (!readsProjectKey(given) || segments.some((one) => one === "")) return null;
  const row = PROJECT_KEYS[segments[0]];
  if (row.routed) return { top: segments[0], routed: row.routed };
  const tail = segments.slice(1);
  const pattern = Object.keys(row.paths).find((one) => matches(one, tail));
  return pattern === undefined ? null : { top: segments[0], segments, takes: row.paths[pattern] };
};

/** What a path spells out to where this table holds a closed set of names for it: the tails its own
 *  judge accepts, in place of the pattern. A reading that offers a name off this list offers a key
 *  the write takes, where the pattern itself would offer a word that reader refuses. A tail with no
 *  list stands as it is, its name being the project's own to choose. */
const spelledNames = (row, tail) => row.names?.[tail] ?? [tail];

/** Every decision this file leaves a project: one row per path a value may be written to, and one
 *  per key another verb writes, so a reading of what a project has NOT decided derives from this
 *  table and from nothing beside it. A retired key is left out rather than offered. */
export const declarablePaths = () => Object.entries(PROJECT_KEYS)
  .filter(([, row]) => !row.retired)
  .flatMap(([key, row]) => (row.routed
    ? [{ key, path: key, routed: row.routed }]
    : Object.keys(row.paths).flatMap((tail) => spelledNames(row, tail)
      .map((one) => ({ key, path: [key, one].filter(Boolean).join("."), takes: row.paths[tail],
        routed: row.route?.() ?? undefined })))));

/** Every path a caller may name, so the refusal that lists this resource teaches the shapes too. */
export const writablePaths = () =>
  Object.entries(PROJECT_KEYS).flatMap(([key, row]) => (row.routed
    ? []
    : Object.keys(row.paths).map((tail) => [key, tail].filter(Boolean).join("."))));

/* JSON's own number, not `Number`'s: `0x10` and `1e1000` are words this hands to the key's reader as text, rather than as 16 and Infinity. Which numbers a key takes is that reader's. */
const A_NUMBER = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/u;

const listed = (raw) => raw.split(",").map((one) => one.trim()).filter(Boolean);

/** The command-line word as JSON: `null` is the value everywhere, a list is comma-separated, a command
 *  is the word as typed until a comma makes it several, and a number that is not one is passed through
 *  as typed so the key's own reader is what says so. No key of this file takes a boolean, so `true` is
 *  the word `true` — which is a command, and one a reader of a command accepts. */
export const spelled = (takes, raw) => {
  if (raw === "null") return null;
  if (takes === "list") return listed(raw);
  if (takes === "commands") return raw.includes(",") ? listed(raw) : raw;
  return takes === "number" && A_NUMBER.test(raw) ? Number(raw) : raw;
};

/* Own and defined properties throughout, a segment being a name off a command line: `__proto__` read as an inherited one walks into Object.prototype, a table every object answers with, and the judgement would then be handed a document this write is not about. */
const ownAt = (at, key) =>
  (at !== null && typeof at === "object" && Object.hasOwn(at, key) ? at[key] : undefined);

const define = (at, key, value) =>
  Object.defineProperty(at, key, { value, writable: true, enumerable: true, configurable: true });

/** The parsed document this write would leave, or the key on the way to it that holds something other than a table — the case the text walk refuses too, read first so the judgement comes before it. */
const settingTo = (parsed, segments, value) => {
  const held = structuredClone(parsed);
  let at = held;
  for (const [index, key] of segments.slice(0, -1).entries()) {
    if (ownAt(at, key) === undefined) define(at, key, {});
    const next = ownAt(at, key);
    if (!next || typeof next !== "object" || Array.isArray(next)) {
      return { blocked: segments.slice(0, index + 1).join("."), holds: next };
    }
    at = next;
  }
  define(at, segments.at(-1), value);
  return { parsed: held };
};

const readAt = (parsed, segments) => segments.reduce((at, key) => ownAt(at, key), parsed);

/** The write spelled as it is typed, so a row offering one key and the usage naming any of them
 *  cannot drift apart. */
export const setCall = (key, value) => `forge doctor --set ${key}=${value}`;
export const SET_USAGE = setCall("<key>", "<value>");
export const READS_IT = "forge doctor";

/** A project key's value printed as it was written rather than measured: "3 entries" is the one thing
 *  a read back of a list cannot say. */
export const asWritten = (value) => JSON.stringify(value ?? null);

/* Through a sibling and renamed into place, the install and the restore alike: a plain write opens the destination truncating, so one that fails part way leaves neither the bytes it replaced nor the ones it was writing, and a restore doing that would destroy the very state its refusal is about to report. The mode is set on the handle rather than asked for at creation, a umask otherwise narrowing a file this project shares. */
export const wroteWhole = (path, text) => {
  const temporary = `${path}.${process.pid}.tmp`;
  try {
    const mode = statSync(path).mode & 0o777;
    const handle = openSync(temporary, "w", mode);
    try {
      fchmodSync(handle, mode);
      writeFileSync(handle, text);
    } finally {
      closeSync(handle);
    }
    renameSync(temporary, path);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
};

/* What a first write that did not land leaves behind, which is nothing: `forge doctor --adopt`
   refuses against a file that exists, so an entry half made here would strand the checkout's
   committed configuration exactly as a refused write once did. A removal that fails is said,
   that one file being all that stands between its reader and the adoption. Reached only past the
   exclusive handle below, because only past it is the file this call's own to remove. */
const sweptAway = (path) => {
  try {
    rmSync(path, { force: true });
    return ` ${path} did not exist before this call and does not now.`;
  } catch (error) {
    return ` ${path} did not exist before this call, was created by it and could not be removed `
      + `either: ${error.message}. Remove it by hand, or the adoption will refuse against it.`;
  }
};

/** The one way an entry that does not exist yet comes into being, whichever call is making it: a
 *  project that has set nothing has no file, so the first write creates one rather than refusing —
 *  refusing would leave `slug` unsettable in a checkout that names no project, the one key every
 *  other route needs before it can run. Created at 0600 like everything this plugin keeps under that
 *  directory, exclusively, and holding the text it is to hold — never an empty or half-written
 *  document a failure would then leave standing for the adoption to refuse against. */
export const createdWith = (path, text) => {
  mkdirSync(dirname(path), { recursive: true });
  /* Exclusive, and the whole reason the sweep below is safe: a call that created this entry between
     the absence read above and this line fails HERE, with nothing of that call's touched. A cleanup
     outside this handle removes whatever is standing there, which over that race is somebody else's
     configuration. */
  let handle = null;
  try {
    handle = openSync(path, "wx", 0o600);
  } catch (error) {
    throw error.code === "EEXIST"
      ? new Error(`${path} was created between this call reading that there was none and writing `
        + "one, so this call wrote nothing rather than over it. Run it again")
      : error;
  }
  /* Both steps past the handle, and the close among them: a filesystem that reports a write's
     failure only when the handle is closed would otherwise throw past the sweep, leaving the
     record standing behind a call that said nothing was written. The first failure is the one
     reported, the second being whatever the first left behind. */
  let failed = null;
  for (const step of [() => writeFileSync(handle, text), () => closeSync(handle)]) {
    try {
      step();
    } catch (error) {
      failed = failed ?? error;
    }
  }
  if (failed) throw new Error(`${failed.message}.${sweptAway(path)}`);
};

/* Created only once the value has been judged, never on the way to judging it: a refused first
   `--set` that left an entry behind would say nothing was written and still make `forge doctor
   --adopt` refuse ever after, stranding the checkout's committed configuration behind it. So an
   absent entry is this empty document in memory until the bytes are ready to land. */
const EMPTY = "{}\n";

/* The flag a refusal names is the one the caller typed: two flags write one key of this file, and a
   `--ship` refused with `--set:` in front of it sends its reader to a call they did not make. */
const openedFile = (key, said) => {
  const named = projectFilePath();
  if (!named) {
    fail(`${said}: \`${key}\` is a key of this machine's record of the project this directory belongs `
      + "to, and this directory belongs to no checkout, so there is no project to configure and "
      + "nothing was written. Run this from inside a checkout.");
  }
  if (!existsSync(named)) return { path: named, held: EMPTY, parsed: {}, absent: true };
  let path = named;
  try {
    path = realpathSync(named);
    const held = readFileSync(path, "utf8");
    const parsed = JSON.parse(held);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      fail(`${said}: ${path} holds ${Array.isArray(parsed) ? "a list" : JSON.stringify(parsed)} where a `
        + `JSON object with this project's keys in it belongs, and \`${key}\` is a key of that object. `
        + "Nothing was written.");
    }
    return { path, held, parsed, absent: false };
  } catch (error) {
    if (error instanceof Refusal) throw error;
    return fail(`${said}: ${path} is the file \`${key}\` is a key of and this could not read it as JSON, `
      + `so nothing was written: ${error.message}`);
  }
};

/* Both ways out after the bytes have landed, and neither may say nothing was written: a read that
   throws and a value that is not the one sent leave the same new file behind, and a restore that fails
   over either leaves a third state nobody would otherwise be told about. */
const putBack = (path, held, why, absent, said) => {
  try {
    if (absent) rmSync(path, { force: true });
    else wroteWhole(path, held);
  } catch (error) {
    fail(`${said}: ${why} Putting the previous bytes back failed too: ${error.message}. That file holds `
      + `what this call wrote and nothing here changed it further — read it: ${READS_IT}`);
  }
  fail(absent
    ? `${said}: ${why} ${path} did not exist before this call and does not now — set that key again, `
      + `or read what this project holds: ${READS_IT}`
    : `${said}: ${why} ${path} is back at what it held — read it and set that key by hand: ${READS_IT}`);
};

/** The one key written into the file's own text and read back off it, judged between the two by the
 *  reader that already reads it: what this took and that reader refuses would fail later instead. */
export const projectWrite = (route, value) => {
  const said = route.said ?? "--set";
  const { path, held, parsed, absent } = openedFile(route.key, said);
  const would = settingTo(parsed, route.segments, value);
  if (would.blocked) {
    fail(`${said}: \`${route.key}\` goes inside \`${would.blocked}\`, which this file holds as `
      + `${JSON.stringify(would.holds)} rather than as a table. Nothing was written: ${path}`);
  }
  const refusal = PROJECT_KEYS[route.top].judge(would.parsed[route.top]);
  if (refusal) fail(`${said}: ${refusal} Nothing was written: ${path} is as it was.`);
  const text = withPath(held, route.segments, value);
  if (text === null) {
    fail(`${said}: ${path} parses as JSON and this could not find where \`${route.key}\` sits in its `
      + "text, so writing it would mean re-serializing the whole document and reflowing every key "
      + `beside it. Nothing was written — set this one by hand: ${READS_IT} prints what it holds.`);
  }
  try {
    if (absent) createdWith(path, text);
    else wroteWhole(path, text);
  } catch (error) {
    fail(`${said}: ${path} is the file \`${route.key}\` is a key of and this could not write it, so `
      + `nothing was written: ${error.message}`);
  }
  /* Off the disk, never off the text this call composed, which is the only reading that can tell a
     write from the span the resolver goes on to read. */
  let back = null;
  try {
    back = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    putBack(path, held, `${path} was written and could not be read back, so nothing here can say what `
      + `it now holds: ${error.message}.`, absent, said);
  }
  const kept = readAt(back, route.segments);
  if (JSON.stringify(kept) !== JSON.stringify(value)) {
    putBack(path, held, `${route.key} was written as ${JSON.stringify(value)} and ${path} reads back `
      + `${JSON.stringify(kept ?? null)}, so that file declares the key somewhere this write did not `
      + "reach.", absent, said);
  }
  return [`${route.name}.${route.key}: ${asWritten(kept)}  ← ${path}`];
};

