/* What one shell command runs, read as the script it reaches rather than the text it was typed as: a
   node script resolved to its file, an npm script to its package and name. The landing gate compares
   that with what the project declared its gate to be, so a project declares its gate once and every
   spelling of the same run is the same run (ISS-3194). Nothing is read out of a script's name: only a
   target the project's own declaration resolves to is ever a gate (ISS-1586). */
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

import { wrapperRow } from "../shell/wrappers.mjs";

/** The words of one command as the shell would hand them over: quotes removed, a backslash escaping
 *  the character after it, and every redirection dropped with its target. Null where a quote is left
 *  open, which reads as nothing rather than as a guess. */
const wordsOf = (span) => {
  const words = [];
  let word = null;
  let quote = null;
  for (let at = 0; at < span.length; at += 1) {
    const one = span[at];
    if (quote === "'") {
      if (one === "'") quote = null;
      else word += one;
    } else if (quote === '"') {
      if (one === '"') quote = null;
      else if (one === "\\" && /["\\$`]/u.test(span[at + 1] ?? "")) word += span[(at += 1)];
      else word += one;
    } else if (one === "'" || one === '"') {
      quote = one;
      word ??= "";
    } else if (one === "\\") {
      word = (word ?? "") + (span[(at += 1)] ?? "");
    } else if (/[ \t\n]/u.test(one)) {
      if (word !== null) words.push(word);
      word = null;
    } else if (/[;&|()]/u.test(one) && word === null) {
      break;
    } else {
      word = (word ?? "") + one;
    }
  }
  if (quote) return null;
  if (word !== null) words.push(word);
  return withoutRedirections(words);
};

const REDIRECTION = /^(?:\d*|&)(?:>>?|<|>&|<&)(.*)$/u;

const withoutRedirections = (words) => {
  const kept = [];
  for (let at = 0; at < words.length; at += 1) {
    const said = REDIRECTION.exec(words[at]);
    if (!said) kept.push(words[at]);
    else if (!said[1]) at += 1;
  }
  return kept;
};

const NODE_TAKES = { takes: "rC", long: ["require", "import", "loader", "experimental-loader", "env-file", "conditions", "title", "input-type"] };
const NPM_TAKES = { takes: "Cw", long: ["prefix", "workspace", "loglevel", "userconfig", "cache", "registry"] };
const NPM_RUN = new Set(["run", "run-script", "rum", "urn"]);
/* node handed its program inline runs no script file. */
const INLINE = /^(?:-[a-zA-Z]*[ep][a-zA-Z]*|--eval|--print)(?:=|$)/u;
const ASSIGNMENT = /^[A-Za-z_][\w]*=/u;

const base = (word) => word.split("/").at(-1);

/** The options at `from` in getopt's shape, by `row`'s `takes` and `long`: a short cluster whose value
 *  is attached or the next word, a long option with `=value` or the next word. Calls `seen(name,
 *  value)` for each and returns the index of the first word that is no option; a bare `--` ends them. */
const optionsFrom = (words, from, row, seen = () => {}) => {
  let at = from;
  while (at < words.length && words[at].startsWith("-") && words[at] !== "-") {
    const word = words[at];
    if (word === "--") return at + 1;
    if (word.startsWith("--")) {
      const [name, attached] = word.slice(2).split(/=(.*)/su);
      const value = attached ?? (row.long.includes(name) ? words[(at += 1)] : undefined);
      seen(name, value);
    } else {
      const letters = word.slice(1);
      const taking = [...letters].findIndex((one) => row.takes.includes(one));
      if (taking >= 0) seen(letters[taking], letters.slice(taking + 1) || words[(at += 1)]);
    }
    at += 1;
  }
  return at;
};

/** The program a command runs once every assignment and launcher before it is skipped, and the
 *  directory it runs in, moved by a launcher's own change-directory option. */
const programOf = (words, directory) => {
  let at = 0;
  let stands = directory;
  for (;;) {
    while (at < words.length && ASSIGNMENT.test(words[at])) at += 1;
    const row = wrapperRow(base(words[at] ?? ""));
    if (!row) return { program: words.slice(at), directory: stands };
    at = optionsFrom(words, at + 1, row, (name, value) => {
      if (row.chdir.includes(name) && value) stands = resolve(stands, value);
    });
    while (at < words.length && ASSIGNMENT.test(words[at])) at += 1;
    at += row.positional;
  }
};

const real = (path) => {
  try {
    return realpathSync(path);
  } catch {
    return null;
  }
};

/* npm runs a script from the nearest directory above where it stands that holds a package.json. */
const packageAbove = (directory) => {
  let at = resolve(directory);
  for (;;) {
    if (existsSync(join(at, "package.json"))) return real(at);
    const up = dirname(at);
    if (up === at) return null;
    at = up;
  }
};

/** What `span`, standing in `directory`, runs: `{ node: <the script's real path> }`, `{ npm: <the
 *  package directory>, script }`, or null where it is neither or does not resolve. */
export const runsOf = (span, directory) => {
  const words = wordsOf(span);
  if (!words) return null;
  const { program, directory: stands } = programOf(words, directory);
  const name = base(program[0] ?? "");
  if (name === "node" || name === "nodejs") {
    const at = optionsFrom(program, 1, NODE_TAKES);
    const script = program[at];
    if (!script || program.slice(1, at).some((one) => INLINE.test(one))) return null;
    const file = real(isAbsolute(script) ? script : resolve(stands, script));
    return file ? { node: file } : null;
  }
  if (name !== "npm") return null;
  /* npm reads its own options on either side of `run` and after the script's name alike. */
  let prefix = null;
  const noted = (option, value) => {
    if ((option === "prefix" || option === "C") && value) prefix = value;
  };
  const verbAt = optionsFrom(program, 1, NPM_TAKES, noted);
  if (!NPM_RUN.has(program[verbAt])) return null;
  const scriptAt = optionsFrom(program, verbAt + 1, NPM_TAKES, noted);
  const script = program[scriptAt];
  if (!script) return null;
  /* Past the script's name npm still reads its own options, up to a `--`, which hands the rest to the script. */
  for (let at = scriptAt + 1; at < program.length && program[at] !== "--";) {
    at = program[at].startsWith("-") ? optionsFrom(program, at, NPM_TAKES, noted) : at + 1;
  }
  const pkg = prefix ? real(resolve(stands, prefix)) : packageAbove(stands);
  return pkg ? { npm: pkg, script } : null;
};

/** The targets a project's declared gate commands resolve to from `root`, an npm script's own body
 *  followed one step, so a gate declared as `npm run gate` is also the node script that script runs. */
export const declaredTargets = (commands, root) => commands.flatMap((command) => {
  const target = runsOf(command, root);
  if (!target?.npm) return target ? [target] : [];
  let body = null;
  try {
    body = JSON.parse(readFileSync(join(target.npm, "package.json"), "utf8")).scripts?.[target.script] ?? null;
  } catch {
    body = null;
  }
  const inner = typeof body === "string" ? runsOf(body, target.npm) : null;
  return inner ? [target, inner] : [target];
});

/** Whether `target` is one of `targets`. */
export const sameRun = (target, targets) => Boolean(target) && targets.some((one) => (target.node
  ? one.node === target.node
  : one.npm === target.npm && one.script === target.script));
