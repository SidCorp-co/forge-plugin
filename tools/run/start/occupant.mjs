/* The tree path is the issue key beside the checkout, so two projects sharing a parent directory
   and the ISS-nn scheme derive one path (ISS-401); whose tree is there decides who can clear it. */
import { realpathSync } from "node:fs";
import { basename, dirname } from "node:path";

import { gitCommonDir, gitOut } from "../../checkout.mjs";
import { runIdAt, RUN_ID_VAR } from "./run-id.mjs";

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

export const occupied = (root, path) => {
  // The toplevel as well: `rev-parse` inside a plain directory answers for whatever encloses it.
  const common = gitCommonDir(path);
  const top = gitOut(["rev-parse", "--show-toplevel"], path);
  if (!common || !same(top, path)) {
    return `${path} is already there and git answers no worktree root for it, so it is a plain `
      + `directory or a tree this checkout cannot read — which of the two is what \`git -C ${path} `
      + `status\` says. Start again once the path is free.`;
  }
  if (!same(common, gitCommonDir(root))) {
    const owner = ownerOf(common);
    const whose = same(owner, path) ? "a checkout of its own" : `a worktree of ${owner}`;
    return `${path} is already there and is ${whose}, so clearing it is that repository's to do and `
      + `no command here reaches it. This path is derived from the issue key alone and that `
      + `repository keys its issues the same way, so the key has no tree beside ${dirname(root)} `
      + `until the one there is gone: work it once that repository has released the path.`;
  }
  const held = runIdAt(path);
  return `${path} is already there, and start never touches a worktree it did not make. Work in it, `
    + `or remove it: git -C ${root} worktree remove ${path}`
    + (held ? `\nThe id that run takes the lease under: ${RUN_ID_VAR}=${held}` : "");
};
