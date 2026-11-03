/* The remote a branch tracks, never an assumed `origin`: a project that pushes through a relay has
   its branches track that relay, so a landing that reads `origin` reads an uncredentialed mirror's
   stale head instead (ISS-31). */
import { spawnSync } from "node:child_process";

const config = (key, cwd) => {
  const run = spawnSync("git", ["config", "--get", key], { cwd, encoding: "utf8" });
  return run.status === 0 ? run.stdout.trim() : null;
};

/** The remote `branch` tracks for fetch, or `origin` where it tracks none or none is named. */
export const remoteFor = (branch, { cwd = process.cwd() } = {}) =>
  (branch && config(`branch.${branch}.remote`, cwd)) || "origin";
