/* Whether the read that earned the review answers for the head this lands: that the base under the
   change has not moved a path it writes (ISS-962), and that the read still answers for it — its
   commits in that history (ISS-972), its set the whole of the change (ISS-1013). REPLAY_HELP below
   argues both. Before the rebase, which settles either whichever head was read; pinned by ls-remote
   as land-ready's is, a resume past the fetch reading a ref as stale as it; edits no tracked file. */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { git, gitOut, lines, REMOTE, stop } from "../checkout.mjs";
import { FILE_CHARS, bundle } from "../../plugin/src/codex/codex-api.mjs";
import { judgedBy, logEntries, shortOfWhole, wholeReadOf } from "../../plugin/src/codex/codex-log.mjs";
import { repoRoot } from "../../plugin/src/codex/codex.mjs";
import { pathed } from "../../plugin/src/hooks/shell-spans.mjs";
import { shortly } from "./install.mjs";
import { movedBy, remoteHead } from "./land-ready/candidate.mjs";

export const REPLAYED = "the review answers for the head this lands";

/** What `-h` says about this step, beside the step itself rather than in the runner's own help: three
 *  refusals and what clears each is the longest thing that help says about any one step, and a copy
 *  of it over there ages the moment any of them is reworded. */
export const REPLAY_HELP = [
  "The step before the rebase asks two things of the read that earned the review. The first is the",
  "same rule land-ready takes for a batch, at the one landing that had none. It pins the head the",
  "remote holds by ls-remote, not off a remote-tracking ref a resume never refreshed; reads the base",
  "this change was replayed onto as its merge base with that pin, and the paths the change writes",
  "against that base, a rename putting both of its own in the set; and refuses where the base moved",
  "and the move left a difference in any of those paths: the read that earned the review judged them",
  "at the old base, so a rebase past it would push a head nobody read and leave the review record,",
  "the verdicts and the mark's reviewed clause naming it. A pin this checkout has not fetched is",
  "refused the same way and names the fetch. It names which of the change's files moved, not just",
  "that the branch did — a landing that touched none of them invalidates no read and is not refused,",
  "and it replays nothing and re-reads nothing for you:",
  "replaying onto the head that is there now is the whole of what clears it, and it goes back in",
  "ahead of the gate on any resume that can still reach the push, so --from is no way past it",
  "either. Where nothing moved it prints the flag the mark's `landing moved` clause is written by,",
  "which nothing else in a single run's ship computes.",
  "",
  "That much proves the base unmoved and not that the review was earned at what is being landed: a",
  "run which rebases after taking its read makes the merge base the pin and clears the first question",
  "by itself, so the second is the head the read was taken at. It comes off the consult log, which",
  "records that head at every consult, and it is the last answered `--send bodies` consult of this",
  "checkout carrying a whole body for every file the change writes and still holds — the read a",
  "review is earned by, one definition shared with what `--recheck` looks for. The step refuses where",
  "the head that read was taken at is not an ancestor of the head it would land, which is a rebase,",
  "an amend or a reset between the read and the ship, and it names both heads. What clears it is",
  "a read of the whole set at the head that would land, whose command it prints; no replay and no",
  "flag does. A read at a commit that head does carry passes, so a fix committed after the review",
  "lands above it as before, and so does the one rewrite the ship itself makes: the rebase a step",
  "later is recorded as the pair of heads it moved the branch across, and a read predating the first",
  "of them passes while HEAD still carries the second, since `--from` puts this step back ahead of",
  "the gate and a run whose gate failed would otherwise owe a read for the replay it was told to",
  "make. A rewrite by hand after that takes the recorded head off the lineage and is refused as any.",
  "A set too large for one bodies pass is read across several, so what it looks for is one run's",
  "passes at one clean head, which count together as one; a pass over a dirty tree joins none of",
  "them and a second run's does not either.",
  "Where no read covers the whole set it asks two narrower questions before it settles for silence.",
  "The first:",
  "does the log hold a read of this change that the change has outgrown — one that read whole the",
  "paths the change had at its own head, on a lineage this step accepts, where what would land holds",
  "paths it never carried. That is refused too, naming those paths and asking for the same read at",
  "the same head, because a read a post-review fix put out of reach is a review that provably does",
  "not answer for what is being landed, and a widening fix is the case that owes the most.",
  "The second: do the passes this change was read by cover the set between them. Where they carry no",
  "whole body for some of it, that much of what would land went clipped or was never sent, and a",
  "reply of no findings over part of a set is indistinguishable from an approving review of all of",
  "it — which is the one thing this step is here to refuse. So it names those files, and it refuses",
  "where a consult could carry them: readable, not empty, and inside the per-file cap, in which case",
  "it prints the pass that completes the read at this head. Where one of them can be carried by no",
  "pass at all it says so and lets the ship through, a refusal no command clears being a run",
  "stranded at its landing rather than a review made honest.",
  "It is silent where the log holds no read of this change at all, where the read was taken over a",
  "working tree and its head is therefore where the pass was taken rather than what it read, and",
  "where that head is no commit this checkout can resolve; it says which of the three, because a",
  "check that found nothing to judge and one that judged read alike otherwise.",
];

