/* What the record proves about the run behind a lease, which the clock never could: the recorded
   process id absent in the place that id was issued, and nothing the project calls a run's own work
   standing in the tree that lease was claimed in. docs/cli/the-dead-holder.md carries every why. */
import { readFileSync, readdirSync, readlinkSync, statSync } from "node:fs";

import { gitEntryAt } from "../../git/checkout-at.mjs";
import { projectWorkPattern } from "../../resolve/settings.mjs";
import { runIdAt } from "../../resolve/session/run-id.mjs";

const BOOT = "/proc/sys/kernel/random/boot_id";
const NAMESPACE = "/proc/self/ns/pid";
const TABLE = "/proc";
const COMMAND = 120;

export const UNKNOWN = "unknown";

export const agentOf = () => process.env.AI_AGENT || UNKNOWN;

/** The host process every agent of a dispatched wave shares, and never the process doing the work. */
export const pidOf = () => process.env.CLAUDE_PID || UNKNOWN;

const read = (how, path) => {
  try {
    return how(path, "utf8").trim();
  } catch {
    return "";
  }
};

const answered = (how) => {
  try {
    return how();
  } catch {
    return null;
  }
};

let here = null;

export const placeOf = () => {
  if (here === null) {
    const boot = read(readFileSync, BOOT);
    const table = read(readlinkSync, NAMESPACE);
    here = boot && table ? `${boot} ${table}` : "";
  }
  return here;
};

let standing = null;

export const treeHere = () => {
  if (standing === null) standing = gitEntryAt(process.cwd())?.tree ?? "";
  return standing;
};

const absent = (pid) => {
  const id = Number(pid);
  if (!Number.isInteger(id) || id < 1) return false;
  try {
    process.kill(id, 0);
    return false;
  } catch (error) {
    return error.code === "ESRCH";
  }
};

const parentOf = (pid) =>
  Number(/^PPid:\s*(\d+)$/mu.exec(answered(() => readFileSync(`${TABLE}/${pid}/status`, "utf8")) ?? "")?.[1]) || 0;

const chainOf = (pid) => {
  const seen = [];
  for (let at = pid; at > 1 && !seen.includes(at); at = parentOf(at)) seen.push(at);
  return seen;
};

/* The bound on this call's own work, never a qualification of what is found: reparented work has no host. */
const anothersCall = (pid, below) => !chainOf(pid).some((one) => below.has(one));

const lineOf = (pid) => {
  const line = answered(() => readFileSync(`${TABLE}/${pid}/cmdline`, "utf8"));
  return (line ?? "").replaceAll("\0", " ").trim()
    || (answered(() => readFileSync(`${TABLE}/${pid}/comm`, "utf8")) ?? "").trim();
};

/* One stat of the entry per process and no more: both readings below walk every pid on the
   machine inside a hook's own clock, and each wants the same moment the row carries. */
const bornAt = (pid) => Date.parse(answered(() => statSync(`${TABLE}/${pid}`).ctime.toISOString()) ?? "");

const rowOf = (pid, said, born = bornAt(pid)) => ({
  pid,
  command: said.length > COMMAND ? `${said.slice(0, COMMAND)}…` : said,
  since: Number.isFinite(born) ? new Date(born).toISOString() : null,
});

/* Nothing declared reads as nothing found: every process instead refuses a run's own gate (ISS-1872). */
const declared = (tree) => {
  const said = projectWorkPattern(tree).value;
  return said ? new RegExp(said, "u") : null;
};

const within = (cwd, tree) => cwd === tree || cwd.startsWith(`${tree}/`);

/** Which tree a lease's work stands in: the one this call stands in where that tree mints the holder,
 *  else the checkout `treeHere` recorded on the lease — a name and not an identity across mount
 *  namespaces, so it counts only where the id beside its git directory is still this holder. */
