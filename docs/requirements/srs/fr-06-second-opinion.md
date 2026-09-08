# SRS §8 — FR-06 — The second opinion

Rev: 1 · Actors: agent, reviewer · Enforces: BR-01, BR-16 · Source: plugin/guides/skills/forge/references/codex.md

← [Index](./README.md) · [§7 FR-05 Earned transitions](./fr-05-earned-transitions.md) · Next: [§9 FR-07 The gate harness](./fr-07-gate-harness.md)

## Purpose

*Why does this requirement exist?*

What a turn wrote is read by a model from another provider before it lands. Why that is worth its
tokens at all, and how a finding should be received, is
`plugin/guides/skills/forge/references/codex.md`; what this requirement adds is that the reading has to
happen and has to be answered, because a reminder is context and an agent can ignore one — and one
did, for an hour of gate changes.

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

The intent — what the author was trying to do — is the part the reviewer cannot see, and what is
sent alongside it is the codex reference's business. Which files are worth a second opinion is the
checkout's decision rather than the account's, and `README.md` says why that level.

- **AC-06-1-1** · Rev: 2 · Proof: plugin/test/codex/codex.test.mjs "the pattern comes from the checkout, else the account, else the default"
  WHEN a consult runs THEN the pattern deciding which paths are eligible for the turn's record SHALL
  be taken from the checkout, else the account, else the default, in that order.
- **AC-06-1-2** · Rev: 1 · Proof: plugin/test/codex/codex.test.mjs "a slot resolving to this model's own family is the echo case"
  IF the review model resolves to this model's own family THEN the CLI SHALL refuse the consult.
- **AC-06-1-3** · Rev: 1 · Proof: plugin/test/codex/codex.test.mjs "a path escapes the repo by neither dots nor a symlink"
  IF a named path leaves the checkout, by relative segments or by a symbolic link, THEN the CLI
  SHALL refuse to send it.
- **AC-06-1-4** · Rev: 1 · Proof: plugin/test/codex/codex-tools.test.mjs "run_check runs the named command once, from the checkout, and reports exit and tail"
  WHERE the checkout names a command the reviewer may run, the CLI SHALL run it once per consult,
  from that checkout, and SHALL report its exit status and the tail of its output.
- **AC-06-1-5** · Rev: 1 · Proof: plugin/test/codex/codex-anchor.test.mjs "a diff consult reviews the tree's own change, tests and deletions included, and says what of the turn record it left out"
  WHEN a consult selects the files it reviews THEN the CLI SHALL take the paths the caller named
  where there are any, else the turn's record where the consult is a recheck holding one, else the
  checkout's own change against the base whatever that record holds, else the record; and it SHALL
  disclose each of those last three as the ground it selected on.
- **AC-06-1-6** · Rev: 1 · Proof: plugin/test/codex/codex-anchor.test.mjs "a path that is not in the tree and has no diff reaches neither the reviewer nor the log, and leaves the turn record"
  IF a path is absent from the tree and has no diff against the base THEN the CLI SHALL send it to
  the reviewer in no form, SHALL leave it out of the file list it records, and SHALL drop it from the
  turn's record.

### UC-06-2 — List the documents a turn changed, once, at the end

Rev: 1 · Actors: agent · Enforces: BR-01

The reading is offered once at the end of a turn rather than at each write, for the reason
`plugin/hooks/how/codex-turn.md` gives, and a document whose content the last consult already read
is not offered again however recently it was touched.

- **AC-06-2-1** · Rev: 1 · Proof: plugin/test/gates/codex-turn.test.mjs "a later turn is told even though the list from an earlier one is still pending"
  WHEN the first document of a turn is written THEN the CLI SHALL ask once, and SHALL record the
  rest of that turn's documents without asking again.
- **AC-06-2-2** · Rev: 1 · Proof: plugin/test/codex/codex-record.test.mjs "a document the latest answered consult read at this content is not recorded again"
  IF the latest consult already read a document at its current content THEN the CLI SHALL not record
  it as unread, even when the document is named or touched again.
- **AC-06-2-3** · Rev: 1 · Proof: plugin/test/gates/codex-turn.test.mjs "giving up on the lock leaves a note, and the note is not counted as a refusal"
  WHILE a turn is in progress the CLI SHALL never stop it for an unread document.

### UC-06-3 — A commit waits for the reading and for the verdict

Rev: 2 · Actors: agent · Enforces: BR-01

Before a commit, two things are asked for: that documents recorded and never consulted on are read,
and that the last consult which made findings heard a disposition of each. A finding nobody ruled on
is an open finding. Nothing between commits is asked anything: a gate deciding per write reviewed
fragments, and the trigger it decided on could not be read at all.

- **AC-06-3-1** · Rev: 2 · Proof: plugin/test/gates/codex-second.test.mjs "a commit waits for the documents it stages, and not for one left dirty beside them"
  WHEN a commit stages a document recorded as unread THEN the gate SHALL refuse the commit and SHALL
  name the files it wants read.
- **AC-06-3-2** · Rev: 1 · Proof: plugin/test/gates/codex-second.test.mjs "a commit waits for a verdict on the last consult that made findings"
  IF the last consult made findings and heard no disposition THEN the gate SHALL refuse the commit
  and SHALL name the command that records one.
- **AC-06-3-3** · Rev: 1 · Proof: plugin/test/gates/codex-second.test.mjs "a commit is judged by the tree it names, not the shell's"
  WHEN a commit names another tree THEN the gate SHALL judge it by that tree rather than by the
  shell's.
