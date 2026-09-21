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

const rowOf = (pid, said) => ({
  pid,
  command: said.length > COMMAND ? `${said.slice(0, COMMAND)}…` : said,
  since: answered(() => statSync(`${TABLE}/${pid}`).ctime.toISOString()) ?? null,
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

/** Every process standing in `tree` that this call is not itself part of, `null` where the process
 *  table could not be enumerated. `since` (epoch ms) narrows to what began at or after that moment,
 *  so a process the turn did not start is not read as this turn's; left at its default every age
 *  answers. Unlike `workUnder`, nothing here is filtered by what a project declares its own work to
 *  be: a turn that stopped with something still running is read off `cwd` alone, never by guessing
 *  at a command line (ISS-1358). */
export const standingIn = (tree, since = 0, mine = new Set(chainOf(process.pid))) => {
  const table = answered(() => readdirSync(TABLE));
  if (!table) return null;
  const filtering = Number.isFinite(since) && since > 0;
  const found = [];
  for (const name of table) {
    const pid = Number(name);
    if (!Number.isInteger(pid) || pid < 2 || mine.has(pid)) continue;
    const cwd = answered(() => readlinkSync(`${TABLE}/${pid}/cwd`));
    if (!cwd || !within(cwd, tree)) continue;
    const row = rowOf(pid, lineOf(pid));
    const born = Date.parse(row.since ?? "");
    if (filtering && (!Number.isFinite(born) || born < since)) continue;
    found.push(row);
  }
  return found.sort((one, two) => String(one.since).localeCompare(String(two.since)));
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
