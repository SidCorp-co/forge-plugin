/* What one shell command runs, read as the script it reaches rather than the text it was typed as: a
   node script resolved to its file, an npm script to its package and name. The landing gate compares
   that with what the project declared its gate to be, so a project declares its gate once and every
   spelling of the same run is the same run (ISS-3194). Nothing is read out of a script's name: only a
   target the project's own declaration resolves to is ever a gate (ISS-1586). */
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

/** The words of one command as the shell would hand them over: quotes removed, a backslash escaping
 *  the character after it, and every redirection dropped with its target. Null where a quote is left
 *  open, which reads as nothing rather than as a guess. */
export const wordsOf = (span) => {
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

/* What runs another program and how many of its own words come first. A value-taking option names its
   value as the next word unless it is attached; `positional` is the arguments the launcher takes before
   the program, as `timeout`'s duration. */
const LAUNCHERS = {
  sudo: { takes: ["-u", "-g", "-C", "-D", "-p", "-r", "-t", "-T", "-U", "--user", "--group", "--chdir"] },
  env: { takes: ["-u", "-C", "-S", "--unset", "--chdir"], assigns: true },
  time: { takes: ["-f", "-o", "--format", "--output"] },
  timeout: { takes: ["-k", "-s", "--kill-after", "--signal"], positional: 1 },
  nohup: { takes: [] },
  nice: { takes: ["-n", "--adjustment"] },
  setsid: { takes: [] },
  ionice: { takes: ["-c", "-n", "-p", "-P", "-u", "--class", "--classdata", "--pid", "--pgid", "--uid"] },
  stdbuf: { takes: ["-i", "-o", "-e", "--input", "--output", "--error"] },
  command: { takes: [] },
  exec: { takes: ["-a"] },
  xargs: { takes: ["-a", "-d", "-E", "-I", "-L", "-n", "-P", "-s", "--arg-file", "--delimiter", "--max-args", "--max-procs"] },
  npx: { takes: ["-p", "--package", "-c", "--call"] },
};

const NODE_TAKES = ["-r", "--require", "--import", "--loader", "--experimental-loader", "--env-file", "--conditions", "-C", "--title", "--input-type"];
const NPM_TAKES = ["--prefix", "-C", "--workspace", "-w", "--loglevel", "--userconfig", "--cache", "--registry"];
const NPM_RUN = new Set(["run", "run-script", "rum", "urn"]);
const ASSIGNMENT = /^[A-Za-z_][\w]*=/u;

const base = (word) => word.split("/").at(-1);

/** The index of the first word past `from` that is no option of `takes`, an attached `--x=v` or `-xV`
 *  form included; a bare `--` ends the options. */
const pastOptions = (words, from, takes) => {
  let at = from;
  while (at < words.length && words[at].startsWith("-") && words[at] !== "-") {
    if (words[at] === "--") return at + 1;
    if (takes.includes(words[at])) at += 1;
    at += 1;
  }
  return at;
};

/** The words of the program a command runs once every assignment and launcher before it is skipped. */
const programOf = (words) => {
  let at = 0;
  for (;;) {
    while (at < words.length && ASSIGNMENT.test(words[at])) at += 1;
    const launcher = LAUNCHERS[base(words[at] ?? "")];
    if (!launcher) return words.slice(at);
    at = pastOptions(words, at + 1, launcher.takes);
    if (launcher.assigns) while (at < words.length && ASSIGNMENT.test(words[at])) at += 1;
    at += launcher.positional ?? 0;
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
  const program = programOf(words);
  const name = base(program[0] ?? "");
  if (name === "node" || name === "nodejs") {
    const at = pastOptions(program, 1, NODE_TAKES);
    const script = program[at];
    if (!script || program.slice(1, at).some((one) => /^(?:-e|--eval|-p|--print)$/u.test(one))) return null;
    const file = real(isAbsolute(script) ? script : resolve(directory, script));
    return file ? { node: file } : null;
  }
  if (name === "npm") {
    let prefix = null;
    let at = 1;
    while (at < program.length && !NPM_RUN.has(program[at])) {
      const one = program[at];
      if (one === "--prefix" || one === "-C") prefix = program[(at += 1)];
      else if (one.startsWith("--prefix=")) prefix = one.slice("--prefix=".length);
      else if (NPM_TAKES.includes(one)) at += 1;
      else if (!one.startsWith("-")) return null;
      at += 1;
    }
    const script = program[pastOptions(program, at + 1, NPM_TAKES)];
    if (at >= program.length || !script) return null;
    const pkg = prefix ? real(resolve(directory, prefix)) : packageAbove(directory);
    return pkg ? { npm: pkg, script } : null;
  }
  return null;
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
