# SRS §18 — Data

← [Index](./README.md) · [§17 Non-functional requirements](./17-nfr.md) · Next: [§19 External interfaces](./19-external-interfaces.md)

## What this product owns on an issue

*Which fields does it write, and what shape does it put there?*

Nothing here is a field this product added: every one exists on an issue today (C-03), and where
the shape it needs is missing the value is carried in a fixed prose form until the tracker gives it
a field.

| Field | What this product puts there | Shape |
|---|---|---|
| status | the promise the issue is making | one of the tracker's states; the ones this product enters are the flow's, and the side statuses a park lands in |
| plan | the change, its boundary, and the two declarations the ship steps read | free text carrying a screen declaration and a schema-coupling declaration, each on a line the verb reads |
| criteria | what the work will be judged by | numbered lines, one outcome each, the number being what a verdict names |
| comments | every typed payload | one record per comment, rendered for a person, closing with a line naming its kind and the contract version |
| the lease field | who holds the issue and who held it before | a holder, a renew time, a duration and the claim history, written and read as one value |
| attachments | evidence a record cites | referenced by name from a record, and checked to exist before the record is written |
| the merged mark | that the change landed, and where | the tracker's stamp, whose note carries the commit as a fixed phrase and the reviewed head beside it when a squash moved the hash |
| release notes | what a reader is told, or that nothing is being said | a section, the user-facing text and the technical text; a withholding is a section of its own with the reason as its text |
| relations | what gates this issue and what merely relates to it | edges of two kinds, only one of which gates a dispatch |
| labels | where a citation is stored until a field exists | a set replaced whole, so the current set is read before any change |

**Two shapes the tracker owes.** The lease needs a compare-and-set on its field for the claim and
for every write the lease covers, and the mark needs a commit field of its own; until those exist
the lease is advisory (C-05) and the commit lives in the mark's note (ISS-7).

## What it owns in the account's directory

*Which files does it write, and what breaks if one is lost?*

| File | Holds | If it is lost |
|---|---|---|
| the account configuration | the endpoint, the credential, which verbs are hidden, which tools refused this credential, which gates are off | the product refuses until the credential is written again; the report verb is the writer |
| the cached tool declaration | the server's declaration of its own surface, keyed by endpoint | one slow call, never a wrong answer |
| the consult log | what a second opinion said and what was decided about each finding, credentials masked | the reviewer's own memory; the tracker never saw it, which is why a review is also a record on the issue |
| the refusal log | every refusal a gate made | the only route by which a gate refusing too much is found (NFR-02, UC-07-5) |

**One environment variable moves all of it**, which is how a test runs on state that is not the
developer's (BR-17).

## What it owns in the repository

*Which files in a project are this product's?*

| File | Holds |
|---|---|
| the project's settings file | the slug, whether the tracker's prose is translated, the dependency wording, which paths a second opinion covers, the angles it reviews from, and one command it may run |
| the requirements tree | this specification, and the hashes the gate records beside it (FR-14) |
| the vendored linter copy | a copy of this repository's own package, because a plugin directory travels alone (C-02) |

## What is derived and never stored

*Which values must not be written down?*

- **A requirement's status.** Derived from the verdicts on the issues citing it (UC-14-4).
- **Whether a status is earned.** Recomputed from the record every time (FR-05).
- **What is owed.** Read from the record, never cached.
- **The project's identifier.** Looked up from the slug at runtime (UC-01-2).
- **A count of anything.** Read from the list it belongs to (R-04).
