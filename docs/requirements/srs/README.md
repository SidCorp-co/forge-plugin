# SRS — Software requirements (index)

**Product:** forge-plugin · **Source:** the documents this specification numbers —
[`CLAUDE.md`](../../../CLAUDE.md), [`README.md`](../../../README.md),
[`docs/FORGE-CLI.md`](../../FORGE-CLI.md), [`docs/HOOKS.md`](../../HOOKS.md) and
[`docs/issue-flow-contract.md`](../../issue-flow-contract.md).

Each file is one section, and the section numbers are kept so a reference to a section by its
number still resolves. The intent behind these clauses is the [BRD](../brd/README.md); the rules every file
obeys, the notation's home and the reason a person reads a page instead of this tree are in
[../README.md](../README.md).

## The general sections

*Where does a reader start?*

| § | File | Contents |
|---|---|---|
| 1 | [01-introduction.md](./01-introduction.md) | purpose, the notation of the whole tree, what this specification leaves to others |
| 2 | [02-system-overview.md](./02-system-overview.md) | the parts, the actors, what holds the state |

## The functional requirements

*Which capability is specified where?*

| § | Requirement | File |
|---|---|---|
| 3 | FR-01 Account and project resolution | [fr-01-resolution.md](./fr-01-resolution.md) |
| 4 | FR-02 The tracker surface | [fr-02-tracker-surface.md](./fr-02-tracker-surface.md) |
| 5 | FR-03 The lease | [fr-03-the-lease.md](./fr-03-the-lease.md) |
| 6 | FR-04 Typed records | [fr-04-typed-records.md](./fr-04-typed-records.md) |
| 7 | FR-05 Earned transitions | [fr-05-earned-transitions.md](./fr-05-earned-transitions.md) |
| 8 | FR-06 The second opinion | [fr-06-second-opinion.md](./fr-06-second-opinion.md) |
| 9 | FR-07 The gate harness | [fr-07-gate-harness.md](./fr-07-gate-harness.md) |
| 10 | FR-08 Irreversible commands | [fr-08-irreversible-commands.md](./fr-08-irreversible-commands.md) |
| 11 | FR-09 The learning gates | [fr-09-learning-gates.md](./fr-09-learning-gates.md) |
| 12 | FR-10 Comments read before a write | [fr-10-read-before-write.md](./fr-10-read-before-write.md) |
| 13 | FR-11 The project's own code rules | [fr-11-project-code-rules.md](./fr-11-project-code-rules.md) |
| 14 | FR-12 The documentation gates | [fr-12-documentation-gates.md](./fr-12-documentation-gates.md) |
| 15 | FR-13 Natural Vietnamese | [fr-13-natural-vietnamese.md](./fr-13-natural-vietnamese.md) |
| 16 | FR-14 The requirements tree | [fr-14-requirements-tree.md](./fr-14-requirements-tree.md) |

The use cases of each requirement are listed in its own file and nowhere else, so no second list
can disagree about what a requirement holds. The table a reader wants — requirement, use case,
criterion, the issues citing each and the verdicts that passed — is rendered by ISS-29 into
[traceability.md](./traceability.md).

## The closing sections

*What is left after the capabilities?*

| § | File | Contents |
|---|---|---|
| 17 | [17-nfr.md](./17-nfr.md) | the non-functional requirements |
| 18 | [18-data.md](./18-data.md) | the fields and files this product owns |
| 19 | [19-external-interfaces.md](./19-external-interfaces.md) | every interface it crosses |
| 20 | [traceability.md](./traceability.md) | generated; the placeholder says by what |

## The business rules

*Where are they, and why not here?*

In [../brd/04-business-rules.md](../brd/04-business-rules.md), which holds the sequence: each rule's
name and the document that states it. The sibling trees this one learned from keep
that table in the SRS index because neither has a BRD; here it would be a second copy, and the map
from a rule to the requirements enforcing it is rendered rather than kept (../README.md records both
deviations).
