# SRS §6 — FR-04 — Typed records

Rev: 1 · Actors: agent, reviewer · Enforces: BR-01, BR-02, BR-03, BR-14 · Coupling: schema · Source: docs/issue-flow-contract.md

← [Index](./README.md) · [§5 FR-03 The lease](./fr-03-the-lease.md) · Next: [§7 FR-05 Earned transitions](./fr-05-earned-transitions.md)

## Purpose

*Why does this requirement exist?*

The payloads a workflow produces were invented at the keyboard, and a second run invented them
differently — the contract's first dry run names the four that had no shape to copy. A payload with
one shape can be written the same way twice, read back by kind, assembled into a report nobody
writes from memory, and checked for presence by the verb that judges a status.

Each record renders for a person to read and closes with a line naming its kind and the contract
version it was written under, so a rule that changes tomorrow owes nothing backwards.

## Actors

*Who acts here?*

- **The agent**, which writes every record and holds the lease while it does.
- **The reviewer**, whose outcome is one of the two voices in a review record.

## Use cases

*What may be written, and what is refused?*

### UC-04-1 — Write a payload of a known kind

Rev: 1 · Actors: agent · Enforces: BR-01, BR-14

Every kind has named fields, and a missing one is refused by name rather than defaulted. The kinds
are the workflow's: what was found, what was decided, what was asked, what already failed, what was
reviewed, what each criterion was judged to be, where the change now runs, what a release says, and
a correction beside any of them.

- **AC-04-1-1** · Rev: 1 · Proof: plugin/test/flow/record.test.mjs "a record renders for a person and its payload is a fenced block keyed by flag"
  WHEN a record is written THEN the CLI SHALL refuse each missing field by name and SHALL name the
  kind and the contract version on the record's last line.
- **AC-04-1-2** · Rev: 1 · Proof: plugin/test/flow/record.test.mjs "a park records the status it left, and free text is no record"
  IF free text is written where a record is expected THEN the reader SHALL treat it as no record.
- **AC-04-1-3** · Rev: 1 · Proof: plugin/test/flow/record.test.mjs "a repeated value carrying the separator, a newline and a fence marker reads back byte for byte"
  WHEN a field holds several values THEN the record SHALL read back with exactly the values it was
  written with, whatever those values contain.
- **AC-04-1-4** · Rev: 1 · Proof: plugin/test/flow/earned/batched-verdict.test.mjs "one write carries a block per criterion, and each block reads back as its own record"
  WHERE a kind names the key its payload opens a block on, one write SHALL carry a block for each
  value of that key, and each block SHALL read back as the record a write of that block alone
  produces.
- **AC-04-1-5** · Rev: 1 · Proof: plugin/test/flow/earned/batched-verdict.test.mjs "a criterion named twice in one write is refused, and nothing is posted"
  IF one write opens two blocks on the same value THEN the CLI SHALL refuse the write and SHALL name
  that value.

### UC-04-2 — Evidence is checked before it is cited

Rev: 1 · Actors: agent · Enforces: BR-02

A reference the tracker cannot resolve is not evidence. What a record cites — an attachment on the
issue, a URL, or a commit — has to exist at the moment the record is written, and it is checked
again when the record is read back, because a comment may have been written by a hand or by a
client no check sits in front of.

- **AC-04-2-1** · Rev: 1 · Proof: plugin/test/flow/record.test.mjs "a record with no mark and no earlier citation is refused by the flag, and says what is there"
  IF a record cites an attachment that is not on the issue THEN the CLI SHALL refuse the record and
  SHALL say what the reference has to be.
- **AC-04-2-2** · Rev: 1 · Proof: plugin/test/flow/advance.test.mjs "released needs a verification and a release note, and closed needs only released"
  WHEN a record is read back THEN its evidence SHALL be checked again against the issue.
- **AC-04-2-3** · Rev: 1 · Proof: plugin/test/flow/earned/batched-verdict.test.mjs "a file two criteria cite goes up once, under the one name both of them carry"
  WHERE more than one block of one write cites the same file, the CLI SHALL upload it once and every
  block citing it SHALL cite the name it was uploaded under.

### UC-04-3 — A review is two voices in one record

Rev: 1 · Actors: agent, reviewer · Enforces: BR-01, BR-03

Two voices share one record: the outcome belongs to the reviewer and covers one head, and the
finding lines belong to the author. What each may say, and why one can never be derived from the
other, is the contract's "A review is two voices in one record".

