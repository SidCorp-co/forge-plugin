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

/* The host is where one call of an agent ends and another's begins, so anything sharing an ancestor
   with this call below it is this call's own however long it stands — the whole of what can be
   excluded. It bounds that and does not qualify what is found: work whose own intermediate has
   exited keeps its directory and is reparented off every chain the host is in (ISS-1872 F1). */
const anothersCall = (pid, below) => !chainOf(pid).some((one) => below.has(one));

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
  /* No boundary, and a reading that cannot exclude its own work refuses every claim from a tree. */
  if (seat < 0) return [];
  const ours = new Set(mine);
  const below = new Set(mine.slice(0, seat));
  const found = [];
  for (const name of answered(() => readdirSync(TABLE)) ?? []) {
    const pid = Number(name);
    if (!Number.isInteger(pid) || pid < 2 || ours.has(pid)) continue;
    const cwd = answered(() => readlinkSync(`${TABLE}/${pid}/cwd`));
    if (!cwd || !within(cwd, tree) || !anothersCall(pid, below)) continue;
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
    + `it: every call made from here resolves ${holder}. ${rows.length} process(es) standing in `
    + `${treeMinting(holder, at)} are neither this call, nor above it, nor anything it started:`,
  ...rowLines(rows),
  `Nothing here can tell whose they are, so whether a run is working under that lease is yours to `
    + `establish: \`ps -o pid,lstart,args -p ${rows.map((one) => one.pid).join(",")}\` reads them `
    + `again, and whatever each one is running says which run it belongs to.`].join("\n");

export const workingRefusal = (ref, lease, rows, at = process.cwd()) =>
  `${ref} is claimed and this claim would be read as that lease renewing: ${describe(lease)}. `
  + `${workingHereSaid(rows, lease.holder, at)}\nWhere that work is this call's own, or you have `
  + `established that no run is under this lease, say so:\n  forge claim ${ref} ${STOPPED}`;
