# codex — the consult

What one round buys, what effort it is asked at, and what a follow-up round is for:
[the round](codex-the-round.md).

**No local agent.** The first engine spawned a `claude` session with `--allowedTools Read Grep Glob`;
that flag auto-approves and does not confine, so the child inherited this machine's skills, answered a
review prompt by running a multi-agent review skill, and had to be killed by pid after eleven minutes.
The one exception since is `codex.check`: a command the *checkout* names in `.forge.json`, run at most
once per consult under a clock, exit code and tail returned. "The tests pass" was the claim every review
said it could not verify; a fixed command it did not choose is not a shell.

**What the advisor is, measured.** From a transcript: the built-in advisor forwards the whole
conversation (32,385 input tokens, no cache read, ~33 s) and its reply comes back encrypted, never
entering the transcript as plaintext. That is the number behind what the skill says about carrying
its reply into the consult.

**The diff travels, not the body.** Sending files whole *and* offering tools paid twice: two consults
spent 12 and 17 calls re-reading text already in front of them. Telling it not to re-read did not
work; sending less did — 4,381 characters against 32,233 on a two-file review, 5,266 against 59,462 on
a four-file one, same findings. `bodies` remains for a file outside any checkout, and for the one
pass below that is owed whatever the payload costs.

**One pass reads the whole set, and it is the one a review is earned by.** A diff consult judges the
diff and answers *not verified* on the rest, which nobody can approve on. So the earning read is one
`--send bodies` pass over the whole touched set, at the commit; the diff rounds between edits close
findings and none is owed. `--recheck` is not that pass and does not become it — a recheck answers
findings, and after a clean pass there are none, so it refuses and names the whole-set read. A flag
that quietly ran the costlier thing would bill for a question nobody asked, which is why `--rounds
two` is refused rather than rounded.

**The plan and the criteria are the second thing owed a whole body, and the first that no commit gate
could ever have asked for.** They are written into fields of an issue from a file that matches no path
pattern and is never staged, so neither the turn's record nor what a commit closes over names them —
and a wrong plan is the expensive error, because everything after it is built against it and the
review that would catch it comes after the code. So `forge plan` and `forge record criteria` do the
asking themselves: each refuses a file no answered consult has read whole as it now stands, and prints
the consult that clears it. Whole means the same here as it does to a recheck — one `--send bodies`
pass — because what the log records per file is what was *read off disk* and not what travelled, so a
diff round logs a size and a hash for a body the reviewer was told to fetch for itself and may never
have asked for. What decides freshness is that per-file hash against the file's bytes now, not a
clock: a file consulted, edited and then restored to what was read has been read, and two writes
inside one millisecond are still two. Four states are named apart rather than sharing a sentence —
never consulted, sent as a diff, no whole body carried, read and since changed — because a caller who
did consult and was refused anyway learns nothing from being sent back to the command that just
failed them. Both verbs ask before they touch the tracker at all, so a
refusal is never one the caller has to undo. A body piped in is refused with the file route named,
since a consult is asked for a path and there is none. And it stands down outside a checkout for nobody: these verbs write by issue
reference from any directory, so one `cd` would otherwise be the whole way past the rule.

**A refusal reports the log and stops there.** It names the consult that found nothing, whether that
consult read the whole set or only part of it, and which files it clipped or never held — and then
the command, over every path and quoted, since a pass that covers six of thirty earns nothing while
looking as though it did. What it does not say is that nothing further is *owed*: that is the
contract's ruling and it turns on whether the tree has moved since, which the log cannot see and the
run can. Three rounds of review each found another way a CLI asserting it would be lying.

**An open stdin is not an intent that has not arrived yet.** The consult reads its intent from
stdin, and inside a harness the shell's stdin is a pipe nobody is writing to: read to EOF, it never
returns. Two consults ran 17 and 13 minutes on 2026-09-03 and were killed by pid, which is the
largest single round a dry run has lost. What is bounded now is silence rather than the whole read —
two seconds before the first byte and between any two, ten for a payload a verb cannot proceed
without — because a producer that writes one byte and stalls is the same unbounded wait. A silence
after bytes have arrived is a refusal and never a short payload: a plan read in half would be stored
as the plan. The line naming what the consult is about to do prints before the read, so a stall says
where it is.

**Asked for a diff and given nothing, the tree answers.** `--diff` with no file named and nothing
pending answered "nothing to consult on", and what an author then did was run `git diff --name-only`
and type the list back. The names come from there now and are printed on stderr, so the review's
scope is legible without a second call. A deletion is among them, and so is an untracked file: the
diff step used to pass over a path that is not on disk, which named the file and said nothing about
it, and `git diff` never lists a file git has not been told about, which a turn's new file always
is.

**A base is read from where the branch left it.** `--base master` diffed against the ref as it
stood, so a base that moved under the run — master taking another run's release mid-branch —
presented the other side's commits as this branch's: ISS-117's review raised two findings on code
the branch never touched, which the record now reads as two judgement calls. A named ref is read
from the point it and HEAD parted. The working tree stays the other side, which is where this
departs from the `<base>...HEAD` the report asked for: three dots make HEAD the other side, and a
tracked file edited and not committed then travels in no diff at all — a reviewer told nothing
changed in the file whose newest edit it never saw is worse than the bug. A recheck's anchor is
exempt, being a head this end chose: after a rebase it is off the history, and the parting point
would widen the diff past the findings the round exists to close. The log records the point diffed
from rather than the name, so `replay` rebuilds what was sent.

**A recheck's range is the range it is rechecking.** A ref is a fixed point that ages: between a
consult and its recheck the base holds still and the head does not, and a rebase and a ship guarantee
it, so the same `--base` names a wider set each time. A 15-file review was rechecked over 38 — the
other 23 another run's landings — and one character budget spread over the wider set sent 18 clipped,
every source file the recheck was about among them. So where no file is named the range comes from
the consult being answered, which recorded one, and the line saying so carries both counts: what a
widened range hides is never the file list, which prints, but the cause. It only ever drops, and a
path typed on the command line is not narrowed at all — a caller who named it asked for it. The
refusal is asked before the narrowing and against the set the caller stood on, since a route out has
to name files they can act on. The effort level is not a symptom of any of this: a recheck steps one
below the base whatever the diff's size, so what moved with the range was the call budget, which
rises with every clipped file.
