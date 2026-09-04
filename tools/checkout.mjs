/* One authority for what both of this repository's runners ask git. Two answers to "the base" is a
   precedence rule nobody wrote down, and the runner that lost it gates a range the other never chose. */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";

export const REMOTE = "origin";
const FALLBACK = ["master", "main"];

export class Stop extends Error {}

export const stop = (message) => {
  throw new Stop(message);
};

export const git = (args, cwd = process.cwd()) => spawnSync("git", args, { cwd, encoding: "utf8" });

export const gitOut = (args, cwd) => {
  const run = git(args, cwd);
  return run.status === 0 ? (run.stdout ?? "").trim() : null;
};

export const lines = (text) => (text ?? "").split("\n").filter(Boolean);

// The worktree's .git points into the checkout's, so the common dir is the pair's one answer.
export const gitCommonDir = (from) =>
  gitOut(["rev-parse", "--path-format=absolute", "--git-common-dir"], from);

export const checkoutRoot = (from) => {
  const common = gitCommonDir(from);
  if (!common) stop(`${from} is no git checkout, so there is no repository to work in.`);
  return dirname(common);
};

// The remote's own answer first: a hard-coded name is how a runner ships to the wrong place.
export const defaultBranch = (root) => {
  const named = gitOut(["rev-parse", "--abbrev-ref", `${REMOTE}/HEAD`], root);
  if (named) return named.replace(`${REMOTE}/`, "");
  for (const ref of ["refs/remotes/origin", "refs/heads"]) {
    for (const name of FALLBACK) if (gitOut(["rev-parse", "--verify", `${ref}/${name}`], root)) return name;
  }
  return stop(`no branch named ${FALLBACK.join(" or ")} resolves here and ${REMOTE} names no default. Set ${REMOTE}/HEAD.`);
};

// Tracked and would-be-tracked: a file nothing has staged is still read by whatever claims it.
export const gitFiles = (root) =>
  [
    ...new Set([
      ...lines(gitOut(["ls-files"], root)),
      ...lines(gitOut(["ls-files", "--others", "--exclude-standard"], root)),
    ]),
  ].sort();

// Not the dirty-worktree question: a worktree's uncommitted work is the point of having one.
export const uncommittedInShared = (root) => {
  if (resolve(checkoutRoot(root)) !== resolve(root)) return [];
  return lines(gitOut(["status", "--porcelain"], root)).map((one) => one.slice(3));
};

export const crossTree = (root, cwd = process.cwd()) => {
  const here = gitOut(["rev-parse", "--show-toplevel"], cwd);
  return here && resolve(here) !== resolve(root) ? here : null;
};
