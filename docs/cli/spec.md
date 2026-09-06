# `spec` — a clause answered by its identifier, and the storage known once

One file per requirement, one per section of business intent, and an agent implementing a clause
found it by searching for words. `forge spec` takes an identifier and prints the clause with
everything under it, so the day this reads a tracker's API instead of a checkout, no caller
changes. Keying on an identifier holds only while no two documents define one, which is why the
reader names both and refuses rather than choosing, and why it was run over every document of this
project's tree and not over fixtures alone — a fixture proves the notation, never the tree. The one
path it prints is the one `--where` asks for, and a developer asks for it to go and edit the file.

Three readings the notation admits were narrowed rather than guessed, and each cost a case that
fails without it. **Emphasis is what separates a defining row from a reference to one:** every
requirement file closes with a table naming the rules it carries out in a plain cell, so a reader
that took a plain cell for a definition made every business rule ambiguous once over for each
requirement naming it. **A criterion under a non-functional requirement is numbered from its section**, not from a
requirement, so arithmetic on `AC-17-2-1` names a requirement that was never written and the
enclosing clause answers instead. **A business sequence may keep no revision column at all**,
so a citation of one is answered with that fact rather than called stale.

The clause a citation was written against is decided by a digest of the clause's own words with
its markup gone — a reflowed paragraph is the same clause and a reworded one is not. It is printed
and never stored here: the file that records a digest per revision is the gate's, and a second
place writing it would be a second answer. A revision that has moved is reported *stale* here,
because *suspect* is spoken for — a citation whose recorded digest disagrees is the gate's word,
and the two failures are not the same one.

The prose that follows the last criterion of a requirement file belongs to no clause. Under the
tree's own boundary rule it would attach to that criterion, which would move the criterion's digest
whenever an unrelated closing section changed, so it is left where a page renderer can pick it up.

## The tree read against its own rules

`forge spec check` is the other direction: not one clause answered, but every rule the tree's index
states, held over every document. Two projects here kept those rules in prose and relied on a reader
to hold them; each drifted at least once, and one had to add a traceability column to find what it
had missed. So the rules are stated once — in `docs/requirements/README.md`, one row each, in the
form a checker holds — and the check names the row rather than restating it, because a rule with two
homes is a rule nobody corrects the second copy of.

Three decisions made that possible, and each is why the check is small. **The reader answers the
clause-level questions**, so nothing here parses a clause twice; what the check needed and the index
does not keep is the document text, for the line a finding sits on and for the table rows and
headings no clause holds. **The section table is read, not copied**: a row whose parts each open
with a code span declares those headings in that order, which is why a row naming a clause rather
than a heading declares nothing rather than a section called `NFR-`. And **the placeholders in a
document row stand for a segment of the path** — read literally, `fr-NN-<slug>.md` matches the one
file nobody wrote, and the rule is green over every requirement in the tree.

What it will not judge is whether a clause is right. That division is the tree's own and not this
verb's: a gate that asked would refuse honest clauses and pass dishonest ones. A project keeping no
tree gets silence and a zero rather than a refusal, since this runs in repositories it cannot see
and a project that has not decided is one this says nothing about.

**The one rule that compares two moments needs an artifact, and `forge spec check --record` is what
writes it.** What the record holds, where it lives and what an author does about a clause it no
longer matches are R-10's, stated once in the tree's own index. Two things about it are this verb's.
**It is JSON and not a document:** the walk that reads the tree takes only `.md`, and a record whose
rows carried identifiers would define every clause a second time and leave the whole tree ambiguous.
**And the flag is typed, never spent by a suite:** the gate step runs the check and writes nothing,
so the record moves when an author moves a clause rather than underneath a green run. *Suspect* is
that comparison's word, which is why *stale* above is a different word for a different failure.

One rule of the tree is still not held here and says so in its own row: the overlap measure that
would catch a clause restating its source's argument cannot see a table cell, where a restated rule
in this tree would most naturally sit (ISS-526).

## A citation read at a write

`forge plan` and `forge record criteria` resolve what they are handed before either sends anything. The reader is the same one the
verb above is, so a plan and a `spec` call disagree about no clause; what differs is the audience,
and so the sentence — a reader who asked for one clause is told it is stale and stops, an author
still holding the file is told which revision to write instead.

Two boundaries decide what that check may refuse. **A citation is `<id>~<rev>`, and an identifier
written without one is not one:** it makes no claim a checker could fail, R-10 is what wants the
revision, and the recorded digest the gate compares is keyed on one, so a bare identifier that names
a real clause is said and the plan is written. **A project that keeps no tree
reads nothing:** this runs in repositories it cannot see, and `documents()` refuses outright where
there is no `docs/requirements/`, which is the right answer to somebody who asked for a clause and
the wrong one to somebody who asked to write a plan. The predicate that separates the two is
`hasTree`.

**A plan is read whole and a criterion only where it opens.** AC-14-4-1 says *opens with*, and the
narrowing pays for itself immediately: a criterion is the one field that talks about identifiers as
often as it makes claims about them, and this repository has already stored one saying what the
reader answers for a rule of the index. Read whole, that criterion would be refused for quoting the
example it exists to name. So a reference before the criterion's first colon is a claim and is
resolved; the same reference three words later is prose and settles nothing. A plan has no opening,
which is why it is still read whole and why quoting an identifier in one costs an author a refusal.

**And an issue names a clause before it is approved.** Where the project keeps a tree, `forge
advance` refuses `approved` until the description, the plan or the criteria names a clause that
resolves — resolved at the transition and not recognised, since a prefix and a revision make an
identifier and not a clause. There is no escape and none is coming: a use case nothing can cite is
one AC-14-7-1 sends to a specification-change issue, and a run that writes its own exemption is the
second home for a rule that this tree exists to prevent.

The rules of the tree are identifiers to that check and citations to nothing. `R-10~1` has to reach
the writer — it is a reference worth refusing, since a rule of the tree's own index is not a clause
of the specification — and it must never reach `citationsIn`, whose answer every clause hashes. So
`identifiersIn` spans both sets and `citationsIn` is that list filtered back to a clause prefix,
which is the boundary the one regex it replaced drew by being built from the clause prefixes alone.
