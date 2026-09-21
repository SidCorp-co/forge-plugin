# `stats runs` — the help reads, and the looser reading that was not taken

Every verb's `-h` is a text this CLI serves on demand, and it is the biggest of them: over this
project's own corpus of 581 runs, 4,867 of the 44,261 calls made to this CLI asked for one, against
2,843 reads of a guide part — the other text served on demand, and the only one that had a table.
Nothing reported any of it until this one.

**Why the class table cannot report it.** A call asking what a verb takes and a call using that verb
are classed alike, because the classifier reads the word typed and never a flag
([`stats-rows.md`](stats-rows.md)). That is right for what the class table is for — tool time by
kind — and it leaves every per-class figure a mixture no reader can separate. It also left the
largest served text in the harness with no demand signal at all: a second read of one guide part is
reported as a part somebody had to go back to, and the same fact about a verb's help reached nobody.
So the reads get their own rows, carrying the guide parts' three columns at the same widths so the
two can be held against each other, and the profile carries a line saying what share of the calls
made to this CLI were lookups. The class table's own meaning is untouched, which is what that line
is there to qualify.

## A read is the slot that answers, not the word wherever it sits

`plugin/src/resolve/help-word.mjs` answers a help request in two places and nowhere else: directly
after a verb, and directly after a verb and the subject that verb has. Those two are therefore the
whole of where a run was ever given help, and they are what this reading looks for — reached by
path, from the far side of a pipe, or after a `cd`, all of which the same anchor every other row
uses already allows.

The alternative was to accept the word anywhere in a `forge` command line, and it is worth saying
what that would have bought. Over the same calls it counts 5,598 against this reading's 4,867. The
731 between them are not reads: a `-h` typed into the prose of a `--why` or a `--note`, one sitting
in an evidence filename, one glued to a longer word or to a value, and one standing past a subject
where the verb answers with a refusal rather than with its usage. Every one of those would print as
a run going back to text it never read, and this table exists to report exactly that.

The row a read is filed under is the row the classifier gives that same verb, so the two tables name
one thing one way, and a subbed verb keeps its sub — the help for writing a verdict is read far more
than the help for writing a park, and one `forge record` row would hide it.

**Two things the reading deliberately does not check.** It does not ask whether the subject is one
that verb has: nine verbs each declare their own list and none of them is reachable from here, and
the classifier already mints a row for a subject no verb carries, so checking it would make the two
tables disagree about the very thing they are put side by side for. A run that typed a subject wrong
and got a refusal is therefore counted as having read that row's help — four reads of the 4,867 on
this corpus, all of them under `forge record`. And it does not look for a read on a call it classed
as something else: a line whose first command position holds a project's declared gate takes the gate
row, and a read counted off that line would be a numerator standing outside the denominator it is
quoted against. Fifty-seven reads go uncounted for that on this corpus, which is the price of the two
figures being a share at all.

## What the table does not say

Whether the read was worth making. A transcript records that a run went and looked; it holds nothing
about what the run came away with, so a verb at the top of these rows is one whose text is reached
for and never one whose text is poor. A second read inside one run is the strongest thing here and
it is still only that: somebody went back. Which of the two it was stays a person's reading of the
text itself, and no figure will settle it.
