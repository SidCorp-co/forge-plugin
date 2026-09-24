/* What a detached landing keeps about itself, read by the two things that need it: the launcher,
   which refuses a second landing of a tree whose landing still runs, and the wait, which answers how
   that landing ended. One reading of the record, so the two never disagree about whether a landing
   is still going. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { gitOut } from "../../checkout.mjs";
import { PROC, startedAt } from "../../gates/machine.mjs";

/* The record is one per tree, in its own git directory: a later call finds it without knowing the
   caller's TMPDIR, and a second landing of a tree whose landing still runs is refused off it. */
export const gitDir = (tree) => gitOut(["rev-parse", "--absolute-git-dir"], tree);

export const recordIn = (dir) => join(dir, "forge-landing.json");

/** Held from a launcher's check to the record naming its landing, so a record read inside that
 *  moment is still the landing before it. */
export const reservationIn = (dir) => join(dir, "forge-landing.starting");

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

/** The one call that waits on a tree's landing, absolute on both sides: a harness resets a shell's
 *  directory between calls, so a wait typed in a later turn stands wherever that turn does. */
export const waitCommand = (script, tree) => `node ${script} wait --tree ${tree}`;
