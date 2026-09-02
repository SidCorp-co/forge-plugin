# BRD §3 — Goals and non-goals

← [Index](./README.md) · [§2 Stakeholders](./02-stakeholders.md) · Next: [§4 Business rules](./04-business-rules.md)

## Goals

*What is this product for?*

| Goal | Met by |
|---|---|
| **G-01** A status is earned by a record, or it does not move. | [FR-05](../srs/fr-05-earned-transitions.md) |
| **G-02** Every payload the workflow produces has one shape the CLI owns, so a second run writes it the same way. | [FR-04](../srs/fr-04-typed-records.md) |
| **G-03** One run holds an issue at a time, and a run that dies loses the issue rather than the work. | [FR-03](../srs/fr-03-the-lease.md) |
| **G-04** A backlog is reachable from a terminal with no client connected, in the narrowest call that answers. | [FR-02](../srs/fr-02-tracker-surface.md) |
| **G-05** A command whose damage cannot be undone is refused before it runs, and the refusal says what to run instead. | [FR-08](../srs/fr-08-irreversible-commands.md) |
| **G-06** What a turn wrote is read by a second model on another provider before it lands. | [FR-06](../srs/fr-06-second-opinion.md) |
| **G-07** A rule fires where the project decided it should, on the project's own thresholds, and stays silent where the project has not decided. | [FR-11](../srs/fr-11-project-code-rules.md) |
| **G-08** A claim a document makes about this repository fails when it stops being true. | [FR-12](../srs/fr-12-documentation-gates.md) |
| **G-09** Vietnamese reaching a user is written through one style contract, never typed inline. | [FR-13](../srs/fr-13-natural-vietnamese.md) |
| **G-10** A specification is citable, checkable and rendered for the person who has to read it. | [FR-14](../srs/fr-14-requirements-tree.md) |

## Non-goals

*What will this product not do, however useful it would be?*

- **It does not judge whether an answer is true.** Presence, recency and the commit a payload names
  are checkable; whether a verdict is honest or a screenshot is of the right screen is the
  reviewer's. A check that tried would refuse honest records and pass dishonest ones alike.
- **It does not decide what good code is.** No threshold, no style, no lint rule of its own. That
  belongs to the repository the plugin is installed in.
- **It does not dispatch work.** No runner, no queue, no scheduler; one session takes one issue.
  What a supervisor needs to *see* is a goal (ISS-24); what a supervisor does is done through the
  verbs that already exist.
- **It does not start a run.** Where these rules first reach an issue that was worked outside the
  workflow is the contract's "What it does not do".
- **It does not add fields to the tracker.** Everything the workflow reads exists on an issue now.
  Where that shape is wrong, the change is the tracker's (ISS-7).
- **It does not migrate another project.** Each project adopts a rule, a gate or the requirements
  tree by filing its own issue.
