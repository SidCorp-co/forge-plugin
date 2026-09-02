# BRD §4 — Business rules

← [Index](./README.md) · [§3 Goals and non-goals](./03-goals-non-goals.md) · Next: [§5 Success measures](./05-success-measures.md)

## The rules

*Which rules hold whatever the software is asked to do?*

Each row is **an identifier, the name of the rule, and the document that states it**. Nothing here
states a rule itself. In a product whose rules were written before this tree, every one of them is
already argued for somewhere a developer reads — a checker's message, a gate document, a contract, a
skill, the rules file — and BR-09, at its own home, says what a second copy of one costs.

A name is not a statement. It is short enough that the repository's own duplication measure cannot
see it, which is the line this repository already draws between naming a rule and stating it, and
it changes only when the subject of the rule changes — at which point the identifier's meaning has
changed and its revision moves anyway.

So a reader who wants the rule follows the last column, and a tool that renders a rule beside a
clause quotes that source. This table is the only source for what the sequence holds; which
requirements enforce a rule is rendered by ISS-29 from the `Enforces` fields, never kept here.

A citation of a rule carries its revision: `BR-09~1`.

| Rule | Rev | Name | Stated in |
|---|---|---|---|
| **BR-01** | 1 | the shape of a refusal | `CLAUDE.md`; `docs/HOOKS.md`; each gate's own document |
| **BR-02** | 1 | the record as the only witness | `docs/issue-flow-contract.md`, "The mechanics" |
| **BR-03** | 1 | a record corrected, never removed | `docs/issue-flow-contract.md`, "The record is the checkpoint" |
| **BR-04** | 1 | a status earned, and unearned | `docs/issue-flow-contract.md`, "A later change unearns" |
| **BR-05** | 1 | one holder per issue, on the record — bounded by C-05 | `docs/issue-flow-contract.md`, "A claim is a lease" |
| **BR-06** | 1 | one rule for every route | `docs/issue-flow-contract.md`, "Every route this plugin sees is the same route" |
| **BR-07** | 1 | repositories this code cannot see | `CLAUDE.md`, "This code runs in repositories you cannot see" |
| **BR-08** | 1 | one source per decision | `README.md`, "Configuration"; `docs/HOOKS.md`, "Every hook can be switched off" |
| **BR-09** | 1 | one home per fact | `CLAUDE.md`, its opening rules |
| **BR-10** | 1 | an entry point imported by nothing | `CLAUDE.md`, "An entry point is not a library" |
| **BR-11** | 1 | whose language is whose | `CLAUDE.md`, "Vietnamese is the tracker's and the product's"; `VI-NATURAL.md` |
| **BR-12** | 1 | the source, not the gate | `CLAUDE.md`, "Verifying" |
| **BR-13** | 1 | a checker watched to fire | `CLAUDE.md`, "Verifying" |
| **BR-14** | 1 | an input used or refused | `docs/issue-flow-contract.md`, "Second dry run" |
| **BR-15** | 1 | a stop only for the irreversible | `plugin/skills/issue-flow/SKILL.md`, "Autonomy, and the three things that stop it" |
| **BR-16** | 1 | the half no gate reaches | `CLAUDE.md`, "The half no gate reaches" |
| **BR-17** | 1 | never the developer's own credential | `CLAUDE.md`, "The live config directory is one environment variable away" |

## How a rule enters this table

*What has to be true before a rule is written down here?*

A rule belongs here when it is an obligation on the product that holds across requirements, and
when something in the repository already argues for it. A rule with no such home is a wish: it is
filed as an issue, the argument is made where it belongs, and only then does it earn a row. That
order is what keeps this table an index of what the product already owes, rather than a place where
rules are invented without a reader.

A project whose tree comes before its rules has nowhere to point, and states the rule in the row
instead — the last column then names the row itself, and the tree becomes that rule's home. Which
way round a project is, is the first thing its tree decides.
