# SRS §1 — Introduction and notation

← [Index](./README.md) · Next: [§2 System overview](./02-system-overview.md)

## Purpose

*What is this document for?*

To state, clause by clause under a citable identifier, what forge-plugin does — so an issue can
name the clause it serves, a verdict can name the criterion it judged, and a report can say which
requirements are implemented without anyone counting. The intent behind the clauses is the BRD's:
[brd/README.md](../brd/README.md).

The audience is an agent and a reviewer. A person reads the page rendered from this tree, not the
tree — [../README.md](../README.md) says why, and that document also holds the rules every file
here obeys.

## Notation

*How is a clause written, and how is one cited?*

**Identifiers.**

| Form | What it names | Where it is defined |
|---|---|---|
| `FR-05` | a functional requirement, one per file, one per capability | `srs/fr-05-<slug>.md` |
| `UC-05-3` | a use case of `FR-05` | the file of its requirement |
| `AC-05-3-2` | an acceptance criterion of `UC-05-3` | under its use case |
| `BR-09` | a business rule, one sequence across the product | `brd/04-business-rules.md` |
| `NFR-04` | a non-functional requirement | `srs/17-nfr.md` |
| `EI-02` | an interface this product crosses | `srs/19-external-interfaces.md` |

An acceptance criterion is one token rather than the two-part `UC-05-3 AC 2`, so it sorts, greps
and renders as a column without a parser.

**A field line** carries everything a machine reads. It is the first non-blank line after a
clause's heading, and it holds `Key: value` pairs separated by `·`:

| Key | On | Value |
|---|---|---|
| `Rev` | every clause | an integer, 1 at first writing, bumped when the obligation changes |
| `Actors` | a requirement, a use case | who acts, from the actor list in [02-system-overview.md](./02-system-overview.md) |
| `Enforces` | a requirement, a use case | the business rules this clause carries out |
| `Proof` | an acceptance criterion | the test or checker that fails when the criterion is broken, or `none yet` with the issue that owes it |
| `Source` | a requirement | where in this repository the behaviour is already stated, so a reader can see the clause was drawn rather than invented |
| `Status` | a clause not yet in force | `proposal`, with the issue that would build it; absent means in force |

**A citation** is `<identifier>~<revision>`: `UC-05-3~2` cites the second revision of that use case.
A citation without a revision is a reference for a reader; one with a revision is a claim about
particular words, and it is the form a tracker verdict uses.

**An acceptance criterion is two lines**, because it is a list item rather than a heading and its
field line has nowhere else to go:

    - **AC-05-1-1** · Rev: 1 · Proof: plugin/test/advance.test.mjs
      WHEN the agent asks what is owed THEN the CLI SHALL name the next status.

The first line is the field line, opening with the identifier. The second is the criterion itself,
**in EARS form** — one behaviour per criterion, an observable outcome, and never an implementation:

| Form | Holds `THEN` |
|---|---|
| `WHEN <event> THEN <system> SHALL <response>` | yes |
| `IF <precondition> THEN <system> SHALL <response>` | yes |
| `WHILE <state> <system> SHALL <response>` | no |
| `WHERE <a feature is present> <system> SHALL <response>` | no |

Every form holds `SHALL`. The system named is the part that answers — the CLI, one verb, a gate, a
checker — because a criterion that names no answering part cannot be proved by running anything.

**A deviation** from what a source document says is marked `▲` in the clause, and the mark carries
the issue key or the decision that settled it.

**A retired clause** keeps its identifier and heading, gains `Status: retired` with the issue that
retired it, and is never renumbered or reused.

## What this specification does not cover

*Where should a reader look instead?*

- **Mechanics.** What to type is `forge <verb> -h`; the failures and measurements behind a shape
  are `docs/FORGE-CLI.md` and `docs/HOOKS.md`; the method an agent follows is the issue-flow skill.
  A clause here cites those and does not restate them.
- **The workflow contract itself.** `docs/issue-flow-contract.md` is the specification of the
  statuses and their payloads, and it is the `Source` of several requirements here. This tree says
  what the software must do about it.
- **Any other project's rules.** This plugin owns when and where a rule fires; a project owns what
  good code is. The division is the issue-flow skill's `two-levels` reference.
- **Judgement.** No clause here asks whether an answer from a model is good; nothing diffable
  proves that.