const notFetched = (base, pin, self) =>
  `${REMOTE}/${base} is at ${shortly(pin)}, a commit this checkout has not fetched, so what that `
  + `landing moved of this change cannot be read here. Fetch it and take this step against what is `
  + `there: ${self} ship --from 2.`;

const unreadable = (base, pin) =>
  `the merge base of this tree's HEAD with ${shortly(pin)}, which ${REMOTE}/${base} is at, read as `
  + `nothing. That is no base a review can have been judged against, and a rebase onto a head `
  + `nobody read is the one thing this step is here to refuse: read what the two histories share by `
  + `hand, and ship again.`;

const readNobodyTook = (base, pin, was, moved) =>
  `${REMOTE}/${base} moved from ${shortly(was)} to ${shortly(pin)} while this change was being `
  + `built, and what landed in between wrote ${moved.join(", ")}, which this change writes too. The `
  + `read that earned the review judged ${moved.length === 1 ? "that file" : "those files"} at `
  + `${shortly(was)}, so rebasing past this would push a head nobody read and leave the review `
  + `record, the verdicts and the mark's reviewed clause all naming it. Nothing here replays or `
  + `re-reads for you — what to do about a moved path is the run's:\n`
  + `    git log --oneline ${was}..${pin}\n`
  + `    git diff ${was} ${pin} -- ${moved.join(" ")}\n`
  + `    git rebase ${pin}\n`
  + `Then earn the review again at that head over the whole set this change touches, rewrite the `
  + `review record there, and ship. Replaying is the whole of what clears this step and no flag gets `
  + `past it: once HEAD sits on that head, the base the review judged and the base this lands on are `
  + `one commit. A landing that moved none of this change's files does not stop here at all.`;

const rewrittenSince = (of, at, head, held) =>
  `consult ${of} is the read that earned the review and it was taken at ${shortly(at)}, which this tree's `
  + `HEAD, ${shortly(head)}, does not carry: the commits that read was taken over were rewritten `
  + `afterwards — a rebase, an amend or a reset between the read and this ship. The base under this `
  + `change is fine and replaying again would not clear it; what is missing is the read at the head `
  + `that would land, and the review record, the verdicts and the mark's reviewed clause all name a `
  + `head no history here reaches. Nothing here re-reads for you:\n`
  + `    echo "<what you were doing>" | forge codex consult --send bodies ${held.map(pathed).join(" ")}\n`
  + `Then rewrite the review record at ${shortly(head)}, and ship. A read taken at a commit HEAD `
  + `carries does not stop here at all, so a fix committed after the review lands above it as before.`;

const carries = (tree, of, head) => git(["merge-base", "--is-ancestor", of, head], tree).status === 0;

/* The one rewrite this step forgives, being the step's own: `owed` puts it back ahead of the gate on
   every resume, so a ship whose gate failed after rebasing would be refused for the replay it had
   just been told to make. Nothing else rides on it — a later rewrite by hand ends the chain. */
const MARK = "forge-ship-replay";
const markAt = (tree) => join(gitOut(["rev-parse", "--absolute-git-dir"], tree) ?? tree, MARK);

const markRead = (tree) =>
  (existsSync(markAt(tree)) ? readFileSync(markAt(tree), "utf8") : "").trim().split(/\s+/u).filter(Boolean);

/* Every head the branch stood at when this step let it through, and not just the last pair: two
   failed gates are two replays, and a read taken between them belongs to neither end of one pair.
   The chain holds while what it last left is still under what this replay starts at, so a commit
   made to fix the gate extends it and a rewrite by hand starts it over. */
export const replayedBy = (tree, from) => {
  const to = gitOut(["rev-parse", "HEAD"], tree);
  if (!from || !to || from === to) return;
  const held = markRead(tree);
  const kept = held.length && carries(tree, held.at(-1), from) ? held : [];
  writeFileSync(markAt(tree), `${[...kept, from, to].join(" ")}\n`);
};

