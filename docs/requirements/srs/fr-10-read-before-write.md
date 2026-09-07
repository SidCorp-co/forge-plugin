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

- **AC-10-1-1** · Rev: 1 · Proof: plugin/test/tracker/issue/read-first.test.mjs "a write to an issue with comments nobody was shown is denied, and they are in the deny"
  IF a write names a key that no comments call of this session asked about THEN the gate SHALL
  refuse and SHALL print the listing call for that key.
- **AC-10-1-2** · Rev: 1 · Proof: plugin/test/tracker/issue/read-first.test.mjs "an issue with no comments is not denied, and no round is spent on a read"
  WHEN a comments call of this session names that key in the same invocation THEN the gate SHALL
  allow the write, and an empty listing SHALL satisfy it.
- **AC-10-1-3** · Rev: 1 · Proof: plugin/test/tracker/issue/read-first.test.mjs "two issues in one command are one deny naming both"
  IF the listing named a different issue THEN it SHALL not satisfy this one.
- **AC-10-1-4** · Rev: 1 · Proof: plugin/test/tracker/issue/read-first.test.mjs "the re-send passes, and no read of the transcript decided either answer"
  IF the gate's own refusal is the only place the key appears THEN the next attempt SHALL still be
  refused.

### UC-10-2 — A write is a write by any route

Rev: 1 · Actors: agent · Enforces: BR-06

The CLI's writing verbs and the tracker's own tool are both writes; a read is not, however full.
The tracker's tool is judged by the action it names rather than by its name.

- **AC-10-2-1** · Rev: 1 · Proof: plugin/test/tracker/issue/read-first.test.mjs "a raw call is judged by its action, and the mark carries its issue inside data"
  WHEN the tracker's own tool is called THEN the gate SHALL judge it by its action, so a listing and
  a read pass and a transition does not.
- **AC-10-2-2** · Rev: 1 · Proof: plugin/test/tracker/issue/read-first.test.mjs "only the argument the verb writes to is a target"
  IF a write verb appears in prose THEN the gate SHALL allow the command, and one in a payload the
  command carries SHALL still count.
- **AC-10-2-3** · Rev: 1 · Proof: none yet — ISS-15
  WHERE a verb writes the record it SHALL be covered by this gate, the payload verbs included.
- **AC-10-2-4** · Rev: 2 · Proof: plugin/test/tracker/issue/read-first.test.mjs "the id the command grants is whose reading counts, and a second harness id is not a second run"
  WHEN the run that reads is the run that writes THEN the gate SHALL be satisfied.
- **AC-10-2-5** · Rev: 1 · Proof: plugin/test/tracker/issue/read-first.test.mjs "a command granting an id nobody credited is denied, whatever the harness was shown"
  IF a read was made by another agent rather than the run that writes THEN that read SHALL not
  satisfy the gate for the writing run.

### UC-10-3 — Only the tracker's own keys count as keys

Rev: 1 · Actors: agent · Enforces: BR-01

The gate reads a key by its shape so a tracker under another prefix needs no configuration. That
same shape is worn by every identifier of this specification, which is a defect rather than a
feature: a plan or a criterion citing a clause is refused for a document that has no comments.

- **AC-10-3-1** · Rev: 1 · Proof: plugin/test/tracker/issue/read-first.test.mjs "the tracker's own key still is one, in either case"
  WHERE a tracker uses another prefix its keys SHALL still be recognised without configuration.
- **AC-10-3-2** · Rev: 1 · Proof: none yet — ISS-36
  IF a write carries a clause citation THEN the gate SHALL not read it as a tracker key.

### UC-10-4 — A gate that cannot see stands down

Rev: 1 · Actors: agent · Enforces: BR-13

If the session's own history cannot be opened, the gate has no evidence either way, and refusing on
no evidence would make the product unusable in a session it cannot read.

- **AC-10-4-1** · Rev: 1 · Proof: plugin/test/tracker/issue/read-first.test.mjs "a tracker that will not answer leaves the write alone and says why"
  IF the session's history cannot be read THEN the gate SHALL stand down.

### UC-10-5 — A session is told a thing once

Rev: 1 · Actors: agent · Enforces: BR-01, BR-02

The store that says which comments a session has seen is one instance of a general need: every
surface that puts text into a session — a gate's hold, a hint after an edit, a verb's reply, a part
of the method — repeats that text on every firing, and the repeats are paid for in the session's
context. One ledger, keyed on the session, the surface and a digest of the text, tells a session a
thing once; a refusal keeps its one line because every hold owes the command that clears it (BR-01).

- **AC-10-5-1** · Rev: 1 · Proof: plugin/test/gates/codex-turn.test.mjs "the hint is credited under the session, the surface codex-turn and the digest of its text"
  WHEN text reaches a session for the first time THEN the ledger SHALL show it whole and SHALL
  credit it to the session, the surface and the text's digest.
- **AC-10-5-2** · Rev: 1 · Proof: plugin/test/shown/ledger.test.mjs "an unchanged repeat costs a refusal one line, and that line names the route to the reason"
  WHEN a refusal repeats unchanged in one session THEN it SHALL print one line naming the command
  that clears it, and never nothing.
- **AC-10-5-3** · Rev: 1 · Proof: plugin/test/shown/ledger.test.mjs "an unchanged repeat costs advice nothing at all"
  WHEN advice repeats unchanged in one session THEN it SHALL print nothing.
- **AC-10-5-4** · Rev: 1 · Proof: plugin/test/shown/ledger.test.mjs "a text that grew since it was shown owes the lines it grew by and not the rest"
  WHEN text changed since it was shown THEN only the change SHALL print.
- **AC-10-5-5** · Rev: 1 · Proof: plugin/test/shown/ledger.test.mjs "the subagent's credit is written under its own id and not its dispatcher's"
  WHEN a subagent is told a thing THEN the credit SHALL be that subagent's alone and never its
  dispatcher's.

## Business rules enforced

*Which rules of the BRD does this requirement carry out?*

| Rule | How this requirement carries it |
|---|---|
| BR-01 | the refusal carries the exact listing call for the key it wants |
| BR-02 | a write to the record is made by a run that has read the record |
| BR-06 | the CLI's verbs and the tracker's tool are held alike |
| BR-13 | the gate stands down where it has no evidence, rather than refusing blind |
