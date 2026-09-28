/* The gateway profile: an env file the shim outside this repository owns and Claude Code consumes as
   environment, so this reads it and nothing here writes it — its model slots decide which model a
   subagent's frontmatter spawns on. Its grammar is its own, which is why it sits apart from the table
   that treats it as one store's fallback. docs/cli/settings.md. */
import { accessSync, constants, readFileSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";


const profilePath = () =>
  process.env.CLAUDE_PROXY_ENV || join(homedir(), ".claude", "claude-proxy.env");

const ENV_LINE = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/;

/* The profile is bash-sourced, and a live key is kept out of it by sourcing a sibling file, so the
   one shell statement read beyond an assignment is `.` or `source`, bare or behind the file test that
   guards it. Any other statement that sources is still recognised, so it is reported as not followed
   rather than dropped. */
const WORD = String.raw`("[^"]*"|'[^']*'|[^\s'"&;|]+)`;
const GUARD = String.raw`(?:\[\s+-([efr])\s+${WORD}\s+\]|test\s+-([efr])\s+${WORD})\s*&&\s*`;
const SOURCE_LINE = new RegExp(String.raw`^(?:${GUARD})?(?:\.|source)\s+${WORD}\s*;?$`, "u");
const SOURCING = /(?:^|&&|\|\||;|\bthen\b|\bdo\b)\s*(?:\.|source)\s+\S/u;

const VARIABLE = /\$(?:\{([A-Za-z_][A-Za-z0-9_]*)\}|([A-Za-z_][A-Za-z0-9_]*))/gu;

const unquoted = (raw) => {
  const value = raw.trim();
  const quote = value[0];
  const paired = (quote === '"' || quote === "'") && value.endsWith(quote) && value.length > 1;
  return paired ? value.slice(1, -1) : value;
};

/* A variable the profile assigned is held as written, so one naming another is expanded again, to a
   depth no honest profile reaches and a self-reference stops at. */
const DEPTH = 8;

/* A word as bash expands it for a path: single quotes literal, `~/` only unquoted, and a variable
   only where this reader knows it — HOME, or one the profile assigned above — since the shell that
   sources the profile has an environment this process does not. */
const expanded = (word, values) => {
  if (word.startsWith("'")) return { path: word.slice(1, -1) };
  const quoted = word.startsWith('"');
  const body = quoted ? word.slice(1, -1) : word;
  if (/[`]|\$\(/u.test(body)) return { why: "a command substitution this reader does not run" };
  let path = !quoted && body.startsWith("~/") ? `${homedir()}${body.slice(1)}` : body;
  const unknown = new Set();
  for (let depth = 0; depth < DEPTH && path.includes("$") && !unknown.size; depth += 1) {
    path = path.replace(VARIABLE, (whole, braced, bare) => {
      const name = braced ?? bare;
      const known = Object.hasOwn(values, name) ? values[name] : name === "HOME" ? homedir() : null;
      if (known === null) unknown.add(`$${name}`);
      return known ?? whole;
    });
  }
  if (unknown.size) return { why: `${[...unknown].join(", ")}, which neither the profile above it nor HOME sets` };
  if (/\$/u.test(path)) return { why: "an expansion this reader does not perform" };
  if (!isAbsolute(path)) return { why: "a relative path, which bash resolves against the caller's directory and PATH" };
  return { path };
};

/* The file test as bash answers it: `-f` a regular file, `-e` anything there, `-r` readable. */
const TESTS = {
  f: (path) => statSync(path).isFile(),
  e: (path) => Boolean(statSync(path)),
  r: (path) => accessSync(path, constants.R_OK) === undefined,
};

const admitted = (operator, path) => {
  try {
    return TESTS[operator](path);
  } catch {
    return false;
  }
};

const identity = (file) => {
  try {
    return realpathSync(file);
  } catch {
    return file;
  }
};

const followed = (state, line, file, reading) => {
  const matched = SOURCE_LINE.exec(line);
  if (!matched) {
    state.unfollowed.push({ file: line, in: file, why: "a statement this reader does not follow" });
    return;
  }
  const [, bracketTest, guardBracket, testTest, guardTest, target] = matched;
  const guard = guardBracket ?? guardTest;
  const operator = bracketTest ?? testTest;
  if (guard) {
    const tested = expanded(guard, state.values);
    if (tested.why) {
      state.unfollowed.push({ file: guard, in: file, why: tested.why });
      return;
    }
    if (!admitted(operator, tested.path)) {
      state.unfollowed.push({ file: tested.path, in: file, why: `not what its -${operator} guard admits, so it was skipped` });
      return;
    }
  }
  const named = expanded(target, state.values);
  if (named.why) {
    state.unfollowed.push({ file: target, in: file, why: named.why });
    return;
  }
  reading(named.path, file);
};

const readInto = (state, text, file) => {
  const reading = (path, from) => {
    const id = identity(path);
    if (state.stack.includes(id)) {
      state.unfollowed.push({ file: path, in: from, why: "already being read, so it would source itself" });
      return;
    }
    let nested;
    try {
      nested = readFileSync(path, "utf8");
    } catch (error) {
      const why = error.code === "ENOENT" ? "absent" : `unreadable (${error.code ?? error.message})`;
      state.unfollowed.push({ file: path, in: from, why });
      return;
    }
    readInto(state, nested, path);
  };
  state.stack.push(file ? identity(file) : null);
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const matched = ENV_LINE.exec(line);
    if (matched) {
      state.values[matched[1]] = unquoted(matched[2]);
      state.from[matched[1]] = file;
    } else if (SOURCING.test(line)) followed(state, line, file, reading);
  }
  state.stack.pop();
};

/** What a profile's text assigns, in the order bash would, with every file it sources followed:
 *  `from` names the file each key was last assigned in, and `unfollowed` each source that was not. */
export const profileFrom = (text, file = null) => {
  const state = { values: {}, from: {}, unfollowed: [], stack: [] };
  readInto(state, text, file);
  return { values: state.values, from: state.from, unfollowed: state.unfollowed };
};

export const profileValues = () => {
  const path = profilePath();
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return { path, values: null, from: {}, unfollowed: [] };
  }
  return { path, ...profileFrom(text, path) };
};

/** The sources a profile holds that were not followed, as one clause a problem can carry; a source
 *  met in a nested file names that file, the profile's own going without. */
export const unfollowedSaid = (unfollowed, profile) => unfollowed
  .map((one) => `${one.file} (${one.in && one.in !== profile ? `sourced from ${one.in}: ` : ""}${one.why})`)
  .join("; ");
