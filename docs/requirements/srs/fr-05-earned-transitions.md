# SRS §7 — FR-05 — Earned transitions

Rev: 1 · Actors: agent · Enforces: BR-01, BR-02, BR-03, BR-04, BR-06 · Source: docs/issue-flow-contract.md

← [Index](./README.md) · [§6 FR-04 Typed records](./fr-04-typed-records.md) · Next: [§8 FR-06 The second opinion](./fr-06-second-opinion.md)

## Purpose

*Why does this requirement exist?*

A tracker transition succeeds whatever the issue's record holds, so a status meant to promise
something to the next reader promises nothing. This requirement is the check that a status is
*earned*: one verb reads the record, decides whether the next status's entry criteria are met, and
either transitions or names every missing item beside the command that supplies it.

It judges presence, recency and the commit a payload names — never fit. Where that line falls, and
what a check attempting fit would cost, is stated in the contract's flow table.

## Actors

*Who acts here?*

- **The agent** holding the issue's lease (`FR-03`). It is the only actor that moves a status.
- **A person**, who moves nothing here: their comments are what a park waits for, and `reopen` is
  their word — this requirement covers no reopen, and the open items say why.

## Use cases

*What does the agent do with this, one case at a time?*

### UC-05-1 — Ask what the next status is owed

Rev: 1 · Actors: agent · Enforces: BR-01, BR-02

The agent asks what the next status would cost before spending anything. The answer names the
status, then one line per missing item, each with the write that supplies it, and moves nothing.
This is the rehearsal every phase begins with, and the reason a refusal is never the first time an
agent learns what a status wants.

- **AC-05-1-1** · Rev: 1 · Proof: plugin/test/flow/advance.test.mjs "--owed on a marked fix reports the light path the checks run, and both ways off it"
  WHEN the agent asks what is owed THEN the CLI SHALL name the next status and every missing item
  without writing to the tracker.
- **AC-05-1-2** · Rev: 1 · Proof: plugin/test/flow/advance.test.mjs "confirmed needs a confirmation, and clarified a decision record"
  WHEN an item is missing THEN the CLI SHALL print the command that supplies that item beside it.
- **AC-05-1-3** · Rev: 1 · Proof: none yet — ISS-12
  WHEN the move being rehearsed is a park or a drop THEN the CLI SHALL rehearse it like any other
  move rather than refusing to rehearse it.
- **AC-05-1-4** · Rev: 1 · Proof: plugin/test/flow/batched-verdict.test.mjs "several criteria with no verdict are one owed item carrying one write"
  WHERE more than one criterion has no verdict, the CLI SHALL name them in one item and the command
  beside it SHALL be the single write that supplies all of them.
- **AC-05-1-5** · Rev: 1 · Proof: plugin/test/flow/record.test.mjs "a record write ends with the line advance --owed would print, and never fails on it"
  WHEN a record is written THEN the CLI SHALL close that write with the same sentence this rehearsal
  opens with, counting the record just written, and SHALL exit zero where that sentence cannot be
  worked out at all.
- **AC-05-1-6** · Rev: 1 · Proof: plugin/test/flow/advance.test.mjs "a reopen judges again, so a verdict from before its triage earns nothing"
  WHERE a reopen's triage leaves two or more verdicts stale, the CLI SHALL report that set as a
  single owed item whose command re-judges every member of it in one write.

### UC-05-2 — Advance to the next status

Rev: 1 · Actors: agent · Enforces: BR-02, BR-04

The agent advances one status. The entry criteria of that status are checked against the issue's
record — its typed payloads, its plan and criteria fields, its merged mark, its blocking relations
— and against nothing else. BR-02 is the rule and the contract's "Two sources, one recorded" is the
argument; the duty here is that no requirement of this product may reach for the working tree while
deciding a status.

- **AC-05-2-1** · Rev: 1 · Proof: plugin/test/flow/advance.test.mjs "the flow table names one next status, and a disposition sends the issue to dropped"
  WHEN every entry criterion of the next status is met THEN the CLI SHALL transition the issue to
  that status and report the status it left and the status it entered.
- **AC-05-2-2** · Rev: 1 · Proof: plugin/test/flow/advance.test.mjs "approved needs the plan with both its declarations, and numbered criteria"
  IF the record lacks an item the next status is earned by THEN the CLI SHALL refuse the transition
  and name every missing item, not the first.
- **AC-05-2-3** · Rev: 1 · Proof: plugin/test/flow/advance.test.mjs "--owed reads the line the last write left, and an issue without one offers none"
  WHEN the same issue is advanced from two different checkouts THEN the CLI SHALL give the same
  answer, since the record is what it reads.
- **AC-05-2-4** · Rev: 1 · Proof: plugin/test/flow/advance.test.mjs "a comment carrying the tag and little else is no payload"
  WHEN a comment carries a record's tag but not the fields its shape declares THEN the CLI SHALL
  treat it as no payload.
