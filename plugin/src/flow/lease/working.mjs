/* The third way a holder answers, where the field alone cannot: an id a worktree mints belongs to
   that tree, so two callers standing in one resolve it alike and a match places a run there without
   identifying whoever is reading it. Which processes count, why no ambient fact tells two callers
   apart, and what the caller is asked instead: docs/cli/the-dead-holder.md (ISS-1872). */
import { readFileSync, readdirSync, readlinkSync, statSync } from "node:fs";

import { gitEntryAt } from "../../git/checkout-at.mjs";
import { RUN_ID, besideGit, runIdAt } from "../../resolve/session/run-id.mjs";
import { STOPPED, describe, pidOf } from "../lease.mjs";

const TABLE = "/proc";
const NAMED = 3;
const COMMAND = 120;

const answered = (read) => {
  try {
    return read();
  } catch {
    return null;
  }
};

const parentOf = (pid) =>
  Number(/^PPid:\s*(\d+)$/mu.exec(answered(() => readFileSync(`${TABLE}/${pid}/status`, "utf8")) ?? "")?.[1]) || 0;

const chainOf = (pid) => {
  const seen = [];
  for (let at = pid; at > 1 && !seen.includes(at); at = parentOf(at)) seen.push(at);
  return seen;
};

/* The host process is where one call of an agent ends and another's begins: every agent of a wave
   descends from it and each call it makes descends from a shell of its own, so anything sharing an
   ancestor with this call below the host was started by the command this call was started by and is
   this call's own however long it stands. That is the whole of what can be excluded — above the host
   two callers are indistinguishable, which is why what is left is printed for the caller to rule on. */
const anothersCall = (pid, below, host) => {
  const chain = chainOf(pid);
  return chain.indexOf(host) > 0 && !chain.some((one) => below.has(one));
};

const commandOf = (pid) => {
  const line = answered(() => readFileSync(`${TABLE}/${pid}/cmdline`, "utf8"));
  const said = (line ?? "").replaceAll("\0", " ").trim()
    || (answered(() => readFileSync(`${TABLE}/${pid}/comm`, "utf8")) ?? "").trim();
  return said.length > COMMAND ? `${said.slice(0, COMMAND)}…` : said;
};

const rowOf = (pid) => ({
  pid,
  command: commandOf(pid),
  since: answered(() => statSync(`${TABLE}/${pid}`).ctime.toISOString()) ?? null,
});

const within = (cwd, tree) => cwd === tree || cwd.startsWith(`${tree}/`);

/** Nothing where no tree here mints that holder, which is a run this reading may say nothing about. */
export const treeMinting = (holder, at = process.cwd()) => {
  if (!holder || runIdAt(at) !== holder) return null;
  return gitEntryAt(at)?.tree ?? null;
};

export const workingHere = (holder, at = process.cwd(), said = pidOf()) => {
  const tree = treeMinting(holder, at);
  const host = Number(said);
  if (!tree || !Number.isInteger(host) || host < 2) return [];
  const mine = chainOf(process.pid);
  const seat = mine.indexOf(host);
  const below = new Set(seat < 0 ? mine : mine.slice(0, seat));
  const found = [];
  for (const name of answered(() => readdirSync(TABLE)) ?? []) {
    const pid = Number(name);
    if (!Number.isInteger(pid) || pid < 2 || below.has(pid)) continue;
    const cwd = answered(() => readlinkSync(`${TABLE}/${pid}/cwd`));
    if (!cwd || !within(cwd, tree) || !anothersCall(pid, below, host)) continue;
    found.push(rowOf(pid));
  }
  return found.sort((one, two) => String(one.since).localeCompare(String(two.since)));
};

const rowLines = (rows) => [
  ...rows.slice(0, NAMED).map((one) => `  pid ${one.pid}  ${one.command}`
    + `${one.since ? `, running since ${one.since.slice(11, 16)}` : ""}`),
  ...(rows.length > NAMED ? [`  and ${rows.length - NAMED} more`] : []),
];

export const workingHereSaid = (rows, holder, at = process.cwd()) =>
  [`That holder is the id ${besideGit(at, RUN_ID)} mints, so it names this tree and not one run in `
    + `it: every call made from here resolves ${holder}. ${rows.length} process(es) started under `
    + `another call of this host are standing in ${treeMinting(holder, at)}:`,
  ...rowLines(rows),
  `Nothing here can tell whose they are, so whether a run is working under that lease is yours to `
    + `establish: \`ps -o pid,lstart,args -p ${rows.map((one) => one.pid).join(",")}\` reads them `
    + `again, and whatever each one is running says which run it belongs to.`].join("\n");

export const workingRefusal = (ref, lease, rows, at = process.cwd()) =>
  `${ref} is claimed and this claim would be read as that lease renewing: ${describe(lease)}. `
  + `${workingHereSaid(rows, lease.holder, at)}\nWhere that work is this call's own, or you have `
  + `established that no run is under this lease, say so:\n  forge claim ${ref} ${STOPPED}`;
