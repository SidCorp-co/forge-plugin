# SRS §12 — FR-10 — Comments read before a write

Rev: 1 · Actors: agent · Enforces: BR-01, BR-02, BR-06 · Source: plugin/hooks/how/issue-read-first.md

← [Index](./README.md) · [§11 FR-09 The learning gates](./fr-09-learning-gates.md) · Next: [§13 FR-11 The project's own code rules](./fr-11-project-code-rules.md)

## Purpose

*Why does this requirement exist?*

A full read of an issue returns no comments at all, so the read that looks complete is not: the two
halves of an issue differ in age, and the gate's own document has the sentence for it. So a write to
an issue is refused until this session has asked the tracker about that issue's comments. An empty answer satisfies it: the condition is having looked,
and what the gate can check is that the asking happened — UC-10-1 states exactly how much that is.

## Actors

*Who acts here?*

- **The agent**, which lists the comments and then writes.

## Use cases

*When does it fire, and what clears it?*

### UC-10-1 — Refuse a write to an issue nobody has read

Rev: 1 · Actors: agent · Enforces: BR-01, BR-02

Every key the command names has to have been read, and the listing and the key have to be one
invocation — a search for either that merely names the other satisfied nothing. What the gate can
check is that a comments call of this session named the key, which is narrower than the listing the
gate's own document asks for: the condition is having looked, and looking is what a call naming the
key evidences.

- **AC-10-1-1** · Rev: 1 · Proof: plugin/test/issue-read-first.test.mjs
  IF a write names a key that no comments call of this session asked about THEN the gate SHALL
  refuse and SHALL print the listing call for that key.
- **AC-10-1-2** · Rev: 1 · Proof: plugin/test/issue-read-first.test.mjs
  WHEN a comments call of this session names that key in the same invocation THEN the gate SHALL
  allow the write, and an empty listing SHALL satisfy it.
- **AC-10-1-3** · Rev: 1 · Proof: plugin/test/issue-read-first.test.mjs
  IF the listing named a different issue THEN it SHALL not satisfy this one.
- **AC-10-1-4** · Rev: 1 · Proof: plugin/test/issue-read-first.test.mjs
  IF the gate's own refusal is the only place the key appears THEN the next attempt SHALL still be
  refused.

### UC-10-2 — A write is a write by any route

Rev: 1 · Actors: agent · Enforces: BR-06

The CLI's writing verbs and the tracker's own tool are both writes; a read is not, however full.
The tracker's tool is judged by the action it names rather than by its name.

- **AC-10-2-1** · Rev: 1 · Proof: plugin/test/issue-read-first.test.mjs
  WHEN the tracker's own tool is called THEN the gate SHALL judge it by its action, so a listing and
  a read pass and a transition does not.
- **AC-10-2-2** · Rev: 1 · Proof: plugin/test/issue-read-first.test.mjs
  IF a write verb appears in prose THEN the gate SHALL allow the command, and one in a payload the
  command carries SHALL still count.
- **AC-10-2-3** · Rev: 1 · Proof: none yet — ISS-15
  WHERE a verb writes the record it SHALL be covered by this gate, the payload verbs included.
- **AC-10-2-4** · Rev: 1 · Proof: none yet — ISS-33
  WHEN the run that reads is the run that writes THEN the gate SHALL be satisfied, and a read from
  an earlier turn or another agent SHALL not satisfy it.

### UC-10-3 — Only the tracker's own keys count as keys

Rev: 1 · Actors: agent · Enforces: BR-01

The gate reads a key by its shape so a tracker under another prefix needs no configuration. That
same shape is worn by every identifier of this specification, which is a defect rather than a
feature: a plan or a criterion citing a clause is refused for a document that has no comments.

- **AC-10-3-1** · Rev: 1 · Proof: plugin/test/issue-read-first.test.mjs
  WHERE a tracker uses another prefix its keys SHALL still be recognised without configuration.
- **AC-10-3-2** · Rev: 1 · Proof: none yet — ISS-36
  IF a write carries a clause citation THEN the gate SHALL not read it as a tracker key.

### UC-10-4 — A gate that cannot see stands down

Rev: 1 · Actors: agent · Enforces: BR-13

If the session's own history cannot be opened, the gate has no evidence either way, and refusing on
no evidence would make the product unusable in a session it cannot read.

- **AC-10-4-1** · Rev: 1 · Proof: plugin/test/issue-read-first.test.mjs
  IF the session's history cannot be read THEN the gate SHALL stand down.

## Business rules enforced

*Which rules of the BRD does this requirement carry out?*

| Rule | How this requirement carries it |
|---|---|
| BR-01 | the refusal carries the exact listing call for the key it wants |
| BR-02 | a write to the record is made by a run that has read the record |
| BR-06 | the CLI's verbs and the tracker's tool are held alike |
| BR-13 | the gate stands down where it has no evidence, rather than refusing blind |
