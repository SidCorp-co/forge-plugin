# `resume` — one issue's whole context, re-minted from what the last run wrote

ISS-26's shell died mid-review. What made the recovery cheap was luck: a file the dying run happened
to write to the one mount that still took writes, naming the branch, the head, the codex round and
the step it was on. The record held everything that had *earned* a status and nothing about the run
between two of them, so without that file the successor would have re-read the tree, re-run the
consult and guessed the rest. `forge resume` and the worklog beside the lease turn the luck into a
mechanism.

**The worklog is a sibling of the lease in the field the issue already has**, so it rides the same
whole-field compare-and-set with no second write path and no new field. It holds the branch, the
head, the base and the files touched, with the time they were read; the last codex consult with its
findings and what it owes; and a capped list of one-line dead ends, the oldest dropped aloud when a
new one arrives. Nothing in it earns a status — the record still does that, and a fact in the
worklog that a check needed would be a fact in the wrong place.

Three flags write it, on `forge claim` and on any `forge record` kind that writes: `--pushed` reads
the git block, `--review` reads the consult log, and `--open` appends a line. What `--pushed` captured
is one line at the write — branch, head, base, and how many files — because two captures that wrote a
complete block printed nothing but the lease renewal, and their author ran `forge resume` to find out
whether the flag had worked. A capture with nothing in it says which of the four reasons held, and
leaves the block an earlier capture wrote: that block carries the time it was taken, so it is a true
statement about an earlier push rather than a stale one. **None of them is
automatic, and that is a decision rather than an omission.** A renew is made from wherever the shell
happens to be, and a write from another checkout would name that checkout's branch as this issue's,
or another project's review state as this one's. So the flags name the moment a run knows the values
are true, and a forgotten one costs a stale field the brief prints with the timestamp it was
captured at. Git and the log are read at the write and never at the read: the brief prints what a
run wrote, because a brief that consulted the repository would answer differently on every machine.

**The round is the consult id, not an ordinal.** The issue asked for a round number and the log has
no round in it — only consults, rulings and verdicts. A number would have needed a streak rule that
lived in one function and nowhere a reader could check it, so the block names the consult, whether
it was a recheck, how many findings it made and whether a verdict or a recheck is owed. `forge codex
log --id <id>` expands it.

**`forge resume ISS-nn` writes nothing and takes no lease**, so a person, a supervising run or the
holder itself may all read it; the printer and the brief import none of the writing functions, which
is what a case asserts rather than a comment claiming it. It prints, in reading order: the status
with the phase it owes, the plan bounded with a pointer to the whole field, every criterion with its
verdict mark, one line each of the latest confirmation, decision and correction with a count of any
kind holding more than one under them, the worklog, the
parks and the blocking edges with the kind of each and whether it holds the status back — one
answer, the entry check's own, never worked out a second time for the screen — the command the next
status is owed in the same words `advance --owed` uses and from the same function, and the path of
the reference holding that phase's method. `--json` is the assembled object the screen was printed
from, so a tool and a reader cannot be told different things.

`--report` is the other end of the same reading: every record whole rather than one line of each,
the latest verdict per criterion with its evidence, the plan, the release note and what is owed. It
lives here rather than under `record` because it writes nothing, and a verb whose every other name
posts a payload was the wrong home for the one that only reads — a reader reached for the writing
verb to make a read, and the refusal that told it so had to exist. The brief and the report are one
verb's two depths, and `--json` and `--report` are separate readings: asking for both is refused.

Two smaller measurements. A section with nothing in it is left out, not printed empty, which is what
made the brief fit a screen at all. And the comments it reads are not shown as themselves: the typed
kinds are, one line each, so a plain comment a person left reaches nobody through this verb. It
therefore credits nothing to the read-before-write rule, which delivers the bodies in its own
refusal instead — a digest of the record is not the record.

## The phase owed leads it, and the index behind it

A run handed an issue past `open` used to read a method that opens at Phase 0 and replay what the
record already held — this issue's own run did exactly that, replaying Phases 0 and 1 on an
`approved` issue. So the block above the body now opens with the phase owed and one line saying the
phases before it are read off the record rather than run again, each one naming the record that
discharged it. The header carries which phase; the line under it carries what to do with the rest.

That was not enough, because the workflow claims before it reads: a run told to take the issue
before its first write saw the method for the phase ahead and nothing about the record behind, and
the one run that resumed correctly did so because a person had said the record was there. So the
same lines print on the claim, from the one renderer this verb prints them with — two renderers
would disagree about one record the first time a row moved, which is the whole of why there is one.
They are silent where nothing is behind the status, so an issue at `open` says on both verbs what a
claim there always said.

`forge guide issue-flow --for ISS-nn` prints the same cut whole, and it is where the shape lives:
every phase, every drop and every citation is read off a table some other reader already answers
to — the flow table's phase column, the entry checks beside it, the ladder's lightening rows. An
index holding a phase list of its own would say a phase is owed where `forge advance` says it is
not, and the two would drift the first time a row moved.

Two shifts in it are worth stating, because both were wrong first and a reader will otherwise
reintroduce them. A phase is the work owed *at* a status while an entry check guards the way *into*
one, so a phase is discharged by the rung above it: citing its own status names the evidence for the
step before, and sends a successor to the wrong record. And a tier's lightening is a waiver on a
transition, never on a phase — the ladder drops the plan on the way into `approved`, which does not
drop the implementing. An index reading the second as the first tells a fix-tier run its work is
done, so a waiver is printed against the phase that pays it, in the ladder's own words, and the
phase stays owed. The one table added is which record discharges which status, held to the entry
checks by a case that reads their refusals: a status with a check and no record named against it
would print a phase discharged by nothing, and a row naming the wrong kind is the same defect
wearing a value.

`--for` is the only part of a guide's answer that is not on this disk. So it is answered where the
tracker is already reached and not by the guide registry, which stays offline: asking for a slug's
text still costs no call at all, and the cut costs the issue and its comments — the same reads this
verb already makes, which is why it is assembled here rather than twice.
