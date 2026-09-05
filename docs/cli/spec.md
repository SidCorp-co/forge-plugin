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
and never stored: the file that records a digest per revision is the gate's (ISS-27), and a second
place writing it would be a second answer. A revision that has moved is reported *stale* here,
because *suspect* is spoken for — a citation whose recorded digest disagrees is the gate's word,
and the two failures are not the same one.

The prose that follows the last criterion of a requirement file belongs to no clause. Under the
tree's own boundary rule it would attach to that criterion, which would move the criterion's digest
whenever an unrelated closing section changed, so it is left where a page renderer can pick it up.

## A citation read at a write

`forge plan` resolves what a plan cites before it sends anything. The reader is the same one the
verb above is, so a plan and a `spec` call disagree about no clause; what differs is the audience,
and so the sentence — a reader who asked for one clause is told it is stale and stops, an author
still holding the file is told which revision to write instead.

Two boundaries decide what that check may refuse. **A citation is `<id>~<rev>`, and an identifier
written without one is not one:** it makes no claim a checker could fail, R-10 is what wants the
revision, and the gate that would compare the recorded hash has not shipped (ISS-27), so a bare
identifier that names a real clause is said and the plan is written. **A project that keeps no tree
reads nothing:** this runs in repositories it cannot see, and `documents()` refuses outright where
there is no `docs/requirements/`, which is the right answer to somebody who asked for a clause and
the wrong one to somebody who asked to write a plan. The predicate that separates the two is
`hasTree`.

The rules of the tree are identifiers to that check and citations to nothing. `R-10~1` has to reach
the writer — it is a reference worth refusing, since a rule of the tree's own index is not a clause
of the specification — and it must never reach `citationsIn`, whose answer every clause hashes. So
`identifiersIn` spans both sets and `citationsIn` is that list filtered back to a clause prefix,
which is the boundary the one regex it replaced drew by being built from the clause prefixes alone.