const ownReplay = (tree, at, head) => {
  const held = markRead(tree);
  return Boolean(held.length && carries(tree, held.at(-1), head)
    && held.some((one) => carries(tree, at, one)));
};

const outgrewSince = (of, at, head, added, held) =>
  `consult ${of} read the whole of this change at ${shortly(at)}, and the change has grown since: `
  + `${added.join(", ")} ${added.length === 1 ? "is a file" : "are files"} ${shortly(head)} would land `
  + `that no read here carries. That is a review which provably does not answer for this head rather `
  + `than an absence this step cannot judge, and the base under the change is fine, so replaying `
  + `clears nothing. What is missing is the read at the head that would land, over the whole of what `
  + `it now touches, and nothing here re-reads for you:\n`
  + `    echo "<what you were doing>" | forge codex consult --send bodies ${held.map(pathed).join(" ")}\n`
  + `Then rewrite the review record at ${shortly(head)}, and ship. A fix that adds no file leaves the `
  + `read covering the whole set and does not stop here at all.`;

/* The change's paths less the ones it deleted, which have no body a read could carry. NUL-delimited and
   untrimmed: `--name-only` quotes a path outside ASCII and `gitOut` eats a leading space, while a log
   entry holds the real one either way, so a trimmed set would pass unmatched as an absence. */
const pathsIn = (tree, from, to) => {
  const named = git(["diff", "--name-only", "--no-renames", "--diff-filter=d", "-z", `${from}..${to}`], tree);
  return (named.status === 0 ? named.stdout ?? "" : "").split("\0").filter(Boolean);
};

/* A read this change outgrew, as against one that never covered it: the newest consult whose head this
   step accepts and which read whole the paths the change had at that head — diffed from that head's
   merge base with this change's base, so the ship's own replay leaves a candidate the change's paths
   and not the landing's. An empty covered set is no read of this change: every bodies consult read it. */
const outgrew = (tree, was, root, held, head) => {
  for (const one of judgedBy(logEntries(), root, held).reverse()) {
    if (one.dirty || !gitOut(["rev-parse", "--verify", `${one.head}^{commit}`], tree)) continue;
    if (!carries(tree, one.head, "HEAD") && !ownReplay(tree, one.head, head)) continue;
    const from = gitOut(["merge-base", one.head, was], tree);
    const covered = from ? pathsIn(tree, from, one.head) : [];
    const added = held.filter((rel) => !covered.includes(rel));
    if (covered.length && added.length && shortOfWhole(one, covered).whole) return { one, added };
  }
  return null;
};

const shortOf = (of, at, head, missing, ask) =>
  `the bodies passes this change was read by, the newest of them consult ${of} at ${shortly(at)}, `
  + `carry no whole body for ${missing.join(", ")}. That much of what ${shortly(head)} would land was `
  + `sent clipped or never sent, so the review answers for the rest of the set and not for ${ask.length === 1 ? "it" : "them"}, `
  + `and an approving review of a set nobody read whole is what this step exists to refuse. Nothing `
  + `here re-reads for you:\n`
  + `    echo "<what you were doing>" | forge codex consult --send bodies ${ask.map(pathed).join(" ")}\n`
  + `Take it as this run, at this head, and it joins the passes already taken; then rewrite the `
  + `review record at ${shortly(head)}, and ship.`;

const stuckOn = (missing, stuck) =>
  `  the bodies passes this change was read by carry no whole body for ${missing.join(", ")}, and `
  + `${stuck.join(", ")} can be carried by no pass at all — empty, unreadable, or longer than the `
  + `${FILE_CHARS} characters one file may be sent as. No consult clears that, so this step names it `
  + `rather than refusing a ship nothing would let through: the review answers for the rest of the `
  + `set, and what it does not answer for is the line above`;

/* A read of this change and not of a file it happens to name: the same question `outgrew` asks, and
   for the same reason — at a head the change had no paths at, a whole body is the old file. */
const ofThisChange = (tree, was, one) => {
  const from = gitOut(["merge-base", one.head, was], tree);
  return Boolean(from && pathsIn(tree, from, one.head).length);
};

/* Which of the set the passes on this lineage carry, taken one run and one head at a time as
   `wholeReadOf` does, so a partial sequence is told from two unrelated consults that happen to
   overlap. The best-covering group is the one this change was read by; a group carrying none of the
   set is no read of it. */