- **AC-06-3-4** · Rev: 1 · Status: retired (ISS-360)
  WHEN work is deleted rather than written THEN the gate SHALL treat the deletion as work in the
  tree, a whole directory included.

### UC-06-4 — What the built-in advisor said travels into the consult

Rev: 1 · Actors: agent · Status: retired (ISS-360)

Retired because the first reviewer is server-side: nothing fires when it speaks, its reply is
encrypted the moment the turn moves on, and the only readings left to a gate were a guess at whether
it spoke and a search for one word in a command. What it said now reaches the second reviewer, and
the record, by the author's hand or not at all.

- **AC-06-4-1** · Rev: 1 · Status: retired (ISS-360)
  IF the advisor has spoken this turn and its advice is unspent THEN the gate SHALL ask once for that
  advice to be carried into the consult's intent, and SHALL then let the write through.
- **AC-06-4-2** · Rev: 1 · Status: retired (ISS-360)
  IF no advisor spoke before a consult THEN the gate SHALL ask nothing, since the order of the two
  is the author's.
- **AC-06-4-3** · Rev: 1 · Status: retired (ISS-360)
  WHEN the phrase appears only inside data — a document body, a quoted argument, a program's own
  string — THEN the gate SHALL not read it as a consult.

### UC-06-5 — Every finding is disposed of by identifier

Rev: 1 · Actors: agent · Enforces: BR-01, BR-03

Each finding is accepted or rejected with a reason, by the identifier the review gave it, and the
disposition is replayed into the next consult. Rejecting a finding with a reason is a legitimate
outcome; leaving it unruled makes "resolved or still open" a guess.

- **AC-06-5-1** · Rev: 1 · Proof: plugin/test/codex/codex-log.test.mjs "a verdict names findings by id, and a name the reply never gave is refused"
  WHEN a disposition is recorded THEN it SHALL be stored against the identifier the review gave, and
  SHALL travel into the next consult.
- **AC-06-5-2** · Rev: 1 · Proof: plugin/test/codex/codex-log.test.mjs "a credential in a consult record is masked before the line is written"
  WHEN a credential appears in anything written to the log THEN it SHALL be masked before it is
  written down.

### UC-06-6 — Compare the log's last hundred consults with the hundred before them

Rev: 1 · Actors: agent · Enforces: BR-16

Nothing a reviewer answers is diffable, so an upgrade to the harness shows up only as a shift in what
the reviews cost and in how much of them was kept. The log holds both, and this comparison is what
turns them into a judgement rather than an impression. How the windows are sized, why a crossing
writes a reading and what pinning one is for is `docs/cli/stats-the-eval.md`. That reading shares a
store with the run corpus's, whose own side of it is EI-08, and this use case is the consult side
alone.

- **AC-06-6-1** · Rev: 1 · Proof: plugin/test/codex/codex-plan.test.mjs "the eval is the last hundred against the hundred before, scored on the whole log's verdicts"
  WHEN the log holds two full windows THEN the CLI SHALL compare the hundred most recently answered
  consults with the hundred answered before them, and SHALL score both on every disposition the log
  holds rather than on those falling inside a window.
- **AC-06-6-2** · Rev: 1 · Proof: plugin/test/codex/codex-plan.test.mjs "what separates the windows is counted per value, not merely listed"
  WHEN two windows of consults are compared THEN the CLI SHALL say what separates them as a count of
  consults on each side for every value of the slot asked for, the model behind it, the prompt
  version and the reasoning effort.
- **AC-06-6-3** · Rev: 1 · Proof: plugin/test/codex/codex-plan.test.mjs "the eval writes nothing and refuses a window nobody can act on"
  WHEN the comparison is asked for, on the screen or as one object, THEN the CLI SHALL leave the log
  exactly as it found it.
- **AC-06-6-4** · Rev: 1 · Proof: plugin/test/codex/codex-log.test.mjs "the consult that takes the log onto a hundred-mark names the eval; the one before it says nothing"
  WHEN a consult's own record brings the log to a positive multiple of a hundred answered consults
  THEN that consult SHALL end on one line naming the comparison to run, counted from where that
  record sits among the answered consults rather than from anything holding the last crossing.
- **AC-06-6-5** · Rev: 1 · Proof: plugin/test/codex/codex-log.test.mjs "the consult that takes the log onto a hundred-mark names the eval; the one before it says nothing"
  WHEN that line is printed THEN the CLI SHALL take the comparison from the log as it stood when the
  record landed, SHALL attempt to append it as the reading for that mark unless that mark is held
  already, and SHALL end the same line with what became of it.
- **AC-06-6-6** · Rev: 1 · Proof: plugin/test/codex/codex-plan.test.mjs "a stored consult reading is the before window, scored as it was at the mark, on every checkout"
  WHERE a held reading is named as the earlier window the CLI SHALL put that reading's later window
  in the sliding one's place, scored as it stood at the mark rather than rescored by anything
  recorded since.
- **AC-06-6-7** · Rev: 1 · Proof: plugin/test/codex/codex-plan.test.mjs "a short window says its real size, and a log too young says it has no window before"
  WHERE the log does not reach two full windows the CLI SHALL compare as far back as it reaches and
  SHALL say how far short of a window it fell, rather than compare against consults the log does not
  hold.

## Business rules enforced

*Which rules of the BRD does this requirement carry out?*

| Rule | How this requirement carries it |
|---|---|
| BR-01 | every refusal names the consult or the disposition that clears it |
| BR-16 | what comes back from a model is read and ruled on, because nothing about it is diffable |
| BR-03 | a disposition is recorded rather than remembered, and a rejection carries its reason |
