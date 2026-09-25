/* What a failed call was once no refusal of this plugin's own is read in it: the command's answer,
   where the command whose status the line returns is one a table says answers with that exit, or an
   error filed under what failed. Why each and what it cannot tell: docs/cli/stats-the-refusals.md. */
import { at } from "./declared.mjs";
import { WAITS_ON_PID } from "../../hooks/wait-idiom.mjs";
import { fail, projectFileAt } from "../../resolve/settings.mjs";

/** Where a project declares its own table, beside `stats.commands`. */
export const ANSWERS_KEY = "stats.answers";

/** The table every project that declares none is read by: under each exit code, the commands that
 *  answer with it. A declaration REPLACES it rather than joining it, as `stats.commands` replaces the
 *  built-in commands: one table says what an answer is. Keyed by the code first so one write sets one
 *  whole entry, a pattern with no code being no answer at all. */
export const BUILT_IN_ANSWERS = {
  1: {
    pgrep: String.raw`pgrep[ \t]`,
    "grep -q": String.raw`grep(?:[ \t]+\S+)*?[ \t]+(?:-[A-Za-z]*q[A-Za-z]*|--quiet|--silent)(?![\w-])`,
    "git --quiet or --is-ancestor": String.raw`git[ \t]\S*(?:[ \t]+\S+)*?[ \t]+--(?:quiet|is-ancestor)(?![\w-])`,
    "tools/red.mjs": String.raw`node[ \t]+\S*tools/red\.mjs`,
  },
  124: { "timeout on a tail --pid wait": WAITS_ON_PID },
};

const compiles = (source) => {
  try {
    new RegExp(source, "u");
    return true;
  } catch {
    return false;
  }
};

const aTable = (given) => Boolean(given) && typeof given === "object" && !Array.isArray(given);
const anExit = (code) => /^\d+$/u.test(code) && Number(code) >= 1 && Number(code) <= 255;

/** The first thing wrong with a declared table, as the key, what it takes and what it holds; or null. */
export const answersProblem = (given) => {
  if (!aTable(given)) return { key: ANSWERS_KEY, takes: "a table of exit codes", given };
  for (const [code, commands] of Object.entries(given)) {
    const key = `${ANSWERS_KEY}.${code}`;
    if (!anExit(code)) return { key, takes: "no key of it: a key is an exit code from 1 to 255", given: commands };
    if (!aTable(commands)) return { key, takes: "a table of names, each a command pattern", given: commands };
    const wrong = Object.entries(commands).find(([, one]) => typeof one !== "string" || !one.trim() || !compiles(one));
    if (wrong) return { key: `${key}.${wrong[0]}`, takes: "a regular expression this CLI can compile", given: wrong[1] };
  }
  return null;
};

/** A table as the classifier reads it: each pattern anchored where a command starts. */
export const answersTable = (given = BUILT_IN_ANSWERS) => Object.entries(given)
  .flatMap(([code, commands]) => Object.entries(commands)
    .map(([name, command]) => ({ name, code: Number(code), match: at(command) })));

export const BUILT_IN_TABLE = answersTable();

/** The table a checkout's project declared, or the built-in one where it declared none. A table
 *  that cannot be read is refused rather than passed over: counted by the built-in table instead, a
 *  project's answers would read as its errors with nothing said. */
export const answersIn = (directory) => {
  const given = projectFileAt(directory)?.stats?.answers;
  if (given === undefined) return BUILT_IN_TABLE;
  const problem = answersProblem(given);
  if (problem) {
    fail(`stats: \`${problem.key}\` in the project configuration of ${directory} is ${problem.takes}, `
      + `not \`${JSON.stringify(problem.given ?? null)}\`. From that checkout: `
      + `forge doctor --set ${ANSWERS_KEY}.<exit code>.<name>=<pattern>, `
      + `or remove ${ANSWERS_KEY} to read the built-in table.`);
  }
  return answersTable(given);
};

const HEADER = /^Exit code (?<code>\d+)[ \t]*$/u;

/** The exit code the host wrote at the head of a failed shell call's result, or null. */
export const exitCodeOf = (body) => {
  const code = HEADER.exec(String(body).split("\n")[0].trim())?.groups.code;
  return code === undefined ? null : Number(code);
};

/* Where one command of a line ends: a list, a pipe, a background, a newline. Never the `&` of a
   redirection such as `2>&1` or `&>`, which joins nothing. */
const SEPARATOR = /(&&|\|\||(?<![<>&|])&(?![>&])|\||;|\n)/u;

/* A command after which the status is still the one before it: nothing in it can fail, since it has
   no expansion, glob or redirection to go wrong, and these three return 0 whatever words they hold. */
