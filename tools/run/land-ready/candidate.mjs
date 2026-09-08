/* The git a landing does and nothing of the record: the merge, the candidate a reconciliation names,
   one chain link, what moved of a change's paths, the gate's tree, the push. the-checkpoint.md. */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { git, gitOut, lines, loud, REMOTE, stop } from "../../checkout.mjs";
import { LINKED, remoteHeadOf, shortly } from "../install.mjs";

export const remoteHead = (tree, base) => {
  const held = remoteHeadOf(tree, base);
  if (!held) {
    stop(`${REMOTE} named nothing for ${base}. A landing pins the base head before it builds `
      + `anything, and an unreachable remote and a branch that is gone read alike here.`);
  }
  return held;
};

// Split by hand: `lines` drops the blank separating the paths from git's own prose about them.
export const mergedTree = (tree, pin, head) => {
  const run = spawnSync("git", ["merge-tree", "--write-tree", "--name-only", pin, head],
    { cwd: tree, encoding: "utf8" });
  if (run.error) stop(`git could not be run: ${run.error.message}.`);
  const said = String(run.stdout ?? "").split("\n");
  if (run.status === 0) return { tree: said[0], conflicts: [] };
  const at = said.indexOf("", 1);
  return { tree: said[0], conflicts: said.slice(1, at < 0 ? said.length : at).filter(Boolean) };
};

/** Every input fixed — the dates, the identity, the message, the encoding — so the same merge of the
 *  same two commits is the same commit whoever builds it: the-checkpoint.md says what rests on that. */
export const candidateOf = (tree, treeSha, pin, head) => {
  const [when, name, mail] = (gitOut(["show", "--no-patch", "--format=%cI%n%cn%n%ce", head], tree) ?? "").split("\n");
  const run = spawnSync("git", ["-c", "i18n.commitEncoding=UTF-8",
    "commit-tree", treeSha, "-p", pin, "-p", head,
    "-m", `candidate: ${shortly(head)} onto ${shortly(pin)}`], {
    cwd: tree,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when,
      GIT_AUTHOR_NAME: name, GIT_COMMITTER_NAME: name,
      GIT_AUTHOR_EMAIL: mail, GIT_COMMITTER_EMAIL: mail,
    },
  });
  if (run.status !== 0) stop(`the candidate commit could not be made: ${run.stderr ?? "git said nothing"}`);
  return (run.stdout ?? "").trim();
};

/** One link: a head merged onto what the candidate is so far, as the paths that stopped it or the
 *  commit over them. A set's candidate is this down the heads in the order they were named. */
export const linked = (tree, tip, head) => {
  const merged = mergedTree(tree, tip, head);
  return merged.conflicts.length
    ? { conflicts: merged.conflicts, commit: null }
    : { conflicts: [], commit: candidateOf(tree, merged.tree, tip, head) };
};

export const movedBy = (tree, judged, candidate, files) =>
  (files.length ? lines(gitOut(["diff", "--name-only", judged, candidate, "--", ...files], tree)) : []);

export const roomFor = (root, candidate) => {
  const path = mkdtempSync(join(tmpdir(), "forge-landing-"));
  loud("git", ["worktree", "add", "--detach", path, candidate], root,
    "The candidate is gated in a tree of the landing's own, never in the one that built it.");
  for (const one of LINKED) {
    if (existsSync(join(root, one))) symlinkSync(join(root, one), join(path, one));
  }
  return path;
};

export const dropRoom = (root, path) => {
  if (!path) return;
  spawnSync("git", ["worktree", "remove", "--force", path], { cwd: root, encoding: "utf8" });
  rmSync(path, { recursive: true, force: true });
};

/** Three answers, not two: a head pushed between the fetch and the read is a commit this repository
 *  does not hold, and read as `landed: false` it would release the same change twice. */
export const landedAlready = (tree, base, intended) => {
  loud("git", ["fetch", REMOTE, base], tree, "Check the remote is reachable.");
  const now = remoteHead(tree, base);
  if (!intended) return { now, landed: false, known: true };
  const readable = [now, intended].every((one) => gitOut(["rev-parse", "--verify", `${one}^{commit}`], tree));
  if (!readable) return { now, landed: false, known: false };
  const reaches = git(["merge-base", "--is-ancestor", intended, now], tree).status === 0;
  return { now, landed: now === intended || reaches, known: true };
};

/** Whether a release carries a commit, and `false` where this checkout can read neither: asked of a
 *  release built in a tree that is gone, an unreadable sha is no evidence that anything landed. */
export const carries = (tree, intended, head) =>
  [intended, head].every((one) => gitOut(["rev-parse", "--verify", `${one}^{commit}`], tree))
  && git(["merge-base", "--is-ancestor", head, intended], tree).status === 0;

export const NOT_KNOWN = (key, base, now, intended) =>
  `${base} is at ${shortly(now)} and this checkout cannot read that commit or the release this `
  + `landing made at ${shortly(intended)}, even after fetching, so whether ${key} landed cannot be `
  + `read here. Nothing is voided and nothing is pushed on a reading this uncertain: fetch that `
  + `branch by hand, see what carries what, and run this landing again.`;

// By sha from the checkout: a second run resuming the push has no tree that holds `HEAD`.
export const pushed = (tree, base, pin, what) => {
  const run = spawnSync("git", ["push", `--force-with-lease=refs/heads/${base}:${pin}`,
    REMOTE, `${what}:refs/heads/${base}`], { cwd: tree, encoding: "utf8", stdio: "inherit" });
  if (run.error) stop(`git could not be run: ${run.error.message}. Check the remote is reachable.`);
  return run.status === 0;
};
