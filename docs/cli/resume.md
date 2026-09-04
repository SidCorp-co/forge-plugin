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
verdict mark, one line each of the latest confirmation, decision and correction, the worklog, the
parks and the blocking edges with the kind of each and whether it holds the status back — one
answer, the entry check's own, never worked out a second time for the screen — the command the next
status is owed in the same words `advance --owed` uses and from the same function, and the path of
the reference holding that phase's method. `--json` is the assembled object the screen was printed
from, so a tool and a reader cannot be told different things.

Two smaller measurements. A section with nothing in it is left out, not printed empty, which is what
made the brief fit a screen at all. And the comments it reads are not shown as themselves: the typed
kinds are, one line each, so a plain comment a person left reaches nobody through this verb. It
therefore credits nothing to the read-before-write rule, which delivers the bodies in its own
refusal instead — a digest of the record is not the record.