- **AC-05-2-5** · Rev: 1 · Proof: plugin/test/flow/batched-verdict.test.mjs "advance earns tested from a batched write exactly as from one write per criterion"
  WHEN the verdicts on several criteria are written in one record THEN the CLI SHALL judge the status
  exactly as it judges one record per criterion.

### UC-05-3 — Refuse a jump

Rev: 1 · Actors: agent · Enforces: BR-04

A status may be named as the target, and the name is checked rather than obeyed: the only legal
target is the next status in the sequence. A jump is not advancing, and a status reached without
the payload below it is a promise nobody kept.

- **AC-05-3-1** · Rev: 1 · Proof: plugin/test/flow/advance.test.mjs "a jump past where the triage routes is refused, and a side status names the park"
  IF the named target is not the next status in the sequence THEN the CLI SHALL refuse and name the
  status that is next.
- **AC-05-3-2** · Rev: 1 · Proof: plugin/test/flow/advance.test.mjs "the flow table names one next status, and a disposition sends the issue to dropped"
  WHEN the issue's status is the last of the sequence THEN the CLI SHALL refuse to advance and name
  the action a person would take instead.

### UC-05-4 — Park an issue for a person

Rev: 1 · Actors: agent · Enforces: BR-01, BR-03

A judgement call that belongs to a person is recorded rather than skipped: a park writes its kind,
its reason and its evidence, and lands the issue in the side status that kind implies. Each park
kind speaks to exactly one reader, which is what decides the status.

- **AC-05-4-1** · Rev: 1 · Proof: plugin/test/flow/advance.test.mjs "a record read back is measured by the write's own rules, and a future contract by none it has"
  WHEN the agent parks an issue THEN the CLI SHALL write a park record carrying the kind, the
  reason and the status the issue left, and SHALL then transition to the side status that kind
  implies.
- **AC-05-4-2** · Rev: 1 · Proof: plugin/test/flow/advance.test.mjs "every park kind lands in one side status, and none is left without a home"
  WHERE a park kind exists the CLI SHALL have exactly one side status for it, so no kind can park
  an issue nowhere.
- **AC-05-4-3** · Rev: 1 · Proof: plugin/test/flow/advance.test.mjs "a parked issue resumes where its park record says it left, once somebody answers"
  WHEN a parked issue is advanced and the park has been answered THEN the CLI SHALL resume at the
  status the park record says it left.
- **AC-05-4-4** · Rev: 1 · Proof: plugin/test/flow/advance.test.mjs "a parked issue resumes where its park record says it left, once somebody answers"
  IF a park is unanswered THEN the CLI SHALL refuse to resume and name who the park is waiting on.
- **AC-05-4-5** · Rev: 1 · Proof: none yet — ISS-13
  WHEN a park was a mistake THEN the CLI SHALL require a correction naming the park and the status
  resumed before it transitions back.

### UC-05-5 — Drop an issue

Rev: 1 · Actors: agent · Enforces: BR-02, BR-04

An issue that should not be built is dropped, which always means no code landed. A confirmation
whose finding is a disposition earns the drop with the same comment as its reason; anything else
needs one given at the write. A drop is refused once the merged mark is set, because code that
landed is closed, never dropped.

- **AC-05-5-1** · Rev: 1 · Proof: plugin/test/flow/advance.test.mjs "the flow table names one next status, and a disposition sends the issue to dropped"
  WHEN the latest confirmation's finding is a disposition THEN the CLI SHALL make the next status
  dropped and SHALL take the finding as the reason.
- **AC-05-5-2** · Rev: 1 · Proof: plugin/test/flow/advance.test.mjs "a drop is refused once the merged mark is set, and it is the mark that refuses"
  IF the merged mark is set THEN the CLI SHALL refuse to drop the issue.

### UC-05-6 — A later change unearns

Rev: 2 · Actors: agent · Enforces: BR-04

Each of those records names what it judged, which is what makes the fall-back computable rather
than remembered: when the merged commit moves, everything above `in_progress` is unearned except
what the mark itself accounts for, and when the criteria change, everything above `developed` is.
The mark accounts for a review at the head it records, and for a verdict at that head where it says
the landing took no path the change touched. Nothing is deleted — the earlier records stay as
superseded history and the check simply stops being met.

- **AC-05-6-1** · Rev: 1 · Proof: plugin/test/flow/merged-mark.test.mjs "developed needs the mark, its commit, and an approving review of that commit"
  IF the latest approving review judged neither the commit the merged mark names nor the reviewed
  head that mark records THEN the CLI SHALL refuse `developed` and name the commit judged beside the
  commit marked.
