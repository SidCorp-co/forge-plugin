# `stats runs` — the refusals a window met, and the other errors beside them

What this verb reads and what a wait is: [`stats.md`](stats.md). The classifier the rows below are
keyed by, and the wrong rows it was built to avoid: [stats — the rows](stats-rows.md).

A row is a line one of this plugin's own refusals was written in, and the row is the line that
**names the rule** — so the listing reads as which rules fire and how often. Four shapes, each read
off the source that writes it: a gate's `Hold —` or `Refused —` opener (`Refused.` in older logs),
the `How:` line every gate's refusal ends with, a tracker refusal's `<name> refused:` with its reason
inline or on the next line, and a verb's own refusal sentence, which opens with a verb this CLI has.
A gate's refusal leads with its route, so for a gate the row is the route line, which is as much
one rule's as the shape line was; a window spanning the change reads one rule under two rows. Where a body carries more
than one, the last is the row: a `forge` command prints its provenance banner before it refuses, and
keying on the body's first line filed 187 of those banners under a row that named nothing.

**A marked line beats a verb sentence wherever each of them sits**, which is a precedence rather
than an ordering, and it has a cost either way. A marked refusal quotes the lines it was refused
over, and those quotations read as verb sentences: taking the last of both filed 73 of the 76 runs
that met the issue-shape refusal under a line from inside that refusal's own body. The cost paid
instead is the mirror case — a chained call that printed a marked line it was only reading, then met
a verb-sentence refusal of its own, is filed under the line it was reading.

Two of the four are read off the call's exit code as well. The verb sentence, because a line an
*answering* call printed looks exactly like one — `project id: …` opens with a verb too. And the
`How:` line, which counts only where it is the body's **last** line on a call that failed: a gate's
denial is the whole result the harness returns and ends there, while a document or a test's output
quoting one goes on printing past it, which is fourteen of the 516 bodies carrying that line.

The two openers and `<name> refused:` count however the call exited. A run that pipes a refusal
through `tail`, or ends the line with `; echo EXIT=$?`, met it just the same and the shell answered
0 for it; on this corpus that is 411 refusals of 813.

**The reading is of shape and never of provenance.** A body that merely quotes a refusal it did not
meet is one this listing cannot tell from one that met it; seven of the 813 above are that. And a
refusal written in none of the four shapes — the hook harness running out of time, a missing
endpoint, a missing project slug — is counted with the other errors rather than dropped.

Those other errors are one line, broken down by the class of the call that exited non-zero. Read as
refusals they were six of the listing's top ten: a test's failure line, a `grep` that matched
nothing, a `-h` read whose help text carries the word, an issue body that does.

Two more rows sit beside these and are neither: a compaction and an API error are a run's own
condition rather than a call this plugin made, refused, or judged — [stats — the
condition](stats-the-condition.md).
