/* Whether a shell child that left no record opened a file of this repository, read off what it was
   asked to run; unreadable answers false. What the four gates are: `node tools/gates.mjs -h`. */

// Handed `-c`, these read no startup file, where a bash by its own name reads `BASH_ENV`.
const SHELL_PROGRAM = new Set(["sh", "dash"]);

const based = (one) => one.replace(/^.*\//u, "");

// What stands for itself in a shell word; anything else means more, and refuses the whole line.
const BARE = /[\w.,:@%+/-]/u;

const worded = (line) => {
  const words = [];
  let word = null;
  for (let at = 0; at < line.length; at += 1) {
    const one = line[at];
    if (one === " " || one === "\t") {
      if (word !== null) words.push(word);
      word = null;
      continue;
    }
    if (word === null) word = "";
    if (one === "'") {
      const end = line.indexOf("'", at + 1);
      if (end === -1) return null;
      word += line.slice(at + 1, end);
      at = end;
    } else if (one === "\\") {
      const next = line[at + 1];
      if (next === undefined || next === "\n") return null;
      word += next;
      at += 1;
    } else if (BARE.test(one)) word += one;
    else return null;
  }
  if (word !== null) words.push(word);
  return words;
};

/* A builtin of those shells, so no `PATH` entry chooses what runs — which is why `which` is absent.
   The writers take no option, bash's `printf -v` evaluating a subscript; the lookups take a name
   and never a path, `command` only behind a first `-v`. */
const NAMED_ONLY = (operands) => operands.every((one) => !one.includes("/"));
const WRITES_THEM = (operands) => operands.every((one) => !one.startsWith("-"));
const ASKED_WHERE = (one) => one.length > 1 && (one[0] === "-v" || one[0] === "-V")
  && one.slice(1).every((each) => !each.startsWith("-")) && NAMED_ONLY(one.slice(1));

const OPENS_NOTHING = new Map([
  ["printf", WRITES_THEM], ["echo", WRITES_THEM],
  [":", WRITES_THEM], ["true", WRITES_THEM], ["false", WRITES_THEM],
  ["type", NAMED_ONLY], ["hash", NAMED_ONLY], ["command", ASKED_WHERE],
]);

const lineOf = (one) => {
  if (one.plain !== true) return null;
  if (typeof one.shell === "string") return SHELL_PROGRAM.has(based(one.shell)) ? String(one.file) : null;
  const args = (one.args ?? []).map(String);
  return args.length === 2 && args[0] === "-c" && SHELL_PROGRAM.has(based(String(one.file)))
    ? args[1] : null;
};

// What the child ran under could put something else behind a name below, so it is read first.
export const opensNothing = (one) => {
  if (one.pathIn !== false || one.funcIn !== false || one.mine !== false) return false;
  const line = lineOf(one);
  if (line === null) return false;
  const words = worded(line);
  if (words === null || words.length === 0) return false;
  const how = OPENS_NOTHING.get(words[0]);
  return how ? how(words.slice(1)) : false;
};