const INERT = /^(?:echo|true|:)(?:[ \t]+[^\s$`*?[\]<>{}~]+)*$/u;

/* What may stand ahead of a command through `&&` and still leave it certain to have run: a `cd` of
   literal words, or an `export` of names a shell accepts given literal values. Either builtin that
   failed says so in the body under its own name, and then it is no prelude. */
const LITERAL = "[^\\s$`*?[\\]<>{}~]+";
const PRELUDE = new RegExp(String.raw`^(?:cd(?:[ \t]+${LITERAL})*|export(?:[ \t]+[A-Za-z_]\w*(?:=${LITERAL})?)+)$`, "u");
const PRELUDE_FAILED = /\b(?:cd|export): /u;

/* A negated command's status is the opposite of its own, so its exit is never its answer; and a
   negation opening a pipeline inverts the pipeline, its last member included. */
const NEGATED = /^[\s({]*!/u;

/* A redirection the shell has to open before the command runs, which fails with the command never
   having run: every one but a descriptor duplicated and `/dev/null`. A heredoc opens nothing. */
const REDIRECTION = /(?<![<>])(?:>>?|<(?![<(]))(&?)[ \t]*([^\s;|&()]*)/gu;
const opensAFile = (command) => [...command.matchAll(REDIRECTION)]
  .some(([, duplicated, target]) => !(duplicated && /^(?:\d+|-)$/u.test(target)) && target !== "/dev/null");

/* The commands of a line whose status can be the line's: the last one, and each one before it that is
   followed only by `&&`-joined inert commands. Indices into the split, each a command. */
const returning = (parts) => {
  let index = parts.length - 1;
  const found = [index];
  while (index >= 2 && parts[index - 1] === "&&" && INERT.test(parts[index].trim())) {
    index -= 2;
    found.push(index);
  }
  return found;
};

/* Whether the command at `index` certainly ran. Behind `;`, a newline, `&` or `||` it did — after
   `||` a non-zero status means the right side ran. Behind a pipe the earlier members decide nothing;
   behind `&&` only a prelude that did not fail leaves it certain: `false && pgrep` returns false's 1. */
const ran = (parts, index, body) => {
  let at = index;
  while (at >= 2 && ["|", "&&"].includes(parts[at - 1])) {
    const before = parts[at - 2].trim();
    if (parts[at - 1] === "|" && NEGATED.test(before)) return false;
    if (parts[at - 1] === "&&" && (!PRELUDE.test(before) || PRELUDE_FAILED.test(body))) return false;
    at -= 2;
  }
  return true;
};

const splitOf = (shell) => {
  const parts = String(shell).split(SEPARATOR);
  while (parts.length > 2 && !parts.at(-1).trim()) parts.splice(-2, 2);
  return parts;
};

/** The commands whose status is certainly the line's, for the one failed call's body: those
 *  `returning` names, not negated and certain to have run. A pgrep earlier in a line whose last
 *  command failed is not among them, since both would exit 1 and nothing here says which did. */
export const returningOf = (shell, body = "") => {
  const parts = splitOf(shell);
  return returning(parts)
    .filter((index) => !NEGATED.test(parts[index]) && !opensAFile(parts[index]) && ran(parts, index, body))
    .map((index) => parts[index]);
};

/* The pattern where the command itself starts, past a subshell's opening: matched anywhere later, a
   `pgrep` inside `test -z "$(pgrep x)"` would answer for the `test` around it. */
const leads = (match, command) => match.exec(command.replace(/^[\s({]+/u, ""))?.index === 0;

/** The answer row a failed call is counted under, or null where its exit was no command's answer. */
export const answerOf = (call, table = BUILT_IN_TABLE) => {
  if (call.name !== "Bash" || !call.error) return null;
  const code = exitCodeOf(call.body);
  if (code === null) return null;
  const commands = returningOf(call.shell, call.body);
  const entry = table.find((one) => one.code === code && commands.some((command) => leads(one.match, command)));
  return entry ? `${entry.name}, exit ${code}` : null;
};

/** The generation of the key an error row is filed under. A reading carrying none keyed its errors
 *  on the class alone, so the same words there name another population than these. */
export const ERROR_ROWS = 2;

/** How much of the first line a key keeps: enough to tell two failures of one class apart. */
export const KEY_CHARS = 80;

const TAGS = /<\/?tool_use_error>/gu;

/* What changes from one day to the next in a line that says the same thing: where, which commit,
   which issue, and every count or time. The key is what a reading follows a failure by across days. */
export const steady = (line) => line
  .replaceAll(/(?<![\w.])(?:~|\.{1,2})?\/[^\s'"`:,;)]+/gu, "<path>")
  .replaceAll(/ISS-\d+/gu, "ISS-nn")
  .replaceAll(/\b(?=[0-9a-f]*[a-f])(?=[0-9a-f]*\d)[0-9a-f]{7,40}\b/gu, "<sha>")
  .replaceAll(/\d+/gu, "N")
  .replaceAll(/\s+/gu, " ")
  .trim()
  .slice(0, KEY_CHARS);

const firstLineOf = (body) => {
  const lines = String(body).split("\n");
  const said = exitCodeOf(body) === null ? lines : lines.slice(1);
  return said.map((one) => one.replace(TAGS, "").trim()).find(Boolean) ?? "";
};

/** The row an error is filed under: the call's class, its exit code where the host wrote one, and the
 *  first line it printed held steady. The host joins the two streams, so that line is the first one
 *  printed and not always the error's own. */
export const errorKeyOf = (call) => {
  const code = call.name === "Bash" ? exitCodeOf(call.body) : null;
  const head = code === null ? call.class : `${call.class} · exit ${code}`;
  const said = steady(firstLineOf(call.body));
  return said ? `${head}: ${said}` : head;
};
