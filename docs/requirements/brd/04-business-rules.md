# BRD §4 — Business rules

← [Index](./README.md) · [§3 Goals and non-goals](./03-goals-non-goals.md) · Next: [§5 Success measures](./05-success-measures.md)

## The rules

*Which rules hold whatever the software is asked to do?*

This table is the one place a business rule's text lives, and the only source for what the sequence
holds. Each rule was drawn from a rule this repository already keeps; the last column says where it
is kept, so a reader can see the rule was inherited rather than invented. Which requirements
enforce a rule is not listed here — that map is rendered by ISS-29 from the `Enforces` fields, and
a hand-kept copy of it is the drift this tree exists to avoid.

A citation of a rule carries its revision: `BR-09~1`.

| Rule | Rev | Statement | Already kept in |
|---|---|---|---|
| **BR-01** | 1 | A refusal is actionable: it names what was refused, the rule in one clause, and one command that clears it. A refusal a developer cannot act on is a defect. | `CLAUDE.md`, `docs/HOOKS.md` |
| **BR-02** | 1 | The record is the only witness. Anything the repository knows is written onto the issue at the step that knew it, and nothing is read from a working tree at the moment of judging. | `docs/issue-flow-contract.md` |
| **BR-03** | 1 | A typed record is never removed. A wrong one is answered by a correction written beside it, so a reader sees the retraction next to what it retracts. | `docs/issue-flow-contract.md` |
| **BR-04** | 1 | A status is a promise, and it is earned by a payload. A change underneath it takes the promise back: the status falls to the last one still earned. | `docs/issue-flow-contract.md` |
| **BR-05** | 1 | One run holds an issue at a time, and who held it when is on the record rather than in anybody's memory. | `docs/issue-flow-contract.md` |
| **BR-06** | 1 | Every route this plugin can see is held to the same rule, so a check cannot be stepped around by choosing another client. | `docs/issue-flow-contract.md` |
| **BR-07** | 1 | This code runs in repositories it cannot see. It may refuse a shape and never a style, it reads a project's configuration rather than assuming it, and it says nothing where a project has not decided. | `CLAUDE.md` |
| **BR-08** | 1 | One decision has one source. A second place to set the same thing is a precedence rule to remember, a report that has to say which layer answered, and an undo that is wrong whenever only one half applies. | `README.md`, `docs/HOOKS.md` |
| **BR-09** | 1 | One fact has one home. A rule with a checker behind it is stated in the checker, whose message is what a developer reads; a document that repeats it is a copy that goes stale without failing anything. | `CLAUDE.md` |
| **BR-10** | 1 | An entry point is imported by nothing. Code a second one needs moves to the shared source before the second copy exists. | `CLAUDE.md` |
| **BR-11** | 1 | Vietnamese belongs to the tracker and the product. Everything a developer reads — comments, documents, help, errors, logs, commit messages — is English, and product prose is written through the style contract rather than typed where it is used. | `CLAUDE.md`, `VI-NATURAL.md` |
| **BR-12** | 1 | A gate is never loosened to admit the change in hand. A violation that slips through is a defect in the checker, fixed by the task that found it. | `CLAUDE.md` |
| **BR-13** | 1 | A checker is believed only once it has been watched to refuse something. One whose selector matches nothing is indistinguishable from a clean repository. | `CLAUDE.md` |
| **BR-14** | 1 | Every input is used or refused, never quietly dropped. A flag read and ignored is the defect family a review of these verbs found six times in one issue. | `docs/issue-flow-contract.md` |
| **BR-15** | 1 | Work proceeds unasked unless a mistake could not be detected and undone. Visibility is not the test; irreversibility is. | `plugin/skills/issue-flow/SKILL.md` |
| **BR-16** | 1 | A green tree says the plumbing survived, not that the answer was good. What a model returns is verified by running it and reading the output. | `CLAUDE.md` |
| **BR-17** | 1 | Nothing exercising this product's state runs on the developer's own credential. A test points the configuration directory elsewhere first. | `CLAUDE.md` |

## How a rule enters this table

*What has to be true before a rule is written down here?*

A rule belongs here when it is an obligation on the product that holds across requirements, and
when something in the repository already keeps it — a checker, a gate document, a contract, a
skill. A rule with no such home is a wish, and it is filed as an issue rather than added here: this
table is a statement of what the product already owes, and the requirements that carry each rule
out cite it in their `Enforces` field.
