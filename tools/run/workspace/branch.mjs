/* The branch `start` cut, kept beside the run id in the tree's own git directory because the tree's
   HEAD says where the tree stands now and not what `start` made: a run that detaches it to read a
   landed commit, or cuts a second branch in it, would hand `finish` the literal `HEAD` or a branch it
   never cut (ISS-3097, ISS-2343, ISS-1156). The record is the one source; a tree cut before `start`
   wrote it has its branch named by nobody, and `finish` says so rather than guessing a name. */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { typed } from "../../../plugin/src/hooks/shell-spans.mjs";
import { besideGit } from "../../../plugin/src/resolve/session/run-id.mjs";
import { REMOTE, git, gitOut } from "../../checkout.mjs";

export const BRANCH_AT = "forge-run-branch";

export const branchRecorded = (path, branch) => {
  const at = besideGit(path, BRANCH_AT);
  if (at) writeFileSync(at, `${branch}\n`);
};

const recordedAt = (path) => {
  const at = besideGit(path, BRANCH_AT);
  return at && existsSync(at) ? readFileSync(at, "utf8").trim() || null : null;
};

/** The branch `start` recorded for the tree at `path` and whether this checkout still has it, or null where no record names one. */
export const startBranch = (root, path) => {
  const name = recordedAt(path);
  if (!name) return null;
  return { name, live: Boolean(gitOut(["rev-parse", "--verify", "--quiet", `refs/heads/${name}`], root)) };
};

/** Where the tree's HEAD stands: a branch by its name, or a detached commit by its short hash. */
export const standsOn = (path) => {
  const branch = gitOut(["symbolic-ref", "--quiet", "--short", "HEAD"], path);
  return branch ? { branch } : { detached: gitOut(["rev-parse", "--short", "HEAD"], path) ?? "an unreadable commit" };
};

export const standsSaid = (stands) => (stands.branch ? `branch ${stands.branch}` : `a detached HEAD at ${stands.detached}`);

export const onItsBranch = (branch, stands) => Boolean(branch) && stands.branch === branch.name;

export const elsewhereLine = (branch, stands) => {
  if (onItsBranch(branch, stands)) return null;
  const kept = stands.branch ? `, and ${stands.branch} is left as it is` : "";
  return branch
    ? `  note     the tree stands on ${standsSaid(stands)}, not on the branch start cut, ${branch.name}${kept}`
    : `  note     the tree stands on ${standsSaid(stands)}, and no record names the branch start cut${kept}`;
};

/* `-d` and never `-D`, with git's own advice off: that advice offers the forced delete, which is the
   one route out of this a refusal here may not carry — the way out is the line below it. */
const deleted = (root, base, name, ended) => {
  const run = git(["-C", root, "-c", "advice.forceDeleteBranch=false", "branch", "-d", name], root);
  if (run.status === 0) {
    ended.removed.push(`branch ${name}`);
    return console.log(`  removed  branch ${name}`);
  }
  const later = `git -C ${root} branch -d ${name}`;
  ended.left.push(`branch ${name}, which git refused to delete and which loses nothing: ${later}`);
  console.error(`  left     branch ${name}, which git refuses to delete: `
    + `${(run.stderr ?? "").trim() || `it exited ${run.status}`}`);
  return console.error(`           nothing of it is lost — ${REMOTE}/${base} carries every commit of `
    + `it, proved before anything was removed. Delete it once this checkout has caught up: ${later}`);
};

/* No record names no branch, and a name built from the key would be the prefix the verb's help
   refuses as ownership: the slug `start` took is in no other record. So the route lists what the key
   could have cut and deletes nothing. */
const unnamed = (root, key, ended) => {
  const n = key.slice(4).toLowerCase();
  const list = `git -C ${root} branch --list ${typed(`iss-${n}`)} ${typed(`iss-${n}-*`)}`;
  ended.left.push(`no branch, because no record names the one start cut: ${list}`);
  console.log(`  left     no branch: the tree's git directory held no record of the branch start cut, `
    + `so nothing here names one to remove. The branches named for ${key}, each to delete by hand once `
    + `merged: ${list}`);
};

/** Removes the branch `start` recorded, or says why none was. */
export const removedBranch = (root, base, key, branch, ended) => {
  if (!branch) return unnamed(root, key, ended);
  if (!branch.live) return console.log(`  gone     branch ${branch.name}, which start cut, is no longer a branch of this checkout`);
  return deleted(root, base, branch.name, ended);
};
