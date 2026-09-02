# SRS §8 — FR-06 — The second opinion

Rev: 1 · Actors: agent, reviewer · Enforces: BR-01, BR-09, BR-16 · Source: plugin/skills/forge/references/codex.md

← [Index](./README.md) · [§7 FR-05 Earned transitions](./fr-05-earned-transitions.md) · Next: [§9 FR-07 The gate harness](./fr-07-gate-harness.md)

## Purpose

*Why does this requirement exist?*

A model's own errors are the ones it cannot see, and it fixes them readily once someone else points
at them. So what a turn wrote is read by a model from another provider before it lands — and the
reading has to actually happen and actually be answered, because a reminder is context and an agent
can ignore it. It was ignored: a commit landed after an hour of gate changes with the built-in
advisor consulted four times and the other reviewer not once.

A second opinion from the same model family is duplication wearing the clothes of confirmation
(C-09), which is why the review model is refused when it resolves to this model's own family.

## Actors

*Who acts here?*

- **The agent**, which states its intent, receives findings and disposes of each one.
- **The reviewer**, the other provider's model, which rules on what it was asked about.

## Use cases

*What is sent, what comes back, and what must happen before a commit?*

### UC-06-1 — Ask for a review of what this turn changed

Rev: 1 · Actors: agent · Enforces: BR-01, BR-16

The diff and the size of each file are sent, the reviewer reads the rest itself, and the intent —
what the author was trying to do — is the part it cannot see. Which files are worth a second opinion
is the checkout's decision, not the account's: a documentation tree and a code tree do not want the
same answer.

- **AC-06-1-1** · Rev: 1 · Proof: plugin/test/codex.test.mjs
  WHEN a consult runs THEN the pattern deciding which files it covers SHALL be taken from the
  checkout, else the account, else the default, in that order.
- **AC-06-1-2** · Rev: 1 · Proof: plugin/test/codex.test.mjs
  IF the review model resolves to this model's own family THEN the CLI SHALL refuse the consult.
- **AC-06-1-3** · Rev: 1 · Proof: plugin/test/codex.test.mjs
  IF a named path leaves the checkout, by relative segments or by a symbolic link, THEN the CLI
  SHALL refuse to send it.
- **AC-06-1-4** · Rev: 1 · Proof: plugin/test/codex-tools.test.mjs
  WHERE the checkout names a command the reviewer may run, the CLI SHALL run it once per consult,
  from that checkout, and SHALL report its exit status and the tail of its output.

### UC-06-2 — List the documents a turn changed, once, at the end

Rev: 1 · Actors: agent · Enforces: BR-01

A review per write sees a paragraph and cannot know whether the paragraph was the plan. So the
documents a turn changed are recorded and offered for one reading at the end of it, and a document
whose content the last consult already read is not offered again however recently it was touched.

- **AC-06-2-1** · Rev: 1 · Proof: plugin/test/codex-turn.test.mjs
  WHEN the first document of a turn is written THEN the CLI SHALL ask once, and SHALL record the
  rest of that turn's documents without asking again.
- **AC-06-2-2** · Rev: 1 · Proof: plugin/test/codex-turn.test.mjs
  IF the latest consult already read a document at its current content THEN the CLI SHALL not record
  it as unread, even when the document is named or touched again.
- **AC-06-2-3** · Rev: 1 · Proof: plugin/test/codex-turn.test.mjs
  WHILE a turn is in progress the CLI SHALL never stop it for an unread document.

### UC-06-3 — A commit waits for the reading and for the verdict

Rev: 1 · Actors: agent · Enforces: BR-01

Before a commit, three things are asked for: that the tree's newer work has been read, that
documents recorded and never consulted on are read, and that the last consult which made findings
heard a disposition of each. A finding nobody ruled on is an open finding.

- **AC-06-3-1** · Rev: 1 · Proof: plugin/test/codex-second.test.mjs
  WHEN a commit is about to be made and work in the tree has never been consulted on THEN the gate
  SHALL refuse the commit and SHALL name the files it wants read.
- **AC-06-3-2** · Rev: 1 · Proof: plugin/test/codex-second.test.mjs
  IF the last consult made findings and heard no disposition THEN the gate SHALL refuse the commit
  and SHALL name the command that records one.
- **AC-06-3-3** · Rev: 1 · Proof: plugin/test/codex-second.test.mjs
  WHEN a commit names another tree THEN the gate SHALL judge it by that tree rather than by the
  shell's.
- **AC-06-3-4** · Rev: 1 · Proof: plugin/test/codex-second.test.mjs
  WHEN work is deleted rather than written THEN the gate SHALL treat the deletion as work in the
  tree, a whole directory included.

### UC-06-4 — What the built-in advisor said travels into the consult

Rev: 1 · Actors: agent · Enforces: BR-09

One reviewer reads the conversation and cannot open a file; the other reads the files and has never
seen the conversation. The advisor's reply is unreadable once the turn moves on, so the only moment
its content can reach the other reviewer is the same turn. Left out, the second reviewer rediscovers
the ground and its agreement reads as independent confirmation.

- **AC-06-4-1** · Rev: 1 · Proof: plugin/test/codex-order.test.mjs
  IF the advisor has spoken this turn and its advice is unspent THEN the gate SHALL ask once for that
  advice to be carried into the consult's intent, and SHALL then let the write through.
- **AC-06-4-2** · Rev: 1 · Proof: plugin/test/codex-order.test.mjs
  IF no advisor spoke before a consult THEN the gate SHALL ask nothing, since the order of the two
  is the author's.
- **AC-06-4-3** · Rev: 1 · Proof: plugin/test/codex-order.test.mjs
  WHEN the phrase appears only inside data — a document body, a quoted argument, a program's own
  string — THEN the gate SHALL not read it as a consult.

### UC-06-5 — Every finding is disposed of by identifier

Rev: 1 · Actors: agent · Enforces: BR-01, BR-03

Each finding is accepted or rejected with a reason, by the identifier the review gave it, and the
disposition is replayed into the next consult. Rejecting a finding with a reason is a legitimate
outcome; leaving it unruled makes "resolved or still open" a guess.

- **AC-06-5-1** · Rev: 1 · Proof: plugin/test/codex-log.test.mjs
  WHEN a disposition is recorded THEN it SHALL be stored against the identifier the review gave, and
  SHALL travel into the next consult.
- **AC-06-5-2** · Rev: 1 · Proof: plugin/test/codex-log.test.mjs
  WHEN a credential appears in anything written to the log THEN it SHALL be masked before it is
  written down.

## Business rules enforced

*Which rules of the BRD does this requirement carry out?*

| Rule | How this requirement carries it |
|---|---|
| BR-01 | every refusal names the consult or the disposition that clears it |
| BR-09 | the two reviewers are told about each other rather than each rediscovering the ground |
| BR-16 | what comes back from a model is read and ruled on, because nothing about it is diffable |
| BR-03 | a disposition is recorded rather than remembered, and a rejection carries its reason |