const coveredBy = (tree, was, root, held, head) => {
  const groups = new Map();
  for (const one of judgedBy(logEntries(), root, held)) {
    if (one.dirty || one.send !== "bodies") continue;
    if (!gitOut(["rev-parse", "--verify", `${one.head}^{commit}`], tree)) continue;
    if (!carries(tree, one.head, "HEAD") && !ownReplay(tree, one.head, head)) continue;
    if (!ofThisChange(tree, was, one)) continue;
    const key = one.run ? `${one.head} ${one.run}` : (one.id ?? one.at);
    groups.set(key, [...(groups.get(key) ?? []), one]);
  }
  let best = null;
  for (const group of groups.values()) {
    const missing = held.filter((rel) => !group.some((one) => shortOfWhole(one, [rel]).whole));
    if (missing.length === held.length) continue;
    if (!best || missing.length < best.missing.length) best = { group, missing };
  }
  return best;
};

const shortSays = (tree, was, root, held, head) => {
  const best = coveredBy(tree, was, root, held, head);
  if (!best?.missing.length) return false;
  const last = best.group.at(-1);
  const stuck = bundle(root, best.missing)
    .filter((part) => part.missing || !(part.chars > 0) || part.chars > FILE_CHARS)
    .map((part) => part.rel);
  if (!stuck.length) {
    stop(shortOf(last.id ?? last.at, last.head, head, best.missing,
      last.head === head ? best.missing : held));
  }
  console.log(stuckOn(best.missing, stuck));
  return true;
};

/* `--is-ancestor` and not equality: a rebase drops the reviewed commit, while a commit made after the
   read to fix one of its findings keeps it and lands above it by design. */
const readSays = (tree, was) => {
  const root = repoRoot(tree);
  const held = pathsIn(tree, was, "HEAD");
  const read = root ? wholeReadOf(logEntries(), root, held) : null;
  const head = gitOut(["rev-parse", "HEAD"], tree);
  if (!read) {
    const grew = root ? outgrew(tree, was, root, held, head) : null;
    if (grew) stop(outgrewSince(grew.one.id ?? grew.one.at, grew.one.head, head, grew.added, held));
    if (root && shortSays(tree, was, root, held, head)) return undefined;
    return console.log(`  no consult in this log read the whole of this change's ${held.length} `
      + `file(s) at a recorded head of ${root ?? "this tree"}, so the head the review was earned at `
      + `is not something this can read — it judges nothing here and the read stands where it was taken`);
  }
  const of = read.id ?? read.at;
  if (read.dirty) {
    return console.log(`  consult ${of} read this change's whole set at ${read.head}, but over a `
      + `working tree, so that head is where the pass was taken rather than what it read and settles `
      + `nothing about what HEAD carries`);
  }
  if (!gitOut(["rev-parse", "--verify", `${read.head}^{commit}`], tree)) {
    return console.log(`  consult ${of} read this change's whole set at ${read.head}, which is no `
      + `commit this checkout can resolve, so whether HEAD carries it cannot be read here`);
  }
  const at = shortly(read.head);
  if (carries(tree, read.head, "HEAD")) {
    return console.log(`  the read that earned the review was taken at ${at}, which ${shortly(head)} carries`);
  }
  if (!ownReplay(tree, read.head, head)) stop(rewrittenSince(of, read.head, head, held));
  console.log(`  the read that earned the review was taken at ${at}, which this ship's own rebase `
    + `replayed as ${shortly(head)}, and nothing has rewritten the branch since`);
};

export const replaySays = (tree, base, self) => {
  const pin = remoteHead(tree, base);
  if (!gitOut(["rev-parse", "--verify", `${pin}^{commit}`], tree)) stop(notFetched(base, pin, self));
  const was = gitOut(["merge-base", "HEAD", pin], tree);
  if (!was) stop(unreadable(base, pin));
  // --no-renames: with detection on, a rename's source is absent and an upstream edit to it passes.
  const files = lines(gitOut(["diff", "--name-only", "--no-renames", `${was}..HEAD`], tree));
  const moved = movedBy(tree, was, pin, files);
  if (moved.length) stop(readNobodyTook(base, pin, was, moved));
  console.log(`  ${REMOTE}/${base} is ${shortly(pin)}`
    + `${was === pin ? ", the head this change sits on" : `, moved from ${shortly(was)} under it`}`
    + `, and none of this change's ${files.length} file(s) moved with it`);
  console.log("  the clause of the mark's note that says what the landing moved of this change, "
    + "which is what lets the verdicts stand at the head they were taken at, is written by this flag:");
  console.log("    --moved nothing");
  readSays(tree, was);
};
