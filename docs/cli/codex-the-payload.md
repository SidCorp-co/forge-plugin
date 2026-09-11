# codex — the payload

What the verb does around this — where its set comes from, where a base is read from, what a
recheck narrows to: [the consult](codex-the-consult.md). What one round buys and what a follow-up
round is for: [the round](codex-the-round.md).

**The diff travels, not the body.** Sending files whole *and* offering tools paid twice: two consults
spent 12 and 17 calls re-reading text already in front of them. Telling it not to re-read did not
work; sending less did — 4,381 characters against 32,233 on a two-file review, 5,266 against 59,462 on
a four-file one, same findings. `bodies` remains for a file outside any checkout, and for the one
pass below that is owed whatever the payload costs.

**One pass reads the whole set, and it is the one a review is earned by.** A diff consult judges the
diff and answers *not verified* on the rest, which nobody can approve on. So the earning read is a
`--send bodies` pass over the whole touched set, at the commit; the diff rounds between edits close
findings and none is owed. `--recheck` is not that pass and does not become it — a recheck answers
findings, and after a clean pass there are none, so it refuses and names the whole-set read. A flag
that quietly ran the costlier thing would bill for a question nobody asked, which is why `--rounds
two` is refused rather than rounded.

**A pass that cannot carry the set whole is refused, never clipped.** A bodies payload has a
per-file cap and a total, and past either `bundle` sends what fits and marks the rest CLIPPED. That
is the right answer to a payload that does not fit and the wrong one to a review: nothing downstream
tells a pass that went short from one that did not, so no findings over part of a set reads exactly
as an approving review of all of it — 9 of 25 files on an ordinary feature, 13 of 30 measured again
on the change that fixed it (ISS-1087). So the verb reads the set's own lengths before it opens the
gateway and refuses, printing the passes whose union is the set, cut by directory so a pass reads as
one concern. No flag gets past it, because a flag would put the short pass back and oblige
everything downstream to tell it apart, which is the whole of what nothing does. What the passes
then earn is the thing one pass earns: **one run's bodies passes at one clean head are together the
read the review was earned by** — the head pins the bytes each saw, and the run is what makes them a
sequence somebody took rather than two consults that happened to overlap. A file longer than the
per-file cap is in no pass at all, so it is named apart beside the diffs pass that is the most of it
a reviewer can be given, and the ship then says that file went unread rather than refusing a landing
no command would clear.

**A path nothing can be shown of never travels and is never recorded.** `bundle` marks what it cannot
read `missing`, which is three things: a tracked deletion, whose diff is its whole change; a file that
exists and could not be read, a dangling symbolic link among them; and one that is not there at all
and has no diff, which went out as `NEW FILE` with no lines under it. Absence is `lstat` and only
`ENOENT`, never a failed read.

