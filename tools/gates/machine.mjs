/* Which gates of this checkout are running, and whether this one may join them. Counted off the
   process table rather than off files a gate leaves behind: a file has to be reclaimed when its
   holder is killed and reclaiming a shared name is a race two gates can both win, where a process
   is its own record and a killed gate has none. Why gates and not load: `node tools/gates.mjs -h`. */
import { readFileSync, readdirSync, readlinkSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

import { gitOut, lines } from "../checkout.mjs";
import { parallelRuns } from "../../plugin/src/resolve/settings.mjs";

const PROC = "/proc";
const RUNNER = join("tools", "gates.mjs");
const WORKTREE = "worktree ";
// Node itself and not everything starting with the four letters, which is `nodemon` too; and the options after which there is no script to find.
const NODE = /^node(?:js)?[\d.]*$/u;
const NO_ENTRY = new Set(["-c", "--check", "-e", "--eval", "-p", "--print"]);

export const DECLINED = 75;

export const RAISE = "forge doctor --runs";

// Field 22 of the status line, counted from after its last `)`, because the command name holds parentheses and spaces and nothing before it can be split on.
const startedAt = (text) => {
  const after = text.slice(text.lastIndexOf(")") + 2).split(" ");
  const ticks = Number(after[19]);
  return Number.isFinite(ticks) ? ticks : null;
};

// The script node is executing, and never an argument beside it: `node watcher.mjs tools/gates.mjs` runs no gate, and a run declined for somebody else's argument costs a wave a round. An option taking a separate value can hide the entry, which leaves a gate uncounted rather than a stranger counted.
const entryOf = (argv) => {
  if (!NODE.test(basename(argv[0] ?? ""))) return null;
  for (const one of argv.slice(1)) {
    if (NO_ENTRY.has(one)) return null;
    if (!one.startsWith("-")) return one;
  }
  return null;
};

const oneProcess = (proc, pid, ours) => {
  const at = (name) => join(proc, String(pid), name);
  let argv;
  try {
    argv = readFileSync(at("cmdline"), "utf8").split("\0").filter(Boolean);
  } catch {
    return null;
  }
  const entry = entryOf(argv);
  if (entry === null || basename(entry) !== basename(RUNNER)) return null;
  let start;
  let cwd;
  try {
    start = startedAt(readFileSync(at("stat"), "utf8"));
    cwd = readlinkSync(at("cwd"));
  } catch {
    return null;
  }
  const runner = resolve(cwd, entry);
  return start === null || !ours.has(runner) ? null : { pid, start, tree: dirname(dirname(runner)) };
};

export const runnersOf = (root) => new Set(lines(gitOut(["worktree", "list", "--porcelain"], root))
  .filter((one) => one.startsWith(WORKTREE))
  .map((one) => join(resolve(one.slice(WORKTREE.length)), RUNNER)));

/** The gates of this checkout, the one the kernel started first at the front; `null` where the table cannot be read at all, which is a machine this counts nothing on. */
export const gatesOn = (ours, proc = PROC) => {
  let names;
  try {
    names = readdirSync(proc);
  } catch {
    return null;
  }
  const found = [];
  for (const name of names) {
    const pid = Number(name);
    const one = Number.isInteger(pid) && pid > 0 ? oneProcess(proc, pid, ours) : null;
    if (one) found.push(one);
  }
  return found.sort((one, other) => one.start - other.start || one.pid - other.pid);
};

/** What this gate may do: the gates started before it, and whether they have reached the number this
 *  machine declares. A machine that declares none declines nobody, as it did before the key. */
export const placeFor = (ours, { proc = PROC, declared = parallelRuns(), pid = process.pid } = {}) => {
  if (declared.value === null) return { declared, ahead: [], declined: false };
  const running = gatesOn(ours, proc);
  if (running === null) return { declared, ahead: [], declined: false };
  const mine = running.findIndex((one) => one.pid === pid);
  const ahead = mine === -1 ? running : running.slice(0, mine);
  return { declared, ahead, declined: ahead.length >= declared.value };
};
