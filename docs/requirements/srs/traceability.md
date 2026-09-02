# SRS §20 — Traceability

**Status: proposal for `forge spec`.** Nothing below is written by hand.

← [Index](./README.md) · [§19 External interfaces](./19-external-interfaces.md)

## What belongs here

*What will this section hold, and who puts it there?*

One generated table: each business rule, the requirements that enforce it, their use cases, the
acceptance criteria of each, the issues that cite them, the status of those issues, the commit of
the passing verdict, and the requirement's derived status. Beside it, two lists that are the point
of the exercise — clauses no issue cites, and issues citing no clause.

It is rendered by `forge spec trace` (ISS-29), from this tree read through the reader (ISS-26) and
from the tracker read through the CLI. It is a report and never a gate, because it needs the
network.

## Why nothing is listed here yet

*Why is a hand-written table worse than an empty one?*

Because the tracker already knows every fact such a table would hold, and a copy of a known fact
is a copy that drifts. One of the trees this one learned from keeps its trace table by hand and had
to add a column to find what the table had missed; the roll-up count beside it was a second copy of
the same thing, and both disagreed with the tracker. A requirement's status here is **derived** —
implemented when every criterion of it has a passing verdict at the merged commit of a closed
issue, verified when a person's review passed too, partial otherwise — and no field stores it.

Until the verb exists, the way to ask what implements a clause is to search the tracker for the
identifier. That is worse than a table, and it is honest about being worse.
