/* Which gates of this checkout are running, and whether this one may join them. Counted off the process table rather than
   off files a gate leaves behind: a file has to be reclaimed when its holder is killed and reclaiming a shared name is a race
   two gates can both win, where a process is its own record and a killed gate has none. A wait of the same runner is not one
   of them: counted, it would decline a gate that could have run and look like a run to a second wait (`gates.mjs -h`). Two
   gates of one tree are refused outright rather than counted, since they share one record and the later judges nothing.
   A landing's gate is told apart by what its environment carries, and stands ahead of every builder's gate for the next
   place: what lands is ahead of what is being readied (ISS-2461). */
import { readFileSync, readdirSync, readlinkSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

import { gitOut, lines } from "../checkout.mjs";
import { parallelRuns } from "../../plugin/src/resolve/settings.mjs";
import { WAIT_COMMAND } from "../../plugin/src/hooks/wait-idiom.mjs";

export const PROC = "/proc";
const RUNNER = join("tools", "gates.mjs");
const WORKTREE = "worktree ";
// Node itself and not everything starting with the four letters, which is `nodemon` too; and the options after which there is no script to find.
const NODE = /^node(?:js)?[\d.]*$/u;
const NO_ENTRY = new Set(["-c", "--check", "-e", "--eval", "-p", "--print"]);

export const DECLINED = 75;

/** The issue keys a landing's gate carries in its environment, and the one thing that makes a gate a landing's. */
export const LANDING_ENV = "FORGE_LANDING";

export const WAIT = "--wait";

export const SLOT = "slot";

// A command and not a bare key name: `runs` is written by a verb now that the project's configuration is
// this machine's own record of it, and the route a caller is given is the one they can type (ISS-1403).
export const RAISE = "`forge doctor --set runs=<n>`";

// Field 22 of the status line, counted from after its last `)`, because the command name holds parentheses and spaces and nothing before it can be split on.
export const startedAt = (text) => {
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

/* `environ` holds what the process was started with, the one part of it another process can read. Unreadable, it
   counts as a builder's, which every gate was before ISS-2461. */
const landingIn = (at) => {
  try {
    const found = readFileSync(at("environ"), "utf8").split("\0").find((one) => one.startsWith(`${LANDING_ENV}=`));
    const keys = found?.slice(LANDING_ENV.length + 1).trim();
    return keys ? keys : null;
  } catch {
    return null;
  }
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
  if (entry === null || basename(entry) !== basename(RUNNER) || argv.includes(WAIT)) return null;
  let start;
  let cwd;
  try {
    start = startedAt(readFileSync(at("stat"), "utf8"));
    cwd = readlinkSync(at("cwd"));
  } catch {
    return null;
  }
  const runner = resolve(cwd, entry);
  return start === null || !ours.has(runner)
    ? null
    : { pid, start, tree: dirname(dirname(runner)), landing: landingIn(at) };
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

/** What this gate may do: the gates before it, against the number this project declares — none declared declines nobody.
    A builder's gate has every landing's gate ahead of it as well, whenever that one started, and `took` is those of them
    the kernel started after it: the landing a builder admitted by start order alone would have taken the place from. A
    landing's gate counts only the gates started before it, so it waits while they fill the number and never adds a gate
    past it; a builder's gate started after a landing's that was admitted counted that landing already. */
export const placeFor = (ours, { proc = PROC, declared = parallelRuns(), pid = process.pid } = {}) => {
  if (declared.value === null) return { declared, ahead: [], took: [], declined: false };
  const running = gatesOn(ours, proc);
  if (running === null) return { declared, ahead: [], took: [], declined: false };
  const mine = running.findIndex((one) => one.pid === pid);
  const before = mine === -1 ? running : running.slice(0, mine);
  /* Off this gate's own entry in the table and not off `process.env`, which the gate clears before its steps inherit it. */
  const took = mine !== -1 && running[mine].landing === null
    ? running.slice(mine + 1).filter((one) => one.landing !== null)
    : [];
  const ahead = [...before, ...took];
  return { declared, ahead, took, declined: ahead.length >= declared.value };
};

/** The earliest gate of this same tree the kernel started before this one, or null: the later of two gates over one tree is the one
    refused, so the first is never turned away for a second it could not have seen coming. Counted whatever number is declared. */
export const treeHeldBy = (root, ours, { proc = PROC, pid = process.pid } = {}) => {
  const running = gatesOn(ours, proc);
  if (running === null) return null;
  const mine = running.findIndex((one) => one.pid === pid);
  const ahead = mine === -1 ? running : running.slice(0, mine);
  return ahead.find((one) => one.tree === root && one.pid !== pid) ?? null;
};

/** The file a process's standard output is written to, or null where it reaches none: a pipe, a socket, a terminal or `/dev/null`.
    Judged by what the descriptor opens and never by the name, a regular file under `/dev/shm` being a log like any other. */
export const outputOf = (pid, proc = PROC) => {
  const fd = join(proc, String(pid), "fd", "1");
  try {
    return statSync(fd).isFile() ? readlinkSync(fd) : null;
  } catch {
    return null;
  }
};

/** The refusal of a second gate over one tree, its route the one-call wait on the gate already running. */
export const heldSaid = (root, holder, { output, seconds }) => [
  `This gate refused to start and judged nothing: a gate of this same tree is already running, and two gates over one tree`
    + ` read and write one record at once, so the later answers about neither.`,
  `  pid ${holder.pid}  gating ${holder.tree}  ${output === null
    ? "its output reaches no file"
    : `writing to ${output}`}`,
  `Wait for it: ${WAIT_COMMAND.replace("<seconds>", String(seconds)).replace("<pid>", String(holder.pid))}`,
  `Then read its verdict: node tools/gates.mjs ${WAIT}`,
  `No step ran and nothing was recorded, so nothing here judges ${root}.`,
].join("\n");
