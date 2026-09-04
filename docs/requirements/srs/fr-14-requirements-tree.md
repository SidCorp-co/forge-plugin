# SRS §16 — FR-14 — The requirements tree

**Status: proposal for `forge spec`.** Everything below except the tree itself is specified and not
built; the issue owing each clause is named beside it.

Rev: 1 · Actors: agent, developer, reviewer · Enforces: BR-01, BR-02, BR-09, BR-13 · Coupling: schema · Source: docs/requirements/README.md

← [Index](./README.md) · [§15 FR-13 Natural Vietnamese](./fr-13-natural-vietnamese.md) · Next: [§17 Non-functional requirements](./17-nfr.md)

## Purpose

*Why does this requirement exist?*

A rule with no identifier cannot be cited, and a rule that cannot be cited cannot be traced to the
work that satisfied it. Two projects here keep a requirements tree and an agent finds a clause by
searching for words; nothing in the CLI knows the identifiers, so nothing can check a citation or
hand a phase the clause it is implementing.

This requirement is the tree and the four things that make it usable: a reader, a gate, citations
from the tracker, and a rendered page. The tree comes first and is the fixture the rest are proven
on, because a reader proven against somebody else's document is proven against a document its
authors cannot change.

## Actors

*Who acts here?*

- **The agent**, which reads a clause by its identifier and cites it in what it writes.
- **The developer**, who runs the gate as part of the repository's own checks.
- **The reviewer**, a person, who reads the page and never the tree.

## Use cases

*What has to exist, and in what order?*

### UC-14-1 — The tree itself

Rev: 1 · Actors: developer · Enforces: BR-09

A BRD of one section per file and an SRS of one requirement per file, under the rules stated once in
the tree's own index. Every rule there is written in a form a checker can hold, and a clause cites
the checker or the skill that already states a rule rather than restating it.

- **AC-14-1-1** · Rev: 1 · Proof: docs/requirements/README.md
  WHEN a rule of the tree is written THEN it SHALL be stated with the form a checker holds and with
  who checks it, so no rule of the tree is advice.
- **AC-14-1-2** · Rev: 1 · Proof: plugin/test/checks/docs/doc-claims.test.mjs "a proposal may name the verb it opens with, and nothing else the CLI lacks"
  WHEN this tree names a command THEN that command SHALL be one the CLI has, or one declared on the
  document's own proposal line.

### UC-14-2 — A clause read by its identifier

Rev: 1 · Actors: agent · Enforces: BR-01

Identifiers are the whole surface: a requirement prints with its use cases, rules and criteria; a
use case with its criteria; a business rule with the clauses that cite it. No path appears in the
input or the output, so the same request can be answered from an API later without changing a
caller.

- **AC-14-2-1** · Rev: 1 · Proof: none yet — ISS-26
  WHEN a clause is asked for by identifier THEN the CLI SHALL print that clause and its children,
  and SHALL take no path as input.
- **AC-14-2-2** · Rev: 1 · Proof: none yet — ISS-26
  IF the identifier is unknown THEN the CLI SHALL refuse and SHALL name the nearest identifiers.
- **AC-14-2-3** · Rev: 1 · Proof: none yet — ISS-26
  IF two sequences carry the same prefix THEN the CLI SHALL refuse the reference as ambiguous.
- **AC-14-2-4** · Rev: 1 · Proof: none yet — ISS-26
  WHERE the tree is stored the CLI SHALL know it in one module, so the store can change without a
  caller changing.

### UC-14-3 — The gate over the tree

Rev: 1 · Actors: developer · Enforces: BR-13

The tree's rules become a check that runs from the repository's own suite. It judges presence and
resolution and never fit: an identifier that exists, a citation that resolves, a section that is
there, a marker that is absent.

- **AC-14-3-1** · Rev: 1 · Proof: none yet — ISS-27
  WHEN the gate runs THEN it SHALL report one finding per line, each naming the identifier, the
  file, the rule and the fix.
- **AC-14-3-2** · Rev: 1 · Proof: none yet — ISS-27
  WHEN the gate ships THEN it SHALL ship with a fixture that fails for each rule it holds, since a
  check nobody has watched refuse is a check nobody has.
- **AC-14-3-3** · Rev: 1 · Proof: none yet — ISS-27
  IF a citation names a revision whose recorded hash differs from the clause's current content THEN
  the gate SHALL report the citation suspect and SHALL name both.

### UC-14-4 — An issue cites the clause it serves

