/* What a detached landing keeps about itself, read by the three things that need it: the launcher,
   which refuses a second landing of a tree whose landing still runs, the landing waiting behind that
   one, and the wait, which answers how a landing ended. One reading of the record, so none of them
   disagrees with another about whether a landing is still going. */
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { gitOut, read } from "../../checkout.mjs";
import { PROC, startedAt } from "../../gates/machine.mjs";

/* The record is one per tree, in its own git directory: a later call finds it without knowing the
   caller's TMPDIR, and a second landing of a tree whose landing still runs is refused off it. */
export const gitDir = (tree) => gitOut(["rev-parse", "--absolute-git-dir"], tree);

export const recordIn = (dir) => join(dir, "forge-landing.json");

/** Held from a launcher's check to the record naming its landing, so a record read inside that
 *  moment is still the landing before it. */
export const reservationIn = (dir) => join(dir, "forge-landing.starting");

/** Names the one landing waiting behind the tree's running landing, which writes nothing of the
 *  record until the landing ahead has recorded its end there. */
export const waitingIn = (dir) => join(dir, "forge-landing.waiting");

/** Renamed into place, so a wait woken by the write never reads a record half-written and takes an
 *  empty file for a tree that holds none. */
export const recorded = (path, body) => {
  const next = `${path}.${process.pid}`;
  writeFileSync(next, `${JSON.stringify(body, null, 2)}\n`);
  renameSync(next, path);
};

/** Created exclusively and held only from a check to the record it guards, so two processes of one
 *  tree in the same instant cannot both pass the check. */
export const reserved = (path) => {
  try {
    writeFileSync(path, `${process.pid}\n`, { flag: "wx" });
    return true;
  } catch (error) {
    if (error.code === "EEXIST") return false;
    throw error;
  }
};

/** The kernel's ticks since boot at which a process began, so a pid reused by a later process is
 *  told from the one a record names; null off a machine with no /proc. */
export const startOf = (pid) => {
  try {
    return startedAt(readFileSync(join(PROC, String(pid), "stat"), "utf8"));
  } catch {
    return null;
  }
};

/** The pid alone is not the landing: the kernel reuses them. A record that carries the process's
 *  start is matched on both, and one that could not read it is matched on the pid alone, which
 *  refuses a landing rather than letting it run beside a live one. */
export const stillLanding = (was) => {
  if (!Number.isInteger(was?.pid) || was.pid < 2 || was.ended) return false;
  try {
    process.kill(was.pid, 0);
  } catch (error) {
    if (error.code !== "EPERM") return false;
  }
  return was.start === null || was.start === undefined || startOf(was.pid) === was.start;
};

/** The landing waiting behind this tree's running one, or null where none is: a waiter that died
 *  left its file naming a pid that is no longer it, and that file holds nothing back. */
export const liveWaiter = (dir) => {
  const was = read(waitingIn(dir));
  return stillLanding(was) ? was : null;
};

/** The one call that waits on a tree's landing, absolute on both sides: a harness resets a shell's
 *  directory between calls, so a wait typed in a later turn stands wherever that turn does. */
export const waitCommand = (script, tree) => `node ${script} wait --tree ${tree}`;
