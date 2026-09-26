/* The configuration home a run keeps its own state under, read off the tree it stands in. A hook fires
   in the session's environment and a run's XDG_CONFIG_HOME reaches only the run's own shell, so a hook
   reading its own variable judged a delegated run by the developer's record while every consult the run
   took went to its own, and the only consult that cleared a door was one written into the developer's
   log (ISS-2651). */
import { join } from "node:path";

import { scratchAt } from "./run-id.mjs";

/** The home inside a run's scratch: what a brief and a workspace start print as the run's
 *  XDG_CONFIG_HOME, and what that tree's hooks read, one derivation for both. */
export const homeIn = (scratch) => join(scratch, "home");

/** The home a run standing at `path` was handed, off its tree's scratch record; null without one. */
export const runHomeAt = (path) => {
  const scratch = path ? scratchAt(path) : null;
  return scratch ? homeIn(scratch) : null;
};

/** `read` run with the variable pointed there for the length of the call. Every home-rooted path is
 *  read where it is used, so the variable reaches them all; it is put back after, a thrown decision
 *  included, since one process runs every gate of an event. */
export const inRunHome = (path, read) => {
  const home = runHomeAt(path);
  if (!home) return read();
  const was = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = home;
  try {
    return read();
  } finally {
    if (was === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = was;
  }
};