- **AC-05-6-2** · Rev: 2 · Proof: plugin/test/flow/merged-mark.test.mjs "a verdict at the judged head stands where the landing moved none of the change's paths"
  IF a verdict judged neither the merged commit nor the judged head the merged mark records THEN the
  CLI SHALL refuse `tested` and name the criterion, the commit judged and the merged commit.
- **AC-05-6-3** · Rev: 1 · Proof: plugin/test/flow/merged-mark.test.mjs "tested needs one verdict per criterion, passing, at the merged commit"
  WHEN a criterion has no verdict THEN the CLI SHALL refuse `tested` and name that criterion.
- **AC-05-6-4** · Rev: 1 · Proof: none yet — ISS-7
  WHEN a new head is merged THEN the merged mark SHALL name that head, and the CLI SHALL judge
  `developed` against the mark alone.
- **AC-05-6-5** · Rev: 1 · Proof: plugin/test/flow/merged-mark.test.mjs "a verdict at the judged head stands where the landing moved none of the change's paths"
  WHERE the merged mark records a judged head, a verdict at that head SHALL earn `tested` only where
  the mark says the landing moved no path the change touched.

### UC-05-7 — What the plan declared decides what the ship steps owe

Rev: 1 · Actors: agent · Enforces: BR-01, BR-02

The plan's two declarations — whether this is a screen change, whether it couples to a schema — are
read at the ship steps rather than at the write: a screen change owes a person's answer before
`released`, and schema coupling owes the migration risk classification before `tested`. Whether that
person is owed at all is the project's to decide in its own configuration, because a project whose
release lands where a person can still look at it afterwards is not the product the rule was written
for.

- **AC-05-7-1** · Rev: 1 · Proof: plugin/test/flow/advance.test.mjs "what the plan declared decides what the ship steps owe"
  IF the plan declares schema coupling and no attachment carries the migration risk classification
  THEN the CLI SHALL refuse `tested` and name the attachment it wants.
- **AC-05-7-2** · Rev: 2 · Proof: plugin/test/flow/advance.test.mjs "a user-facing outcome owes a person's look, and --owed says so first"
  IF the plan declares a screen change or a user-facing outcome, the project's configuration asks
  for a person, and no person has answered since the issue was parked for review THEN the CLI SHALL
  refuse `released`.
- **AC-05-7-3** · Rev: 1 · Proof: plugin/test/flow/advance.test.mjs "approved needs the plan with both its declarations, and numbered criteria"
  IF the plan declares neither THEN the CLI SHALL refuse `approved` and quote the two lines it
  reads.
- **AC-05-7-4** · Rev: 1 · Proof: plugin/test/flow/advance.test.mjs "the project's release policy decides whether a user-facing outcome parks"
  WHERE the project's configuration releases without a person, the CLI SHALL earn `released` from
  the verification and the release note as for any other change.
- **AC-05-7-5** · Rev: 1 · Proof: plugin/test/flow/record.test.mjs "the verification says who released it, in the project's own words and never the author's"
  WHEN a release verification is written, the CLI SHALL carry the project's own answer about who
  releases on that record, from a value no author supplies.

### UC-05-8 — A record too large to read whole

Rev: 2 · Actors: agent · Enforces: BR-02

The check reads the whole record, so a record that cannot be read whole cannot be judged. Today such
an issue is refused outright, and ISS-17 and ISS-18 own what replaces that. One status is judged on
no record at all — its entry criterion is another status — and a refusal that reached it would stop
a run one transition short of where the flow ends, so that move is exempt and the exemption is as
narrow as the criterion: a park or a drop from the same status is judged on the record like any
other move. The exemption is the judgement's and not the whole command's, because the write that
follows carries an obligation of its own to deliver a thread nobody has been shown (`FR-10`).

- **AC-05-8-1** · Rev: 2 · Proof: none yet — ISS-17
  IF the issue's comments exceed one page THEN the CLI SHALL refuse rather than judge a status on a
  partial record, for every status whose entry criteria that record holds.
- **AC-05-8-2** · Rev: 1 · Proof: plugin/test/flow/close.test.mjs "the status a close is earned from is the flow table's own tail, and it reads no record"
  WHERE the entry criterion of the next status is the issue's present status and no payload, the CLI
  SHALL judge that transition on the status alone and SHALL fetch no comment page to judge it.

## Business rules enforced

*Which rules of the BRD does this requirement carry out?*

| Rule | How this requirement carries it |
|---|---|
| BR-01 | every refusal names the missing item and the one command that supplies it |
| BR-02 | the record is read and the repository is not |
| BR-03 | a superseded review or verdict stays on the record beside the new one |
| BR-04 | the entry criteria are re-checked, so a moved commit or edited criteria fall the status back |
| BR-06 | the same checks apply to a transition asked for through the tracker's own tool (ISS-5 owes the pre-hook half) |
