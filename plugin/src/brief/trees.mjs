/* The trees of one repository and what each holds, both readings: a run keeps its work uncommitted
   until it commits, so a reading of commits alone answers empty for a tree with files open in it. */
import { spawnSync } from "node:child_process";

import { runIdAt, runsFor, scratchAt } from "../resolve/session/run-id.mjs";

const REMOTES = ["origin/main", "origin/master"];

const git = (args, cwd) => {
  const run = spawnSync("git", args, { cwd, encoding: "utf8" });
  return run.status === 0 ? run.stdout : null;
};

const lines = (text) => String(text ?? "").split("\n").map((one) => one.trim()).filter(Boolean);

/** The remote's own default first; the two common names only where it names none. */
export const defaultRef = (from) => {
  const named = git(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], from)?.trim();
  return [named, ...REMOTES].filter(Boolean)
    .find((ref) => git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], from) !== null) ?? null;
};

const fieldOf = (block, name) =>
  block.split("\n").find((line) => line.startsWith(`${name} `))?.slice(name.length + 1) ?? null;

/** Every worktree git lists for the repository `from` stands in, or null outside one. */
export const treesOf = (from) => {
  const listed = git(["worktree", "list", "--porcelain"], from);
  if (listed === null) return null;
  return listed.split("\n\n").map((block) => ({
    path: fieldOf(block, "worktree"),
    head: fieldOf(block, "HEAD"),
    branch: fieldOf(block, "branch")?.replace(/^refs\/heads\//u, "") ?? null,
  })).filter((one) => one.path);
};

/* `-z` and no renames, so a path with a space or a moved file is one whole path and not two halves. */
const uncommitted = (tree) => {
  const said = git(["status", "--porcelain", "-z", "--no-renames"], tree);
  return said === null ? null : said.split("\0").filter(Boolean).map((one) => one.slice(3));
};

const committed = (tree, base) => {
  if (!base) return null;
  const said = git(["diff", "--name-only", `${base}...HEAD`], tree);
  return said === null ? null : lines(said);
};

/** What one tree holds against `base`: null for a reading git would not give, which is not empty. */
export const heldBy = (tree, base) => ({
  uncommitted: uncommitted(tree),
  committed: committed(tree, base),
  keys: runsFor(runIdAt(tree)).map((one) => one.toUpperCase()),
});

/** The run id and scratch directory a tree's git directory records, each null where it records none. */
export const recordsOf = (tree) => ({ id: runIdAt(tree), scratch: scratchAt(tree) });
