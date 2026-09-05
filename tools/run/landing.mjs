/* Which commits of a range are the release rather than the change: a bump differs from its first
   parent's manifest whatever a rebase did to it, and touches RELEASE_FILES and nothing else. */
import { join } from "node:path";

import { gitOut } from "../checkout.mjs";

export const versionAt = (root, ref) => {
  const shown = gitOut(["show", `${ref}:package.json`], root);
  if (!shown) return null;
  try {
    return JSON.parse(shown).version ?? null;
  } catch {
    return null;
  }
};

export const isRelease = (tree, sha) => versionAt(tree, sha) !== versionAt(tree, `${sha}^`);

export const RELEASE_FILES = ["package.json", "package-lock.json", join("plugin", ".claude-plugin", "plugin.json")];

export const onlyRelease = (tree, sha) => isRelease(tree, sha)
  && (gitOut(["diff", "--name-only", `${sha}^`, sha], tree) ?? "").split("\n")
    .filter(Boolean).every((one) => RELEASE_FILES.includes(one));
