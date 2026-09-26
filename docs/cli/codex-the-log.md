# codex — the log

**The log is the session.** There is no session id, so a consult opens with this repository's last
three answered ones and their verdicts. Findings are numbered `F1…` across angles and a verdict names
them — `--accepted F1,F3 --rejected F2=why`, and `--misreasoned F4=why` for one right about what and
wrong about why, which [the finding](codex-the-finding.md) explains, never a count: 185 accepted
to 14 rejected was the count form saying nothing. What is replayed is the findings, the rulings and what became of each, not the
prose: the gateway reported no cache creation in 108 consults, so every replayed character was paid for
on every call. A recheck's REFUTED rulings record themselves as the verdict on the consult they judged
(CONFIRMED stays open) over every finding the author has not ruled on; one they have keeps the ruling
and the reason they gave it, and the recheck's word on it is stored and printed beside that ruling
rather than over it. The record says finding by finding which of its rulings a recheck wrote, so a
later recheck revises its own word and never the author's. A verdict lands by default on this run's last
consult that made findings and heard nothing, and `--of` names another. The commit gate waits on
both: [the commit gate](codex-the-commit.md), and its how document carries the counts. Usage is summed over a consult's calls; logged from the
last call alone, the per-model score counted a third of the input. A consult that recorded no duration is left
out of the median rather than counted as nought: three untimed rows beside one that took a minute
answered nought seconds. A `started` entry is written before the call, because a consult
that dies mid-flight reaches no handler and a review that vanished is what an eval most wants to see.
Each entry carries the commit, a per-file sha256 and whether the file was clipped: advice that cannot
be tied to bytes cannot be checked.

**Which run wrote a row.** Waves of three to six runs consult at once here, and the clock told 151
recent ruling calls from nobody, so `forge stats eval` disclosed a blind spot where a number was
owed. A row carries the granted id this run's tracker writes go under and the source that answered
for it, because an id alone is not evidence of a run: inherited, it is a wave's; saved, a machine's;
and none is minted here, an id saved on the way past being the blank wearing a value. Nothing
backfills the rows behind it, and the eval pairs as it always did until ISS-853 moves it.

**It is a file on disk, and `forge codex log` prints it back into a session.** So every string in a
record is masked at the write, at every depth, by the same seat the refusal log reads: a second set of
patterns is the one that misses the level the first set learned about. It does not take that log's
220-character clip with it — a reply is the eval set this log is kept for. Over-masking is the
direction chosen, so a review's own prose about a credential comes back with `***` in it, and the
masking runs on each value rather than over the finished line: a mask reaching to the next space would
eat a closing quote and leave an entry nothing can parse.

That mask reaches nothing written before it, and the log is append-only, so the printer masks again
over the entries it is about to print. The seat is the print and not the read: masking a 2,248-entry
log costs 377ms against the 23ms it takes to parse one, and the hook path parses it on every consult.
A line's counts are taken from the stored entry rather than the masked copy, because a mask shortens
a reply and an eval number that moved is a wrong one. The two ends answer different questions — what
accumulates on disk from here, and what reaches a transcript now — and neither makes the other
redundant.

What is deliberately not done is a pass that rewrites the file. Counted on the machine that raised
it, no on-sight credential shape matches any entry at all: only the two *named* patterns fire, on 42
entries of prose about credentials. So a rewrite would remove nothing and would destroy text in an
append-only eval set nothing backs up, on a file already at 0600 in the config directory. The residue
stays, and every route that prints an entry back to the caller is masked (ISS-266). What a consult
replays into its *next request* is masked at the emission too, and before the clips: a shape a clip
cuts in half is one no pattern knows (ISS-268).

**A consult belongs to a repository and to a run, not to a directory.** Every delegated run stands
in a worktree of its own while the checkout it came from sends commands too, so a row carries the
repository its checkout belongs to beside the checkout itself, and the verdict verb, the review
capture and a stats `--root` read every worktree of it. The flagless verdict is also scoped to the
calling run: a guess landing on another run's open consult discarded a real finding with nothing in
the record showing it, and a verdict is corrected rather than removed, so refusing is the cheaper
failure. `--of` reaches any run's consult in the repository, a later run owing a verdict on an
earlier one's being the ordinary case. A row written before the field answers by its checkout path,
so one from a worktree since removed stays unreachable from elsewhere (ISS-898).

**How many whole-set reads a run has taken is read off these rows, never kept.** A rung under the top
allows one, and runs were taking about four with nothing counting them. A counter beside the log is a
second copy a crashed run leaves wrong, and the transcript is the wrong source anyway: the send mode
is resolved rather than typed, so the shell line no longer says what went up. What tells a repeat
from a recheck is the head. A row's head is a commit and a read is only counted at a clean one, so a
second read carrying a file already read at that head had nothing new to judge: that is the read the
allowance excludes. A read at a head no earlier read was at follows a commit, which the rule already
owes a read. A pass at a read head carrying only unread files is the same read, as the landing
already takes it. The count refuses nothing until it is trusted, because a miscount would block the
one read a run genuinely owes (ISS-1090).

What the stats window answers, how it groups, and why a pass and a recheck are priced apart is
[codex — the stats](codex-the-stats.md).

**A number nobody looks at is not a measurement.** The reviewer slot moved to another model after one
eval done by hand, and the runs since judge the harness by the feel of the next few consults: reading
`stats` is a thing someone has to remember. So the log says when to look at itself — the consult whose
own record takes the count of answered consults onto a hundred ends by naming `forge codex eval` and
nothing else, the reasoning being this paragraph's job and not a transcript line's. The count is the
whole device's, because the file is one, and the crossing belongs to whichever project's consult
reaches it. What decides is that record's own place in the log once it is in, not a count taken around
the write: two consults finishing together read the same total before and after, and both would claim
the mark. The record is found by more than its id, three random bytes — two sharing one would trade
ordinals between an append and the read after it, and the wrong one would announce. Nothing else
remembers a crossing: a file that did is a second copy of a number the log already holds, wrong the
first time an entry is lost. Answered consults are counted rather than lines, because that is the
population the eval compares and because a failed consult exits before it could print anything, so a
mark landing on one would pass in silence and never come round. The verb puts the last hundred against
the hundred before, per model and prompt version, through these same readers, and names what separates
the windows — a slot, the model behind it, a prompt version, the effort rung the request carried —
so the numbers are read
against whatever upgrade lies between. Its write at the mark: stats-the-mark.md; its
judgement: [the eval](codex-the-eval.md).

What a row of this log can be replayed into, and what a rebuild proves, is
[`codex — the replay`](codex-the-replay.md).

What counts as a document is `codex.pathRe`, `^docs/.*\.md$` by default, because prose is what nothing
else here checks — and a document written by a heredoc is a document. The turn is keyed by canonical git
root, one state file for every checkout, and a consult clears the files it was given at the bytes it
was given them: one recorded in flight survives, and so does one whose index holds a copy nobody
was shown (ISS-1011). It records paths, the log what went up, so no digest is
kept twice (ISS-952).
