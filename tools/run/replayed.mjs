/* Whether the base the review judged is still the base the change lands on. `land-ready` hands a
   branch back where its pinned base moved a path under review; a single run's ship rebased onto
   the same pin and asked nothing, so the review and the mark named a head nobody landed (ISS-962).
   Before the rebase, which would make the merge base the pin whichever head was read; pinned by
   ls-remote as land-ready's is, a resume past the fetch reading a ref as stale as it; edits nothing. */
import { gitOut, lines, REMOTE, stop } from "../checkout.mjs";
import { shortly } from "./install.mjs";
import { movedBy, remoteHead } from "./land-ready/candidate.mjs";

export const REPLAYED = "the base the review judged is still the base";

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
  console.log("  the mark's note says what the landing moved of this change, which is what lets the "
    + "verdicts stand at the head they were taken at:");
  console.log("    landing moved nothing");
};