Rev: 1 · Actors: agent · Enforces: BR-02

A plan and a criterion may carry a citation, checked for shape at the write and against the tree
once the reader exists. A requirement's status is then derived from the verdicts on the issues that
cite it, and no field stores it.

- **AC-14-4-1** · Rev: 1 · Proof: none yet — ISS-28
  WHEN a criterion opens with a citation THEN the CLI SHALL check its shape at the write and SHALL
  check the reference against the tree where the reader is present.
- **AC-14-4-2** · Rev: 1 · Proof: none yet — ISS-28
  WHERE a project has a tree an issue SHALL cite at least one clause or declare itself a defect
  against one before it can be approved.
- **AC-14-4-3** · Rev: 1 · Proof: none yet — ISS-28
  WHEN a requirement's status is reported THEN it SHALL be derived from the verdicts at the merged
  commits of the issues citing it, and no field SHALL store it.
- **AC-14-4-4** · Rev: 1 · Proof: none yet — ISS-36
  WHEN a write carries a citation THEN no gate SHALL read that citation as a tracker key.

### UC-14-5 — The page a person reads

Rev: 1 · Actors: reviewer · Enforces: BR-09

One page per capability, rendered from the tree and the tracker: the requirement, its derived
status, its use cases and criteria in the product's language, and the trace table. It is a report
and never a gate, because it needs the network — and it refuses to render from a truncated read
rather than showing a page that is quietly short.

- **AC-14-5-1** · Rev: 1 · Proof: none yet — ISS-29
  WHEN the page is rendered THEN every clause of the tree SHALL appear exactly once, every
  identifier on the page SHALL link to a clause that exists, and rendering twice SHALL produce
  identical bytes.
- **AC-14-5-2** · Rev: 1 · Proof: none yet — ISS-29
  IF the tracker read was truncated THEN the render SHALL refuse and SHALL say how many pages it
  read.
- **AC-14-5-3** · Rev: 1 · Proof: none yet — ISS-29
  WHEN the page shows a derived status THEN that status SHALL equal the data it was rendered from.

### UC-14-6 — A second project adopts the tree

Rev: 1 · Actors: developer · Enforces: BR-09

The templates a project starts from are these documents, and the rules a writer follows are stated
once in the tree's index rather than copied into each project's own rules file. Scaffolding refuses
to overwrite a file that exists and says what it would create.

- **AC-14-6-1** · Rev: 1 · Proof: none yet — ISS-30
  WHEN a tree is scaffolded THEN the CLI SHALL list what it would create and SHALL refuse to
  overwrite a file that exists.
- **AC-14-6-2** · Rev: 1 · Proof: none yet — ISS-30
  WHERE a project's language is not English the templates SHALL carry English section names and
  field keys with the clauses in that project's language, so one tool reads every project's tree.

### UC-14-7 — A gap in the specification is an issue, not an invention

Rev: 1 · Actors: agent · Enforces: BR-02

When an issue needs behaviour the specification lacks or contradicts, the agent files a
specification-change issue citing the clause, relates it as a blocker, and parks. No clause is
filled in by the agent, and the person who answers it is the analyst the project names.

- **AC-14-7-1** · Rev: 1 · Proof: none yet — ISS-31
  IF the specification lacks or contradicts the behaviour an issue needs THEN the agent SHALL file a
  specification-change issue citing the clause and SHALL park the issue as blocked.
- **AC-14-7-2** · Rev: 1 · Proof: none yet — ISS-31
  WHEN a question can be answered by the specification THEN the decision record SHALL cite the
  clause rather than park the issue.

## The way back

*What undoes a change here?*

Two stores appear with this requirement, and both are reversible only because they are generated
and committed. The recorded hashes are the tree's own: a wrong regeneration is undone by the
previous commit of that file, and a citation judged suspect against a bad record is judged again
once it is restored. The page is output and holds nothing: it is deleted and rendered again.

The tree itself has no way back beyond `git`, and that is the point of a revision on every clause —
a clause's old words are in history, and the citations that depended on them fall out rather than
silently pointing at new text (R-10).

## Business rules enforced

*Which rules of the BRD does this requirement carry out?*

| Rule | How this requirement carries it |
|---|---|
| BR-01 | an unknown identifier is refused with the nearest ones, and every finding names its fix |
| BR-02 | a requirement's status is derived from the record, never typed |
| BR-09 | the rules of the tree are stated once, and a clause cites a checker rather than restating it |
| BR-13 | the gate ships with a fixture that fails for each of its rules |