- **AC-04-3-1** · Rev: 1 · Proof: plugin/test/flow/record.test.mjs "a review names its reviewer, head and outcome, and each finding is an id with a verdict"
  WHEN a review is recorded THEN it SHALL name the reviewer, the head judged and the outcome, and
  each finding SHALL be an identifier with a disposition.
- **AC-04-3-2** · Rev: 1 · Proof: none yet — ISS-16
  WHEN the outcome is written THEN the reviewer's verdict and the author's dispositions SHALL be
  separate values, so the honest value and the passable value cannot differ.
- **AC-04-3-3** · Rev: 1 · Proof: none yet — ISS-34
  WHERE a review spans several rounds each finding identifier SHALL name the round that issued it.

### UC-04-4 — A wrong record is corrected, never removed

Rev: 1 · Actors: agent · Enforces: BR-03

A record that can be quietly deleted and reposted is a record that can be made to say anything. A
correction says what moved and why, and it stands beside what it corrects; a plan or criteria change
after approval is refused without one, so criteria cannot be relaxed to fit what got built.

- **AC-04-4-1** · Rev: 1 · Proof: plugin/test/flow/record.test.mjs "a correction says what moved and why, both required"
  WHEN a correction is written THEN it SHALL carry what moved and why, and SHALL refuse without
  either.
- **AC-04-4-2** · Rev: 1 · Proof: none yet — ISS-11
  WHEN a report is assembled THEN it SHALL show every instance of a kind that repeats rather than
  the latest one.

### UC-04-5 — The criteria are numbered lines, and a conjunction is a warning

Rev: 1 · Actors: agent · Enforces: BR-01

A criterion is a line opening with its number, which is what a verdict names. Whether a criterion
is really two is a warning at the write and never a refusal: a lexical check cannot tell two claims
from one sentence, and a run that read the warning and kept a list of accepted values was right to.

- **AC-04-5-1** · Rev: 1 · Proof: plugin/test/flow/advance.test.mjs "the criteria field is read through the fence, and unnumbered prose is no criteria"
  WHEN the criteria field is read THEN prose without numbered lines SHALL be read as no criteria.
- **AC-04-5-2** · Rev: 1 · Proof: plugin/test/flow/record.test.mjs "criteria are numbered lines, and a conjunction is a warning the caller decides on"
  IF a criterion holds a conjunction THEN the CLI SHALL warn at the write and SHALL still write it.

### UC-04-6 — A report is assembled, never remembered

Rev: 1 · Actors: agent, developer · Enforces: BR-02

What an issue holds is read off the record: the latest of each kind that can only be current, every
instance of a kind that repeats, the latest verdict per criterion, and what is still owed. Nobody
counts, and nobody writes a report from memory.

- **AC-04-6-1** · Rev: 1 · Proof: plugin/test/flow/advance.test.mjs "--owed ends by naming the contract's part for the status it would enter, on both answers"
  WHEN a report is asked for THEN it SHALL name what is owed, so a criterion with no verdict is
  visible without anyone counting.
- **AC-04-6-2** · Rev: 1 · Proof: plugin/test/flow/earned/batched-verdict.test.mjs "three criteria are judged in one write, and the report prints each one"
  WHEN a report holds a record carrying several blocks THEN it SHALL print each block as it prints a
  record written on its own.

## The way back

*What undoes a change here?*

A record's rendered shape is also its read format, so changing a field name or a separator makes
every record already on the tracker unreadable. Two things make that reversible: the contract
version on the last line of every record, and the contract's own rule about what a payload written
under an older version still earns (`docs/issue-flow-contract.md`, "A rule change owes nothing
backwards"). So a shape change bumps the version and leaves the old reader in place; it never
rewrites a record, and it never deletes one (BR-03). A shape change that only adds does not bump it,
and the test of that is the direction an older reader is wrong in: a reader that takes the first
value of each single field reads the first block of a several-block payload and reports the rest as
owed, which refuses a status it should have earned rather than earning one it should not.

## Business rules enforced

*Which rules of the BRD does this requirement carry out?*

| Rule | How this requirement carries it |
|---|---|
| BR-01 | a missing field is refused by name, with the write that supplies it |
| BR-02 | every payload is on the record, and a report is assembled from it |
| BR-03 | a correction stands beside what it corrects, and nothing is deleted |
| BR-14 | every field a record takes is used or refused |