export const treeOf = (lease, at = process.cwd()) => {
  const holder = lease?.holder;
  if (!holder) return null;
  if (runIdAt(at) === holder) return gitEntryAt(at)?.tree ?? null;
  const said = typeof lease.tree === "string" ? lease.tree : "";
  if (!said || !lease.place || lease.place !== placeOf() || runIdAt(said) !== holder) return null;
  return gitEntryAt(said)?.tree ?? null;
};

/** The declared work standing in that tree, none where the tree is idle or the project declares
 *  nothing, and `null` where the reading could not be made — no tree of the lease's own to read, or
 *  no host this call can place its own work against. An empty list says a tree was read. */
export const workUnder = (lease, at = process.cwd(), said = pidOf()) => {
  const tree = treeOf(lease, at);
  if (!tree) return null;
  const host = Number(said);
  const mine = chainOf(process.pid);
  const seat = Number.isInteger(host) && host >= 2 ? mine.indexOf(host) : -1;
  if (seat < 0) return null;
  const work = declared(tree);
  if (!work) return [];
  const table = answered(() => readdirSync(TABLE));
  /* A process table that would not enumerate is a reading that did not run, not an idle tree. */
  if (!table) return null;
  const ours = new Set(mine);
  const below = new Set(mine.slice(0, seat));
  const found = [];
  for (const name of table) {
    const pid = Number(name);
    if (!Number.isInteger(pid) || pid < 2 || ours.has(pid)) continue;
    const cwd = answered(() => readlinkSync(`${TABLE}/${pid}/cwd`));
    if (!cwd || !within(cwd, tree)) continue;
    const line = lineOf(pid);
    if (!line || !work.test(line) || !anothersCall(pid, below)) continue;
    found.push(rowOf(pid, line));
  }
  return found.sort((one, two) => String(one.since).localeCompare(String(two.since)));
};

/* The one walk both readings below take: every process this call is not itself part of, kept by
   whatever `keep` makes of it, narrowed to what began at or after `since` where one is given, and
   `null` where the table would not enumerate — which is not a turn that left nothing running. */
const walking = (mine, keep) => {
  const table = answered(() => readdirSync(TABLE));
  if (!table) return null;
  const found = [];
  for (const name of table) {
    const pid = Number(name);
    if (!Number.isInteger(pid) || pid < 2 || mine.has(pid)) continue;
    const row = keep(pid, bornAt(pid));
    if (row) found.push(row);
  }
  return found.sort((one, two) => String(one.since).localeCompare(String(two.since)));
};

/** Every process standing in `tree` that this call is not itself part of. Unlike `workUnder`,
 *  nothing here is filtered by what a project declares its own work to be: a process standing in a
 *  worktree is that run's whatever it is running, so it is read off `cwd` alone and never by
 *  guessing at a command line (ISS-1358). Outside a worktree `cwd` says nothing, which is
 *  `startedHere`'s half. */
export const standingIn = (tree, since = 0, mine = new Set(chainOf(process.pid))) =>
  walking(mine, (pid, born) => {
    if (Number.isFinite(since) && since > 0 && !(born >= since)) return null;
    const cwd = answered(() => readlinkSync(`${TABLE}/${pid}/cwd`));
    return cwd && within(cwd, tree) ? rowOf(pid, lineOf(pid), born) : null;
  });

/* Under this a signature is a word rather than a job — `ls` sits inside `tools` — and matching on
   one would put another run's process in a refusal, which is worse than missing this turn's. */
const IDENTIFYING = 16;

/** A command line as the process table can be matched on, or nothing where it is too short to
 *  identify one. Two things change on the way and no others: a harness re-quotes what it was
 *  handed before running it, and the shell's own punctuation stands where a blank could have.
 *  So quoting goes, and what separates one command from the next becomes a blank. Punctuation
 *  inside an argument is part of that argument and stays, or `/tmp/job:other` would be read as
 *  `/tmp/job`; and a blank at each end for the same reason, so a containment lands on a whole
 *  word and not on the start of a longer one. What this does not tell apart is a separator quoted
 *  into an argument — a file actually named `job;other` reads as two words — and the alternative
 *  is a shell parser inside a gate that runs at every stop, which costs more than the case. */
