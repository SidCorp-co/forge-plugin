# `spec --status` — a clause read backwards, and the rung its issues have earned

`forge spec <id> --status` is the other direction again: not which clauses an issue names, but which
issues name a clause, and what their verdicts have settled about it. It is the one call this verb
makes, and it is behind a flag because a default that reached the tracker would put a network round
trip inside every write that resolves a citation.

**The set is a search narrowed, not a store walked.** There is no citation store: a label cannot be
created from here, and a walk of every issue is not a route on a project that answers `hasMore` at
the token cap on a single status. What there is, since the tracker indexed the plan and the criteria
fields, is a search that reaches a citation wherever it was written, and answers each row with the
field it matched. So the set is obtained by asking the index for the identifier and then resolving
each row's own three fields against the tree — the search decides the candidates and the tree decides
the answer, because an index matches text and only a clause resolves.

**The ask is per clause, and the saving is deliberately not taken.** The index appears to narrow on
each part of an identifier, so `AC-14` answers a superset of `AC-14-4`, which answers a superset of
`AC-14-4-3`, and one ask would do for a whole requirement. Three nested sets are consistent with that
and do not establish it, and the tracker states no such semantics. If it does not hold, the set comes
back silently short and a clause somebody implemented reports as one nobody claimed — which is worse
than the twenty-one asks it saves on a requirement this size. So a requirement costs one ask per
criterion under it, a figure the specification sets and the backlog does not, and they go out
together.

**A reading that came back short earns no rung at all.** A clause nobody has claimed and a clause
whose issues this did not reach answer alike, and only one of them is true, so the count is said and
nothing is derived. The same reason the walk ends on `hasMore` and never on a short page — and the
same reason a prover whose own record came back a prefix costs the clause its rung too: a thread
holding a pass and stopping before the fail after it would earn a rung the record never gave.

**What proves a clause is a criterion, not an issue.** AC-14-4-1 says *opens with*, and that boundary
reads the same backwards: an issue naming a clause in its description or its plan has claimed it and
settled nothing, while a criterion opening on it is a claim a verdict can answer. So a clause is
implemented where a closed issue opened criteria on it and every one of them has a passing verdict at
a head its merged mark lets a verdict cite — three claims about one clause with one of them failed is
not a proof of it. Which heads those are is not decided here: it is the rule the mark already states
for the rung, that a verdict stands at the sha the change landed at always, and at the head the
verdicts judged only where the landing moved none of this change's own paths. An issue that only mentions the clause is still named as citing it, and
demotes nothing another issue proved.

**Verified is an affirmative answer about the person's look, never an absent one.** A plan that
declared a screen and a park nobody answered is a look not taken, which is not a look passed, and
that leaves the clause at *implemented*. A plan that declares no screen and no user-facing outcome
has answered that nobody was owed one; a plan that answered neither question has said nothing, and
an absence is not that answer. The rung above would otherwise be unreachable on a project
that renders no screen, which is a word no reader would ever see.

The requirement stands at the lowest rung any clause under it took, and at none where any was cut.
Nothing stores any of it: it is computed at the read, which is what AC-14-4-3 asks for, and a field
holding it would be a second answer going stale the moment a verdict landed.
