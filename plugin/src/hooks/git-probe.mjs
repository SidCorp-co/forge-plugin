/* Git as a gate asks it, and what a gate may give one child it waits for. Apart from the gates because three of them had a runner of their own and each read a failure differently — nothing at all is no answer, git having not run or been killed, and a `status` is git's own, which is the difference between a tree at stake and a directory that is not a repository. `probeMs` clamps to enough to answer, never the whole of what is left, and never nothing, a probe killed at zero saying the same as one that failed; it takes what remains rather than reading it, so the clock stays the harness's, this side may not reach up for it, and each caller still spells `remaining()` where it spends it. */
import { spawnSync } from "node:child_process";

export const gitProbe = (argv, { cwd = undefined, ms } = {}) => {
  try {
    const run = spawnSync("git", argv, { cwd, encoding: "utf8", timeout: ms });
    return run.error ? null : { status: run.status, out: String(run.stdout ?? "") };
  } catch {
    return null;
  }
};

export const probeMs = (left) => Math.max(500, Math.min(5_000, left - 1_000));
