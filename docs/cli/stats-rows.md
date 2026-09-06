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

Two verbs earn a row per action, because their actions cost differently: a consult against a
recheck, a verdict against the other records. Writing a file earns a row per route — edit tool, write
tool, heredoc, whole-file redirect, `sed` — because one change carries a different number of characters
by each, and the `edits` line puts that number beside the route. The `ships` line counts a landing's
passes, resumes and rejected pushes: a landing that raced a sibling's paid the gate twice. Every
other verb is one row.

## The phase table

Phase boundaries are read off the first call of each kind, because no run writes a phase into its own
transcript — and off the **class** the call already carries rather than a second set of patterns, so
the two cannot disagree about what a call was. A phase already passed cannot pull a run backwards,
the review does not open before the build has — the plan is consulted before it is written, and that
consult is the plan's — and the ship call is the last call of its own phase rather than the first of
the next.

Each of those last two rules is declared on the marker row it constrains rather than beside the cut
it makes, so a phase number is written once. Renumbering a phase then moves the cut with it; a
second copy of the number would go on matching a phase that had moved, and two places that agree by
coincidence look exactly like two places that agree.

Each phase's minutes and calls are medians **over the runs that entered that phase**, with the count
of those runs beside them. A median over the whole window reports a phase most of it never reached as
costing nothing, which is the opposite of what it costs the runs that do reach it — and on this
corpus that read the judging phase as zero minutes and zero calls while a third of the runs were
spending five minutes there.

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
