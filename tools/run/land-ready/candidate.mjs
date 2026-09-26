/* The git a landing does and nothing of the record: the merge, the candidate a reconciliation names,
   one chain link, what moved of a change's paths, the gate's tree, the push. the-checkpoint.md. */
import { spawnSync } from "node:child_process";

import { git, gitOut, loud, REMOTE, stop } from "../../checkout.mjs";
import { remoteHeadOf, shortly } from "../install.mjs";
import { changeMoved } from "../landing.mjs";
import { regenerated } from "../generated.mjs";

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

/** What moved of a change's paths between its judged head and a candidate, split three ways: what
 *  moved, what only a release's version fields moved (ISS-2516), and what the generators the merged
 *  head declares write back there byte for byte (ISS-1421). `merged` is where they run: the candidate
 *  itself, except for a caller comparing with a commit that is not the merge. Null where git could not
 *  answer. The mark reads this too, so what the chain carried is what the mark says moved. */
export const changeRead = (tree, judged, candidate, files, merged = candidate) => {
  const read = changeMoved(tree, judged, candidate, files);
  if (!read) return null;
  const found = regenerated(tree, merged, read.moved);
  return { ...read, ...found, moved: read.moved.filter((path) => !found.generated.includes(path)) };
};

/* Said once per pair and path: the chain asks the same pair twice where no branch was held before it. */
const told = new Set();
const fresh = (key, paths) => paths.filter((path) => !told.has(`${key} ${path}`) && told.add(`${key} ${path}`));

const generatedSaid = (read, judged, merged, key) => {
  const cleared = fresh(`${key} generated`, read.generated);
  const ran = read.scripts.join(", ");
  if (cleared.length) {
    console.log(`  ${cleared.join(", ")} moved since ${shortly(judged)}, and ${ran} run at ${shortly(merged)} `
      + `with ${cleared.length === 1 ? "that file" : "those files"} removed wrote ${cleared.length === 1 ? "it" : "them"} `
      + `back byte for byte, so the landing takes that as generated and not as a move of the change`);
  }
  if (read.why && fresh(`${key} why`, [read.why]).length) {
    console.log(`  ${ran} run at ${shortly(merged)}: ${read.why}; what they would have written stays a move`);
  }
};

/** The paths `changeRead` leaves moved, after saying which it carried and why: a builder's turn spent
 *  on bytes nobody's hand wrote is the cost this reading exists to stop. */
export const movedBy = (tree, judged, candidate, files, merged = candidate) => {
  const read = changeRead(tree, judged, candidate, files, merged);
  if (!read) return [];
  const key = `${judged} ${candidate}`;
  const release = fresh(key, read.release);
  if (release.length) {
    console.log(`  ${release.join(", ")} moved between ${shortly(judged)} and ${shortly(candidate)} only in `
      + `the version fields a release writes, so the landing takes that as the release's and not as a `
      + `move of the change`);
  }
  if (read.scripts.length) generatedSaid(read, judged, merged, key);
  return read.moved;
};

const cleanly = (tree, pin, head) => {
  const merged = mergedTree(tree, pin, head);
  return merged.conflicts.length ? null : candidateOf(tree, merged.tree, pin, head);
};

/** A builder's reconciliation re-keyed to a fresh pin, null where it does not survive one: a
 *  candidate this checkout cannot rebuild, or that only a conflicted merge names, is a reading it
 *  cannot vouch for; what stales one it can rebuild is the merge's own content. the-checkpoint.md. */
export const stillReads = (tree, landing, pin) => {
  if (!landing.reconciled || !landing.moved || !landing.pinned || !landing.head) return null;
  const readable = [landing.pinned, landing.head, pin]
    .every((one) => gitOut(["rev-parse", "--verify", `${one}^{commit}`], tree));
  if (!readable) return null;
  const was = cleanly(tree, landing.pinned, landing.head);
  if (!was || was !== landing.reconciled) return null;
  const now = cleanly(tree, pin, landing.head);
  if (!now) return null;
  return movedBy(tree, was, now, landing.files).length ? null : now;
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

/** A candidate over some of a set's heads, in the order given, on the pin, or null where a link
 *  conflicts: the search's subsets are built exactly as the chain step builds the whole set, so the
 *  same heads on the same pin are the same commit. */
export const chainOver = (tree, pin, heads) => {
  let tip = pin;
  for (const head of heads) {
    const link = linked(tree, tip, head);
    if (link.conflicts.length) return null;
    tip = link.commit;
  }
  return tip;
};

export const treeOf = (tree, commit) => gitOut(["rev-parse", `${commit}^{tree}`], tree);
