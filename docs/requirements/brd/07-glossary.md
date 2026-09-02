# BRD §7 — Glossary

← [Index](./README.md) · [§6 Constraints and assumptions](./06-constraints-assumptions.md) · Next: [§8 Open items](./08-open-items.md)

## The words this repository uses

*What does each of them mean here, and where is it specified?*

This is the one place a term is defined. A clause elsewhere uses the term and does not redefine it.

| Term | Meaning here | Specified in |
|---|---|---|
| **record** (noun) | one typed payload on an issue, in a shape the CLI owns, tagged with its kind and the contract version it was written under | [FR-04](../srs/fr-04-typed-records.md) |
| **record** (verb) | to write such a payload | [FR-04](../srs/fr-04-typed-records.md) |
| **the record** | everything the tracker holds about an issue: its fields, its typed payloads, its comments, its attachments, its merged mark and its relations | [FR-05](../srs/fr-05-earned-transitions.md), BR-02 |
| **payload** | what a phase produces and a status is earned by; every payload is a record, and the two words differ only in which side is speaking | [FR-05](../srs/fr-05-earned-transitions.md) |
| **status** | one of the tracker's states, read as a promise to whoever reads the issue next | [FR-05](../srs/fr-05-earned-transitions.md) |
| **phase** | the work an agent does while a status is held, producing the payload the next status is earned by | the issue-flow skill |
| **earned** | said of a status whose entry payload is present, recent, and about the commit it names | [FR-05](../srs/fr-05-earned-transitions.md), BR-04 |
| **unearned** | said of a status whose payload has been overtaken — the reviewed commit moved, or the criteria changed — so the issue falls back | [UC-05-6](../srs/fr-05-earned-transitions.md), BR-04 |
| **owed** | what the next status lacks, named item by item with the write that supplies each | [UC-05-1](../srs/fr-05-earned-transitions.md) |
| **park** | setting one issue down with a typed reason and a reader it waits on, in the side status that reason implies | [UC-05-4](../srs/fr-05-earned-transitions.md) |
| **lease** | the claim one run holds on an issue: a holder, a renew time, a duration and the claims before it, in a field the issue already has | [FR-03](../srs/fr-03-the-lease.md) |
| **stale** | said of a lease past its duration — reclaimable by any run, and refused for its own former holder | [FR-03](../srs/fr-03-the-lease.md) |
| **verdict** | one judgement of one acceptance criterion, citing evidence and the commit it judged | [FR-04](../srs/fr-04-typed-records.md) |
| **baseline** | what a gate already reported before the work started, recorded with the commit it ran at, so a later red has something to be judged against | [FR-04](../srs/fr-04-typed-records.md) |
| **evidence** | a reference the tracker can resolve: an attachment on the issue, a URL, or a commit | [FR-04](../srs/fr-04-typed-records.md) |
| **the mark** | the tracker's merged stamp, whose note carries the commit that landed and the head that was reviewed | [FR-05](../srs/fr-05-earned-transitions.md), C-03 |
| **finding** | one point a reviewer raised, by the identifier the review that issued it gave | [FR-06](../srs/fr-06-second-opinion.md) |
| **gate** | a check that runs before or after a tool call and may refuse it, or after a write and may only speak | [FR-07](../srs/fr-07-gate-harness.md) |
| **the project** | the repository the plugin is installed in, and the actor that answers for what good code is | [FR-11](../srs/fr-11-project-code-rules.md), BR-07 |
| **the page** | a rendered view of this tree, and the only surface a non-developer reads | [../README.md](../README.md), ISS-29 |
| **clause** | one identified unit of this specification: a requirement, a use case, a criterion, a rule, a constraint | [../README.md](../README.md) |
| **suspect** | said of a citation whose clause has changed since the revision cited | R-10 |
