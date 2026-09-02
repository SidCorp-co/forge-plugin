# BRD §6 — Constraints, assumptions, and what was borrowed

← [Index](./README.md) · [§5 Success measures](./05-success-measures.md) · Next: [§7 Glossary](./07-glossary.md)

## Constraints

*What is fixed, whatever the requirements would prefer?*

| Constraint | Rev | What it forces |
|---|---|---|
| **C-01** The plugin runs from a copy in a cache directory, and the installer compares versions only. | 1 | An edit that does not bump the manifest version never reaches a session. A green tree in this checkout says nothing about the sessions the gates guard. |
| **C-02** A plugin directory travels alone and cannot import a sibling package. | 1 | The shared linter script is vendored into the plugin as a copy, and drift between the copy and its source is a gate rather than a habit. |
| **C-03** The tracker's fields are the tracker's. | 1 | Every payload the workflow writes lands in a field or a comment that exists today, and a shape the tracker lacks is carried in a fixed prose form until it gains a field. |
| **C-04** One credential, in one file outside every repository, at owner-only permissions. | 1 | No environment variable and no in-repository file is a second source for the account, and a test that exercises live state redirects the configuration directory first. |
| **C-05** The tracker refuses no stale write yet. | 1 | The lease is advisory rather than exclusive: two runs that both find no lease both take one, and the later write erases the earlier. This is the limit BR-05's duty is bounded by, and a project running more than one agent needs the tracker's refusal first (ISS-7). |
| **C-06** The host has no per-hook switch. | 1 | Turning one gate off is this product's own feature, in the account's configuration, and it fails open when that file will not parse. |
| **C-07** The tracker's comment list has no cursor. | 1 | An issue whose comments exceed one page cannot be judged, and every operation on it is refused rather than answered from a partial record (ISS-17). |
| **C-08** A gate's message lands in a context window on every tool call. | 1 | A refusal is capped in size and carries no argument; the reasoning lives in the document a refused agent can open. |
| **C-09** A second opinion is only worth its tokens from another provider. | 1 | The review model is refused when it resolves to this model's own family. |
| **C-10** The workflow's whole state is the tracker's record and the pushed branch. | 1 | Nothing may live in a session, a local file or a developer's memory, because a run that dies has to be resumable by another. |

## Assumptions

*What is taken as true, and what breaks if it is not?*

| Assumption | Rev | If it is false |
|---|---|---|
| **A-01** A project that uses the tracker carries its own settings file naming its slug. | 1 | Every call needing a project identifier refuses, and the diagnostic verb says which source failed. |
| **A-02** One agent works a project's backlog at a time. | 1 | Two runs can overwrite one record, and nothing on the record shows it. C-05 is why. |
| **A-03** A person reads the tracker rather than the repository. | 1 | Evidence written onto issues reaches nobody, and the phases that write it are cost without a reader. |
| **A-04** The default branch, the deploy route and the way back are the project's, discovered per project. | 1 | A step assumed from another project's layout fails at the worst moment, which is why the way back is established before the step that needs one. |
| **A-05** A business analyst reads a rendered page and asks for changes as issues. | 1 | The text tree becomes a document a non-developer edits, and the citations in it stop being trustworthy. |

## What was borrowed, and where

*Which of this is somebody else's idea?*

Requirements tooling has settled several of these questions already. Each row names what was taken
and the clause that carries it; where an idea was rejected, the reason is beside the rule it would
have replaced.

| Source | What was taken | Carried by |
|---|---|---|
| **Doorstop** | a link that goes *suspect* when the clause it points at changes, and a stored fingerprint as the mechanism | [../README.md](../README.md), R-10 |
| **OpenFastTrace** | a revision inside the identifier, so a citation is a claim about particular words; and a declared list of what must cover a requirement | R-10, and the `Needs` field |
| **StrictDoc** | a machine identifier beside the human one — **rejected**; the reason is beside R-12 | R-12 |
| **Sphinx-Needs** | tables and graphs generated from the clause objects rather than kept by hand | [../srs/traceability.md](../srs/traceability.md) |
| **GitHub spec-kit** | an analysis pass that reports duplication, vagueness, underspecification and requirements no task covers, with a severity each; and a constitution of non-negotiable rules, which this repository's own rules file already is | the spec gate (ISS-27), and [04-business-rules.md](./04-business-rules.md) |
| **Kiro** | acceptance criteria in EARS form — one behaviour, an observable outcome, never an implementation | [../srs/01-introduction.md](../srs/01-introduction.md) |
| **duvet** | quoting the cited text at the citation, so a citation is provably of *this* text | R-10's hash, which is the same idea without the copy |
| **GitLab requirements** | a requirement's status derived from test evidence rather than typed by a person | ISS-28, and the derived status on the page |
| **ai-devkit** | a section is a heading with the question it answers, and evidence for a step is a command with its exit code | R-14, and the verdict's evidence |