const QUOTING = /['"`\\]/gu;
const BREAKS = /[\s;|&()<>]+/gu;

const signed = (said) => {
  const words = String(said ?? "").replaceAll(QUOTING, "").replace(BREAKS, " ").trim();
  return words.length < IDENTIFYING ? "" : ` ${words} `;
};

/* Either way round, because a wrapper's line holds the whole command and a leaf left by a shell
   that exited holds a part of it — `node tools/gates.mjs --wait 30` out of the line that put it in
   the background. The second direction costs what the first does not: a command that carries
   another's whole line as an argument, `pgrep -f` or an `echo` of it, matches whatever is running
   that line. ISS-2062 holds the narrowing; until it lands the predicate is what this says and the
   criteria and the how text say the same. */
const sameJob = (one, two) => one.includes(two) || two.includes(one);

/** Every process still standing that this turn started, matched by the calls the turn itself made
 *  rather than by where the process stands: a wait needs no `cd`, so it keeps the session's working
 *  directory, which for a delegated run is the checkout its worktree was cut from and not the
 *  worktree; and two runs sharing one host share that directory, their ancestry and their
 *  environment, so only the turn's own record tells one's process from the other's (ISS-2051).
 *
 *  Each call is `{ said, from, to }` — the command, and the window the turn's own records put
 *  around the moment it made that call. A command and a process line are the same job where either
 *  signature holds the other, the shell a harness wraps a command in carrying the whole of it and a
 *  leaf that shell left carrying part; the window is what then tells two runs that ran the *same*
 *  command apart, each having begun its own inside its own call. Two runs that began the identical
 *  command inside the one window are the residue no process table can split, and this names both
 *  rather than guessing between them.
 *
 *  `null` where the process table could not be enumerated, which is not a turn that left nothing
 *  running. */
export const startedHere = (calls, mine = new Set(chainOf(process.pid))) => {
  const wanted = [];
  for (const one of calls ?? []) {
    const sign = signed(one?.said);
    if (!sign) continue;
    wanted.push({
      said: one.said,
      sign,
      from: Number.isFinite(one?.from) ? one.from : 0,
      to: Number.isFinite(one?.to) ? one.to : Infinity,
    });
  }
  if (!wanted.length) return [];
  return walking(mine, (pid, born) => {
    if (!Number.isFinite(born)) return null;
    const own = signed(lineOf(pid));
    if (!own) return null;
    const hit = wanted.find((one) => born >= one.from && born <= one.to && sameJob(own, one.sign));
    /* The command the turn typed and never the process's own line: where the process is the shell
       a harness wrapped that command in, its line is the harness's preamble, and where it is the
       leaf that shell left, its line is a fragment. Both are answered by what was asked for. */
    return hit ? rowOf(pid, hit.said, born) : null;
  });
};

/* Both halves or neither: the recorded id is the host a wave shares and a host exits while the
   release it started keeps running, so its absence proves the run gone only where that run's tree
   holds none of its declared work. A reading that could not be made is not one that found nothing,
   and leaves the lease to its duration (ISS-1903). */
export const holderGone = (lease, at = placeOf(), { asserted = false } = {}) => {
  if (!lease?.place || lease.place !== at || !absent(lease.pid)) return false;
  if (asserted) return true;
  const work = workUnder(lease);
  return work !== null && work.length === 0;
};

export const holderGoneSaid = (lease, at = process.cwd(), { asserted = false } = {}) =>
  `Process id ${lease.pid}, which that lease records as the host its holder ran under, is not `
  + `running where the lease was taken — the same kernel boot and the same process table this call `
  + `stands in — and ${asserted
    ? "you have established that no run is under this lease"
    : `nothing this project calls a run's own work is standing in ${treeOf(lease, at) ?? "that lease's own tree"}`}`
  + `, so the run behind it is gone.`;
