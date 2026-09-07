/* The version a release takes, the record of the one this process made, and what a rejected push
   undoes. That record is the whole authorization: file scope is not provenance (ISS-333). */
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { git, gitOut, loud, read, REMOTE, stop } from "../checkout.mjs";
import { onlyRelease, RELEASE_FILES, versionAt } from "./landing.mjs";

const parts = (version) => String(version ?? "").split(".").map((one) => Number.parseInt(one, 10));

export const above = (one, two) => {
  const [a, b] = [parts(one), parts(two)];
  for (let at = 0; at < 3; at += 1) {
    if ((a[at] ?? 0) !== (b[at] ?? 0)) return (a[at] ?? 0) > (b[at] ?? 0);
  }
  return false;
};

/** Null above the remote head: a rebase drops a bump identical to one upstream silently. */
export const nextVersion = (local, upstream) => {
  if (!parts(local).every(Number.isInteger)) stop(`this tree's package.json names no version: \`${local}\`.`);
  if (above(local, upstream)) return null;
  const [major, minor, patch] = parts(upstream).every(Number.isInteger) ? parts(upstream) : parts(local);
  return [major, minor, patch + 1].join(".");
};

/* Per-worktree, like the ship's mark: a step 6 resumed in a new process is the same attempt. */
const BUMP = "forge-ship-bump";

const bumpFile = (tree) => join(gitOut(["rev-parse", "--absolute-git-dir"], tree) ?? tree, BUMP);

const bumpMade = (tree) => (existsSync(bumpFile(tree)) ? readFileSync(bumpFile(tree), "utf8").trim() : null);

export const forgetBump = (tree) => rmSync(bumpFile(tree), { force: true });

/** Read against the tree's head, not from having made it: a resume would push a disk-only version. `at` is the revision to be above, which a landing pins by `ls-remote` rather than trusting a tracking ref: a version above a stale ref is one the branch may already carry. */
export const versionAbove = (tree, base, note, at = null) => {
  forgetBump(tree);
  const upstream = versionAt(tree, at ?? `${REMOTE}/${base}`);
  /* Read before `npm version` writes: what already differs from HEAD is somebody's, not this step's,
     and an untracked release file is what `git add` sweeps in and a reset to the parent deletes. */
  const carried = [
    ...(gitOut(["diff", "--name-only", "HEAD"], tree) ?? "").split("\n"),
    ...(gitOut(["ls-files", "--others", "--exclude-standard", "--", ...RELEASE_FILES], tree) ?? "").split("\n"),
  ].filter(Boolean);
  const want = nextVersion(read(join(tree, "package.json"))?.version, upstream);
  if (want) {
    console.log(`  ${REMOTE}/${base} carries ${upstream}; taking ${want}`);
    loud("npm", ["version", want, "--no-git-tag-version"], tree, "The version lifecycle writes the manifest too.");
  }
  const mine = read(join(tree, "package.json"))?.version;
  if (versionAt(tree, "HEAD") === mine) return console.log(`  ${mine} is committed and above ${upstream}`);
  const touched = RELEASE_FILES.filter((one) => existsSync(join(tree, one)));
  loud("git", ["add", ...touched], tree, "Stage them by name and commit the bump yourself.");
  loud("git", ["commit", "-m", note ?? `chore(release): ${mine}, so the installed copy is this head`], tree,
    "Commit the bump, then resume.");
  if (carried.length > 0) {
    return console.log(`  ${carried.join(", ")} differed from HEAD before this step ran, so this commit `
      + `is not wholly its own and a rejected push will leave it standing`);
  }
  return writeFileSync(bumpFile(tree), `${gitOut(["rev-parse", "HEAD"], tree)}\n`);
};

/** What the push says beyond `rejected`, the tree first put where a rebase goes through: the bump
 *  names a version the remote took, and conflicts that rebase on files nobody edited. */
export const unwound = (tree) => {
  const head = gitOut(["rev-parse", "HEAD"], tree);
  if (!head) return "";
  const release = Boolean(gitOut(["rev-parse", "--verify", "HEAD^"], tree)) && onlyRelease(tree, head);
  if (head !== bumpMade(tree)) {
    return release
      ? `, and the release commit at HEAD was left standing: this run did not make the whole of it, `
        + `so it is not this script's to undo. Read it before the rebase — git show --stat HEAD`
      : "";
  }
  if (!release) return "";
  /* What a hard reset would destroy and nothing wider: an untracked file survives one. */
  if (gitOut(["status", "--porcelain", "--untracked-files=no"], tree)) {
    return `, and the version commit at ${versionAt(tree, head)} was left standing: this tree has `
      + `uncommitted work in it and undoing the commit would take that with it. Commit or drop it, `
      + `then git reset --hard HEAD^`;
  }
  if (git(["reset", "--hard", "HEAD^"], tree).status !== 0) {
    return `, and the version commit at ${versionAt(tree, head)} could not be undone — drop it `
      + `yourself (git reset --hard HEAD^) so the rebase does not conflict on ${RELEASE_FILES.join(", ")}`;
  }
  forgetBump(tree);
  return `, and the version commit this run made at ${versionAt(tree, head)} is undone, so this tree `
    + `holds only the change and rebases clean`;
};
