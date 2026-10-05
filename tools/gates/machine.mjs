/* Which gates are running over one tree, read off the process table rather than off files a gate leaves behind: a file
   has to be reclaimed when its holder is killed, where a process is its own record and a killed gate has none. Nothing
   here admits or refuses a gate — only the landing runs the whole gate, and the landing lock already serializes those. */
import { readFileSync, readdirSync, readlinkSync, realpathSync } from "node:fs";
import { basename, join, resolve } from "node:path";

export const PROC = "/proc";
const RUNNER = join("tools", "gates.mjs");
// Node itself and not everything starting with the four letters, which is `nodemon` too; and the options after which there is no script to find.
const NODE = /^node(?:js)?[\d.]*$/u;
const NO_ENTRY = new Set(["-c", "--check", "-e", "--eval", "-p", "--print"]);

// Field 22 of the status line, counted from after its last `)`, because the command name holds parentheses and spaces and nothing before it can be split on.
export const startedAt = (text) => {
  const after = text.slice(text.lastIndexOf(")") + 2).split(" ");
  const ticks = Number(after[19]);
  return Number.isFinite(ticks) ? ticks : null;
};

// The script node is executing, and never an argument beside it: `node watcher.mjs tools/gates.mjs` runs no gate. An option taking a separate value can hide the entry, which leaves a gate unseen rather than a stranger seen.
const entryOf = (argv) => {
  if (!NODE.test(basename(argv[0] ?? ""))) return null;
  for (const one of argv.slice(1)) {
    if (NO_ENTRY.has(one)) return null;
    if (!one.startsWith("-")) return one;
  }
  return null;
};

const runnerOf = (proc, pid) => {
  const at = (name) => join(proc, String(pid), name);
  try {
    const entry = entryOf(readFileSync(at("cmdline"), "utf8").split("\0").filter(Boolean));
    return entry === null || basename(entry) !== basename(RUNNER) ? null : resolve(readlinkSync(at("cwd")), entry);
  } catch {
    return null;
  }
};

/* The kernel reports a process's directory with every link resolved, so the tree is compared the same way. */
const realOf = (tree) => {
  try {
    return realpathSync(tree);
  } catch {
    return resolve(tree);
  }
};

/** The gates running `tree`'s own runner, this process aside; none on a machine whose table cannot be read, which is
    a machine this sees nothing on. */
export const gatesOf = (tree, proc = PROC) => {
  let names;
  try {
    names = readdirSync(proc);
  } catch {
    return [];
  }
  const runner = join(realOf(tree), RUNNER);
  return names.map(Number)
    .filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid && runnerOf(proc, pid) === runner)
    .map((pid) => ({ pid, tree }));
};
