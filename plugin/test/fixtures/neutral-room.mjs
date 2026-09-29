/* The checkout a spawned call stands in when a case names none: a fresh `git init` naming no run,
   made once per process. Every test process holds a configuration home of its own, and a child left
   in this process's directory inside a run's worktree held that home against the run's and was
   refused (ISS-2824), so `ranAsync` defaults here rather than to the process's directory.

   A case resolving a brief's lines against this repository's own sources needs those files on disk,
   which the empty room has none of: `neutralCheckout` copies the tracked files into a second room
   naming no run. Copied off the working tree, not off `HEAD`, so an edit not yet committed is what a
   case reads. */
import { spawnSync } from "node:child_process";

import { tempRoom } from "./rooms/lifecycle.mjs";

const REPO_ROOT = new URL("../../../", import.meta.url).pathname;

let sharedRoom = null;
let sharedCheckout = null;

const madeRoom = () => {
  const at = tempRoom("neutral-cwd-");
  spawnSync("git", ["init", "-q", at], { cwd: at });
  return at;
};

export const neutralRoom = () => (sharedRoom ??= madeRoom());

const madeCheckout = () => {
  const at = tempRoom("neutral-checkout-");
  spawnSync("git", ["init", "-q", at], { cwd: at });
  const named = spawnSync("git", ["ls-files", "-z"], { cwd: REPO_ROOT, maxBuffer: 1024 ** 3 });
  const packed = spawnSync("tar", ["-cf", "-", "--null", "-T", "-"],
    { cwd: REPO_ROOT, input: named.stdout, maxBuffer: 1024 ** 3 });
  spawnSync("tar", ["-xf", "-"], { cwd: at, input: packed.stdout, maxBuffer: 1024 ** 3 });
  return at;
};

export const neutralCheckout = () => (sharedCheckout ??= madeCheckout());
