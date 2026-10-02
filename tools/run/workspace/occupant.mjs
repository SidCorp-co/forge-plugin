/* The tree path is the issue key beside the checkout with the project's slug in it, since two projects
   sharing a parent directory and the ISS-nn scheme derived one path (ISS-401); whose tree is there
   decides who can clear it, and the verb that makes one and the verb that ends one read both off here. */
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { projectAt, projectRecords } from "../../../plugin/src/resolve/settings.mjs";
import { besideGit } from "../../../plugin/src/resolve/session/run-id.mjs";
import { gitCommonDir, gitOut } from "../../checkout.mjs";
import { runIdAt, RUN_ID_VAR } from "./run-id.mjs";

export const KEY = /^ISS-\d+$/u;

/* Read for the checkout `root` names and never for the caller's directory: every retry `finish`
   prints is an absolute script path, so it reads as runnable from anywhere and has to be (ISS-2666). */
export const worktreePath = (root, key) => join(dirname(root), `wt-${projectAt(root) ?? basename(root)}-${key}`);

/** Why the tree is named for the checkout's folder rather than a slug, or null where a slug resolved.
 *  A tree cut under a home that held the record is named for that slug, so this name can miss it. */
export const slugless = (root) => (projectAt(root)
  ? null
  : `no record of ${root}'s project under ${projectRecords().dir} names a slug, so its trees are named `
    + `for the folder ${basename(root)}, and a tree cut under a home that held the record is named for `
    + `that record's slug instead`);

const resolved = (one) => {
  try {
    return realpathSync(one);
  } catch {
    return null;
  }
};

// Git's own answers first: where neither resolves, a tree of ours must not read as one of theirs.
const same = (one, other) => {
  if (one === other) return true;
  const here = resolved(one);
  return Boolean(here) && here === resolved(other);
};

// The git dir itself where it is not a `.git` in a checkout: a bare repository backs worktrees too.
const ownerOf = (common) => (basename(common) === ".git" ? dirname(common) : common);

/** Whose tree stands at `path`: this checkout's with its lease id, another repository's with its owner, or no root. */
export const whoseTree = (root, path) => {
  // The toplevel as well: `rev-parse` inside a plain directory answers for whatever encloses it.
  const common = gitCommonDir(path);
  const top = gitOut(["rev-parse", "--show-toplevel"], path);
  if (!common || !same(top, path)) return { plain: true };
  if (!same(common, gitCommonDir(root))) {
    const owner = ownerOf(common);
    return { owner, itsOwn: same(owner, path) };
  }
  return { mine: true, held: runIdAt(path) };
};

export const occupied = (root, path) => {
  const whose = whoseTree(root, path);
  if (whose.plain) {
    return `${path} is already there and git answers no worktree root for it, so it is a plain `
      + `directory or a tree this checkout cannot read — which of the two is what \`git -C ${path} `
      + `status\` says. Start again once the path is free.`;
  }
  if (whose.owner) {
    const which = whose.itsOwn ? "a checkout of its own" : `a worktree of ${whose.owner}`;
    return `${path} is already there and is ${which}, so clearing it is that repository's to do and `
      + `no command here reaches it. This path is derived from the issue key alone and that `
      + `repository keys its issues the same way, so the key has no tree beside ${dirname(root)} `
      + `until the one there is gone: work it once that repository has released the path.`;
  }
  return `${path} is already there, and start never touches a worktree it did not make. Work in it, `
    + `or remove it: git -C ${root} worktree remove ${path}`
    + (whose.held ? `\nThe id that run takes the lease under: ${RUN_ID_VAR}=${whose.held}` : "");
};

/* The branch `start` cut, kept beside the run id in the tree's own git directory because the tree's
   HEAD says where the tree stands now and not what `start` made: a run that detaches it to read a
   landed commit, or cuts a second branch in it, would hand `finish` the literal `HEAD` or a branch it
   never cut (ISS-3097, ISS-2343, ISS-1156). The record is the one source; a tree cut before `start`
   wrote it has its branch named by nobody, and `finish` says so rather than guessing a name. */
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
