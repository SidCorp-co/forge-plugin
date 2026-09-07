# `stats runs` — the rows the profile prints, and what each one is

What this verb reads, where its corpus comes from and what a wait is: [`stats.md`](stats.md).
Every row below is one this reading had to be taught, and the paragraph is the argument for it.

## The classifier, and the wrong rows it was built to avoid

The classifier is one table read top to bottom, and each correction below is a row a hand profile
got wrong:

- **A heredoc carries a document, not shell.** The criteria and plan files a run writes name
  `npm run check` in their text; read as commands, 423 of them counted as gate runs that never
  happened. The body is cut before the line is classified.
- **A word after the binary's name is not a verb.** Taken on trust, a heredoc mentioning the tool
  minted a class for whatever word came next, and a binary behind a shell expansion minted one for
  the expansion. What follows has to be a verb this CLI has, and the verb reached by path and by
  name is one row.
- **A bare space is not a command position.** Every row is anchored where a command actually
  starts — the beginning, or after one of the separators, with an assignment or a short list of
  leading words allowed in between; read as one, a space made an echoed reminder into a record and
  a search argument into a claim, each opening a phase the run had not reached.
- **A mention of a ship is not a ship.** A run waiting on one polls for the process by name; read
  as the invocation, that line moved every such run into its closing phase.

Two verbs earn a row per action, because their actions cost differently: a verdict against the other
records, and a consult in the three shapes it comes in. The whole-set read that earns a review, the
consult a commit gate asks for over what a commit stages, and a recheck are one verb and three
costs, and folding them left the review's own read indistinguishable from the build's. Which of the
three a call was is read off the flag its command line carries. A `codex.send` setting in a user's
configuration makes a bare consult a whole-set read too and no transcript records that, so on such a
run it is the whole-set read that is filed as an ordinary consult — and the review boundary it would
have opened is the one that goes missing. Writing a file earns a row per route — edit tool, write
tool, heredoc, whole-file redirect, `sed` — because one change carries a different number of characters
by each, and the `edits` line puts that number beside the route. The `ships` line counts a landing's
passes, resumes and rejected pushes: a landing that raced a sibling's paid the gate twice. Every
other verb is one row.

## The phase table

**The rows are the method's phases, as `forge guide issue-flow` numbers them, and that table is the
only one.** Phase boundaries are read off the first call of each kind, because no run writes a phase into its own
transcript — and off the **class** the call already carries, so two readings of one call cannot
disagree about what it was. A phase already passed cannot pull a run backwards,
the review does not open before the build has — the plan is consulted before it is written, and that
consult is the plan's — and the ship call is the last call of its own phase rather than the first of
the next. A boundary is the write that discharges the phase before it, so a row holds its own work.

**The review opens on the read that earns it and on no other consult.** A build commits several
times and each commit is gated by a consult over what that commit stages, so a boundary drawn at the
first consult after the build began was drawn at the first commit: on this project's own corpus that
row carried 429 gate runs and 991 test runs beside its consults, and a rise reported there was the
build's tail moving, not the review's cost.

Each of those last two rules is declared on the marker row it constrains rather than beside the cut
it makes, so a phase number is written once. Renumbering a phase then moves the cut with it; a
second copy of the number would go on matching a phase that had moved.

Each phase's minutes and calls are medians **over the runs that entered that phase**, with the count
of those runs beside them. A median over the whole window reports a phase most of it never reached as
costing nothing, which is the opposite of what it costs the runs that do reach it — and on this
corpus that read the judging phase as zero minutes and zero calls while a third of the runs were
spending five minutes there.

## The refusals listing, and the other errors beside it

A row is a line one of this plugin's own refusals was written in, and the row is the line that
**names the rule** — so the listing reads as which rules fire and how often. Four shapes, each read
off the source that writes it: a gate's `Hold —` or `Refused.` opener, the `How:` line every gate's
refusal ends with, a tracker refusal's `<name> refused:` with its reason inline or on the next line,
and a verb's own refusal sentence, which opens with a verb this CLI has. Where a body carries more
than one, the last is the row: a forge call prints its provenance banner before it refuses, and
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

## The tier table

The ladder's rungs are what a change's cost is meant to differ by, so the profile groups by them: a
row per rung and one more for the runs that claimed none. What a rung *drops* is three payloads and
visible in the record; what it *saves* is rounds, and rounds are only ever visible here. That is the
whole reason this table exists — without it the two rungs below `feature` differ in nothing a reader
can act on, and the next change to the ladder would be argued from memory.

A run's rung is read off **the confirmation it wrote**, which carries it as a `derived` field: the
write fills it from the issue's own description and refuses it as a flag, a value the author could
type proving only that they typed it. It is a copy for this table and never a source — every entry
check reads the description — so a hand-written confirmation lacking the line is refused nothing and
one claiming a rung the description does not moves no status.

The call's own class picks which call to read, and the record inside its output says which line is
that write's. A `forge issue` or a `forge resume` printing the same thread carries the line too, and
read from those a run is filed under the rung of whatever issue it happened to open; so does anything
the same shell call printed after the write, which a class covering the whole call cannot tell apart.
A run that confirmed nothing is `untiered` and keeps its own row: folded into a rung it would flatter
that rung, and dropped it would leave a table that quietly counts fewer runs than the profile above
it.

**A batch counts at the largest rung among its members.** A run carrying three issues is as
expensive as its heaviest, and filing it under the cheapest would make every rung look better the
more work was batched onto it.
