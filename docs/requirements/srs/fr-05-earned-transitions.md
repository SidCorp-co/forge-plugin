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
- **A person**, who moves nothing here: their comments are what a park waits for, and the agent
  holding the lease carries their word onto the record for them. `reopen` is the one status two
  actors' findings reach through that agent: a person disagreeing with a close or a drop, and a
  judging run whose finding blocks the change it was sent to judge.

## Use cases

*What does the agent do with this, one case at a time?*

### UC-05-1 — Ask what the next status is owed

Rev: 1 · Actors: agent · Enforces: BR-01, BR-02

The agent asks what the next status would cost before spending anything. The answer names the
status, then one line per missing item, each with the write that supplies it, and moves nothing.
This is the rehearsal every phase begins with, and the reason a refusal is never the first time an
agent learns what a status wants.

- **AC-05-1-1** · Rev: 1 · Proof: plugin/test/ladder.test.mjs "--owed reports the rung the checks run, what it drops and every route up from it"
  WHEN the agent asks what is owed THEN the CLI SHALL name the next status and every missing item
  without writing to the tracker.
- **AC-05-1-2** · Rev: 1 · Proof: plugin/test/flow/advance.test.mjs "confirmed needs a confirmation, and approved the decision record beside the plan"
  WHEN an item is missing THEN the CLI SHALL print the command that supplies that item beside it.
- **AC-05-1-3** · Rev: 1 · Proof: plugin/test/flow/park/rehearsal.test.mjs "a park rehearsed prints the record the park then posts, byte for byte"
  WHEN the move being rehearsed is a park or a drop THEN the CLI SHALL rehearse it like any other
  move rather than refusing to rehearse it.
- **AC-05-1-4** · Rev: 1 · Proof: plugin/test/flow/earned/batched-verdict.test.mjs "several criteria with no verdict are one owed item carrying one write"
  WHERE more than one criterion has no verdict, the CLI SHALL name them in one item and the command
  beside it SHALL be the single write that supplies all of them.
- **AC-05-1-5** · Rev: 1 · Proof: plugin/test/flow/record/record.test.mjs "a record write ends with the line advance --owed would print, and never fails on it"
  WHEN a record is written THEN the CLI SHALL close that write with the same sentence this rehearsal
  opens with, counting the record just written, and SHALL exit zero where that sentence cannot be
  worked out at all.
- **AC-05-1-6** · Rev: 1 · Proof: plugin/test/flow/advance/judged-again.test.mjs "a reopen judges again, so a verdict from before its triage earns nothing"
  WHERE a reopen's triage leaves two or more verdicts stale, the CLI SHALL report that set as a
  single owed item whose command re-judges every member of it in one write.
- **AC-05-1-7** · Rev: 2 · Proof: none yet — ISS-2123
  WHEN a rung is read THEN the CLI SHALL read it from the complexity the tracker holds and from
  nothing in the body, and SHALL name the complexity that claimed it.
- **AC-05-1-8** · Rev: 1 · Proof: plugin/test/flow/route/credential-ahead.test.mjs "--owed says a screen change has no login to prove it with, and refuses nothing for it"
  WHERE the plan declares a screen change and the project holds no test credential, the CLI SHALL
  say so in the rehearsal of every status below `testing`, and SHALL refuse none of them for it.
- **AC-05-1-9** · Rev: 1 · Proof: plugin/test/flow/resume/resume.test.mjs "the claim and the resume print the lane, and neither composes a line of it"
  WHEN the agent asks what is owed, takes an issue's lease, or has its context re-minted THEN the
  CLI SHALL name every status from the issue's own onwards with the payloads that earn each at the
  issue's own rung, and SHALL say of a status the rung leaves no payload to write that nothing is
  owed at it.
- **AC-05-1-10** · Rev: 1 · Proof: plugin/test/flow/route/baseline-ahead.test.mjs "--owed names the published baseline and the write that cites it, and says so where none is published"
  WHERE a whole-tree gate result is published for the commit the checkout stands at, the rehearsal
  of every status below the one a baseline earns SHALL name that commit and SHALL print the write
  that cites it; where none is published for that commit the rehearsal SHALL say so and SHALL name
  the fresh run, a result published for another commit answering for no tree but its own.
- **AC-05-1-11** · Rev: 1 · Proof: plugin/test/guides/phases.test.mjs "the opening names the work the last run left, and says what can be reached of it"
  WHERE the worklog holds a branch and the issue's status owes a phase, the CLI SHALL name that
  branch, the head it stands at and the commit it was cut from when the agent takes the issue's lease
  or has its context re-minted.
- **AC-05-1-12** · Rev: 1 · Proof: plugin/test/flow/resume/worklog.test.mjs "the opening says what can be reached of the head, and never asks a remote"
  WHERE a branch is named, the CLI SHALL report what the checkout it is read in observes of that head
  without contacting a remote — that the checkout holds it, that it does not, or that no reading was
  possible — and SHALL qualify any statement about a remote as that checkout's own last fetch.
- **AC-05-1-13** · Rev: 1 · Proof: plugin/test/flow/landing/take.test.mjs "the resume names the work through the verb, and a status owing no phase says it below"
  WHERE the worklog holds a branch, the CLI SHALL print the branch and the head exactly once when it
  re-mints the issue's context, whichever block of that context carries them.
- **AC-05-1-14** · Rev: 1 · Proof: plugin/test/guides/rounds.test.mjs "the rounds line says which consult its count is of, on both surfaces that print it"
  WHERE a rung buys fewer rounds than the top one, the line stating its consult allowance SHALL say
  which read that allowance is of and which read it is not of, a number whose subject is unstated
  being one a run cannot tell an overspend from.
- **AC-05-1-15** · Rev: 1 · Proof: plugin/test/codex/codex-read.test.mjs "the refusal says this read is owed at every rung, before it offers the stand-down"
  WHEN a write of the plan or the criteria is refused for a file no reviewer has read THEN the
  refusal SHALL say that the read is owed at every rung, before it names anything that would stand
  the check down.
- **AC-05-1-16** · Rev: 1 · Proof: plugin/test/flow/resume/resume.test.mjs "the brief headlines the review's outcome and head and the baseline's result"
  WHERE the record holds a baseline or a review, the CLI SHALL headline the latest of each when it
  re-mints the issue's context, the baseline with the result its gate gave and the review with its
  outcome and the head it judged, these being what a resuming run needs before anything else.
- **AC-05-1-17** · Rev: 1 · Proof: plugin/test/flow/resume/resume.test.mjs "the footer counts the typed records it read and points at the report for the ones it gave no line"
  WHEN the CLI re-mints an issue's context THEN it SHALL say how many typed records it read and,
  where a later record of their kind superseded any of those, how many.
- **AC-05-1-18** · Rev: 1 · Proof: plugin/test/flow/resume/resume.test.mjs "the footer counts the typed records it read and points at the report for the ones it gave no line"
  WHERE the full report prints more records than the re-minted context shows, the CLI SHALL say how
  many more there are and name the command that prints them, and SHALL say nothing of it where the
  context shows them all, so a stranger reading a few headlines learns the rest exists.

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
- **AC-05-2-2** · Rev: 1 · Proof: plugin/test/flow/earned/entry-checks.test.mjs "approved needs the plan with every required declaration, and numbered criteria"
  IF the record lacks an item the next status is earned by THEN the CLI SHALL refuse the transition
  and name every missing item, not the first.
- **AC-05-2-3** · Rev: 1 · Proof: plugin/test/flow/advance.test.mjs "--owed reads the line the last write left, and an issue without one offers none"
  WHEN the same issue is advanced from two different checkouts THEN the CLI SHALL give the same
  answer, since the record is what it reads.
- **AC-05-2-4** · Rev: 1 · Proof: plugin/test/flow/advance.test.mjs "a comment carrying the tag and little else is no payload"
  WHEN a comment carries a record's tag but not the fields its shape declares THEN the CLI SHALL
  treat it as no payload.
- **AC-05-2-5** · Rev: 1 · Proof: plugin/test/flow/earned/batched-verdict.test.mjs "advance earns tested from a batched write exactly as from one write per criterion"
  WHEN the verdicts on several criteria are written in one record THEN the CLI SHALL judge the status
  exactly as it judges one record per criterion.
- **AC-05-2-6** · Rev: 1 · Proof: plugin/test/flow/earned/entry-checks.test.mjs "a baseline that measured part of the tree earns nothing, and one that names no scope is not refused for it"
  IF the latest baseline records that its gate run measured part of the tree THEN the CLI SHALL
  refuse `in_progress` and SHALL name the gate command that baseline itself recorded.
- **AC-05-2-7** · Rev: 1 · Proof: plugin/test/flow/earned/entry-checks.test.mjs "a baseline that measured part of the tree earns nothing, and one that names no scope is not refused for it"
  WHERE a record was written before a field was added to its shape, the CLI SHALL read it back as a
  whole payload rather than refusing it for lacking that field.
- **AC-05-2-8** · Rev: 1 · Proof: plugin/test/flow/earned/entry-checks.test.mjs "a cited baseline is taken at every rung, and refused on a record that carries no head"
  WHERE the latest baseline cites a recorded gate result, the CLI SHALL judge `in_progress` on the
  scope, the head and the commit that record itself carries and on no other reading, the state of a
  tree being no property of the issue looking at it.

- **AC-05-2-9** · Rev: 1 · Proof: plugin/test/flow/record/rung.test.mjs "the three records approved cites go in one call, and that call moves the status"
  WHEN a write of a typed payload leaves the next status earned and that payload is one the next
  status is earned by THEN the CLI SHALL transition the issue in the same call, SHALL report the
  status it left and the status it entered, and SHALL read that status's entry criteria rather than
  the payload it was handed.
- **AC-05-2-10** · Rev: 1 · Proof: plugin/test/flow/record/rung.test.mjs "a write of a kind the rung does not cite moves nothing, however complete the rung is"
  IF the payload written is not one the next status is earned by THEN the CLI SHALL leave the status
  where it stands, however little that status is owed.
- **AC-05-2-11** · Rev: 1 · Proof: plugin/test/flow/earned/entry-checks.test.mjs "in_progress owes the branch the change is built on, and the refusal names the capture"
  IF the worklog holds no branch THEN the CLI SHALL refuse `in_progress` and SHALL name the capture
  that writes one.

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
- **AC-05-4-5** · Rev: 1 · Proof: none yet — ISS-2124
  WHEN a park was a mistake THEN the CLI SHALL require a correction naming the park and the status
  resumed before it transitions back.
- **AC-05-4-6** · Rev: 1 · Proof: plugin/test/flow/park/park.test.mjs "a question park carries what would settle it, built from the readings where the call names none"
  WHEN the agent parks an issue as a question THEN the CLI SHALL carry into that transition the text
  that would settle it, built from the readings the question record already holds where the call
  supplies none, and never from the reason the work stopped.
- **AC-05-4-7** · Rev: 1 · Proof: plugin/test/flow/park/park.test.mjs "a person's answer relayed on the record resumes a park no comment on the parker's credential can"
  WHEN the agent carries a person's answer to a park onto the record, naming who gave it and in their
  words, THEN the CLI SHALL resume the park as it would on that person's own comment, whatever
  credential the record was written on.

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

- **AC-05-6-1** · Rev: 1 · Proof: plugin/test/flow/earned/merged-mark.test.mjs "developed needs the mark, its commit, and an approving review of that commit"
  IF the latest approving review judged neither the commit the merged mark names nor the reviewed
  head that mark records THEN the CLI SHALL refuse `developed` and name the commit judged beside the
  commit marked.
- **AC-05-6-2** · Rev: 2 · Proof: plugin/test/flow/earned/merged-mark.test.mjs "a verdict at the judged head stands where the landing moved none of the change's paths"
  IF a verdict judged neither the merged commit nor the judged head the merged mark records THEN the
  CLI SHALL refuse `testing` and name the criterion, the commit judged and the merged commit.
- **AC-05-6-3** · Rev: 1 · Proof: plugin/test/flow/earned/merged-mark.test.mjs "tested needs one verdict per criterion, passing, at the merged commit"
  WHEN a criterion has no verdict THEN the CLI SHALL refuse `testing` and name that criterion.
- **AC-05-6-4** · Rev: 1 · Proof: none yet — ISS-2124
  WHEN a new head is merged THEN the merged mark SHALL name that head, and the CLI SHALL judge
  `developed` against the mark alone.
- **AC-05-6-5** · Rev: 1 · Proof: plugin/test/flow/earned/merged-mark.test.mjs "a verdict at the judged head stands where the landing moved none of the change's paths"
  WHERE the merged mark records a judged head, a verdict at that head SHALL earn `testing` only where
  the mark says the landing moved no path the change touched.
- **AC-05-6-6** · Rev: 1 · Proof: plugin/test/flow/earned/entry-checks.test.mjs "a file the landing wrote and the plan does not name owes a correction"
  IF the merged mark records that the landing wrote a path which neither the plan's text nor a
  correction names THEN the CLI SHALL refuse `developed`, name that path, and print the correction
  that clears it.
- **AC-05-6-7** · Rev: 1 · Proof: plugin/test/flow/verdicts/fail-holds.test.mjs "a whole fail standing on a criterion refuses awaiting_release and closed, naming the criterion"
  IF a criterion's latest verdict is a failed one THEN the CLI SHALL refuse `awaiting_release` and
  `closed` as it refuses `testing`, and name that criterion, because a rung past the judging that
  ignores a fail releases a change its own record says does not work.

### UC-05-7 — What the plan declared decides what the ship steps owe

Rev: 2 · Actors: agent · Enforces: BR-01, BR-02

Which declarations a plan must answer is decided in one place, and the plan write and `approved`
both read it, so a typed plan the write accepts is never one `approved` refuses for a missing
declaration; today it holds whether this is a screen change, whether it couples to a schema and
whether it couples to a deploy. What a screen change and schema coupling declare is read at the
ship steps rather than at the write. Entering `testing`, a screen change owes an attachment on every
verdict and schema coupling owes the migration risk classification. Entering
`awaiting_release`, a screen change owes a person's answer instead. Whether that
person is owed at all is the project's to decide in its own configuration, because a project whose
release lands where a person can still look at it afterwards is not the product the rule was written
for.

- **AC-05-7-1** · Rev: 1 · Proof: plugin/test/flow/advance.test.mjs "what the plan declared decides what the ship steps owe"
  IF the plan declares schema coupling and no attachment carries the migration risk classification
  THEN the CLI SHALL refuse `testing` and name the attachment it wants.
- **AC-05-7-2** · Rev: 2 · Proof: plugin/test/flow/advance.test.mjs "a user-facing outcome owes a person's look, and --owed says so first"
  IF the plan declares a screen change or a user-facing outcome, the project's configuration asks
  for a person, and no person has answered since the issue was parked for review THEN the CLI SHALL
  refuse `awaiting_release`.
- **AC-05-7-3** · Rev: 2 · Proof: plugin/test/flow/earned/entry-checks.test.mjs "approved needs the plan with every required declaration, and numbered criteria"
  IF the plan leaves a required declaration unanswered THEN the CLI SHALL refuse `approved` and
  quote the line of every required declaration it lacks.
- **AC-05-7-4** · Rev: 2 · Proof: plugin/test/flow/advance.test.mjs "the project's release policy decides whether a user-facing outcome parks"
  WHERE the project's configuration releases without a person, the CLI SHALL earn `awaiting_release` from
  the verification and the release note with no person's answer owed.
- **AC-05-7-5** · Rev: 2 · Proof: plugin/test/flow/record/record.test.mjs "the verification says who released it, in the project's own words and never the author's"
  WHEN a release verification is written THEN the CLI SHALL carry the project's own answer about who
  releases on that record, from a value no author supplies.
- **AC-05-7-6** · Rev: 1 · Proof: plugin/test/flow/earned/entry-checks.test.mjs "a screen change owes an attachment on every verdict that is not skipped"
  IF the plan declares a screen change and a verdict that is not `skipped` cites no attachment the
  issue carries THEN the CLI SHALL refuse `testing` and name that criterion.
- **AC-05-7-7** · Rev: 1 · Proof: plugin/test/flow/earned/entry-checks.test.mjs "a project that deploys on its own earns released by proving the deploy, not by asserting it"
  IF the project's configuration says production deploys on its own and the release verification
  names a commit other than the one the merged mark names, and does not name that commit as one the
  deployed head contains, THEN the CLI SHALL refuse `awaiting_release` and name both commits, because a
  setting deciding who is asked decides nothing about what shipped.
- **AC-05-7-8** · Rev: 1 · Proof: plugin/test/flow/earned/entry-checks.test.mjs "a project that deploys on its own earns released by proving the deploy, not by asserting it"
  IF the project's configuration says production deploys on its own and every evidence item on the
  release verification is a commit sha THEN the CLI SHALL refuse `awaiting_release`, a sha naming no
  deployment.
- **AC-05-7-9** · Rev: 1 · Proof: plugin/test/flow/earned/entry-checks.test.mjs "a declaration a plan quotes inside a code span is not one it makes"
  WHERE a declaration sits inside an inline code span, the CLI SHALL read it as a value the plan
  names rather than one it declares, because only what a plan leaves bare is what it commits to.
- **AC-05-7-10** · Rev: 1 · Proof: plugin/test/flow/record/record.test.mjs "what the report says is owed at the deploying rung is the release policy's answer"
  WHERE the project's configuration leaves a person an act to make before the release is out, the
  CLI SHALL report that act as what the deploying rung owes rather than the close, because a run
  told to close is one that closes an issue whose release nobody has made.
- **AC-05-7-11** · Rev: 1 · Proof: plugin/test/flow/close.test.mjs "a policy that leaves a person the release refuses the close, in the report's own words"
  IF the project's configuration leaves a person an act to make before the release is out THEN the
  CLI SHALL refuse `closed` and SHALL name that act in the words it reports it in, because a rule a
  careful run obeys and a careless one cannot detect is no rule.
- **AC-05-7-12** · Rev: 1 · Proof: plugin/test/flow/close.test.mjs "a project declaring no release step closes in the run that landed the change"
  WHERE the project declares that its release model is that there is no release step, the CLI SHALL
  earn `closed` from the records the deploying rung already holds and SHALL leave no act to a person,
  because a rung that waits for a release the project has declared it does not make is a keystroke
  asked of somebody for nothing (G-11).
- **AC-05-7-13** · Rev: 1 · Proof: plugin/test/flow/record/report-policy.test.mjs "the report names the policy it read wherever the issue stands"
  WHERE an issue's whole record is reported, the CLI SHALL name what the project's release policy
  declares, whatever status the issue stands at and whether or not that policy leaves anybody an
  act, because a run told only that the close is owed cannot tell a policy this CLI read from one
  it never consulted (G-13).

### UC-05-8 — A record too large to read whole

Rev: 4 · Actors: agent · Enforces: BR-02

The check reads the whole record, so a record that cannot be read whole cannot be judged. Today such
an issue is refused outright, and ISS-17 and ISS-18 own what replaces that. Every plain advance is
judged on the page, the advance into `closed` included: that rung is entered on the verdicts and the
folded findings as well as on the project's own declaration about who releases, so a page skipped
there reads a failed verdict as none. The project is read whichever way the page falls, being no
part of what a page could hold.

- **AC-05-8-1** · Rev: 2 · Proof: none yet — ISS-2124
  IF the issue's comments exceed one page THEN the CLI SHALL refuse rather than judge a status on a
  partial record, for every status whose entry criteria that record holds.
- **AC-05-8-2** · Rev: 2 · Proof: plugin/test/flow/close.test.mjs "the status a close is earned from is the flow table's own tail, and it reads no record"
  WHERE the entry criteria of the next status name no payload, the CLI SHALL fetch no comment page
  to judge that transition, the exemption being of the record a page carries and not of the
  project's own configuration, which no page carries either.

### UC-05-9 — A plan whose shape is unfinished earns no approval

Rev: 2 · Actors: agent · Enforces: BR-01, BR-02

The write judges the file it is handed and this judges the plan the issue holds, so a plan that
arrived by any route answers to the same shape. What only the issue can decide is decided here rather
than at the write: that a plan carrying no section at all is untyped, which is what keeps a plan
written before this shape existed writable, and — because the criteria are a field of their own,
which the write does not read — that every criterion is served by a step, that every step cites one
the issue holds, and that every number the witnessed section names is one the issue holds. That
section's answer is read here as well as at the write, because a plan edited anywhere but through
that write reaches this status having met nothing.

- **AC-05-9-1** · Rev: 1 · Proof: plugin/test/flow/earned/entry-checks.test.mjs "approved refuses an untyped plan, and a criterion no plan step names"
  IF the plan carries none of the sections a typed plan owes THEN the CLI SHALL refuse `approved` and
  SHALL name those sections beside the write that supplies them.
- **AC-05-9-2** · Rev: 1 · Proof: plugin/test/flow/earned/entry-checks.test.mjs "approved refuses an untyped plan, and a criterion no plan step names"
  IF a criterion of the issue is named by no step of the plan THEN the CLI SHALL refuse `approved` and
  SHALL name that criterion by its number.
- **AC-05-9-3** · Rev: 1 · Proof: plugin/test/flow/earned/entry-checks.test.mjs "schema coupling and deploy coupling each owe the way back at the write and here"
  WHERE a plan declares schema coupling or deploy coupling and carries no way back, the CLI SHALL
  refuse `approved`.
- **AC-05-9-4** · Rev: 2 · Proof: plugin/test/flow/earned/entry-checks.test.mjs "approved refuses an untyped plan, and a criterion no plan step names"
  WHEN a plan carries every section it owes, every required declaration and a step for every
  criterion THEN the CLI SHALL earn `approved` from it with nothing owed of the plan.
- **AC-05-9-5** · Rev: 1 · Proof: plugin/test/flow/earned/entry-checks.test.mjs "approved refuses an untyped plan, and a criterion no plan step names"
  IF a step of the plan cites no criterion, or cites only numbers the issue does not hold, THEN the
  CLI SHALL refuse `approved` and SHALL name that step and what it cites.
- **AC-05-9-6** · Rev: 1 · Proof: plugin/test/flow/earned/entry-checks.test.mjs "approved refuses a witnessed set citing a criterion the issue does not hold"
  IF the witnessed section of the plan cites a number no criterion of the issue carries, answers
  neither way, or answers both ways, THEN the CLI SHALL refuse `approved` and SHALL name what it read
  there.

### UC-05-10 — One actor lands, and recovers off the checkpoint

Rev: 1 · Actors: agent · Enforces: BR-02, BR-04

Four runs shipping four changes are four actors on one branch and one version file, and every one
of them meets the others: a second review after a sibling's landing moved the head, a gate re-paid
behind the lock, a conflict resolved by a stranger. One landing actor takes the ready changes in
order and never edits one. Because the builder is gone, the landing's own progress is on the issue
as the checkpoint, and every external write is preceded by a save of what is about to be written,
so a death between the two is recovered by reading back rather than by doing again (BR-02, BR-04).

- **AC-05-10-1** · Rev: 1 · Proof: tools/test/run/landing/land-ready.test.mjs "a ready branch is pinned, merged, proved to have moved nothing and promoted against that pin"
  WHEN a ready change is landed THEN the landing SHALL pin the base at the server, build the
  candidate, and compare the judged head with the candidate over the change's own paths, and SHALL
  promote, deploy or install nothing of it until the comparison moved nothing or the checkpoint
  records a fresh review at that candidate.
- **AC-05-10-2** · Rev: 1 · Proof: tools/test/run/landing/land-ready.test.mjs "a branch that conflicts with the pinned base is parked with the list, and the next branch lands"
  IF the candidate's merge conflicts THEN the landing SHALL park the issue with the conflict list
  attached, SHALL edit nothing, and SHALL go on to the next ready change.
- **AC-05-10-3** · Rev: 1 · Proof: tools/test/run/landing/land-ready.test.mjs "a base head past the pin refuses the promotion, names it, and rebuilds from the new head"
  IF the base at the server has moved from the pin THEN the landing SHALL refuse to promote, SHALL
  rebuild from a fresh pin, and SHALL void the review and judgement evidence held for the old
  candidate.
- **AC-05-10-13** · Rev: 1 · Proof: tools/test/run/landing/moved-pin.test.mjs "a base that moved none of the change's own paths carries the builder's reading to the rebuilt candidate"
  WHERE a rebuilt candidate holds a change's own paths as the candidate its builder reconciled held
  them, the landing SHALL carry that reconciliation to the rebuilt candidate rather than ask its
  builder a second time.
- **AC-05-10-4** · Rev: 1 · Proof: tools/test/run/landing/resume.test.mjs "a checkpoint at `judged` past its own push rebuilds nothing and releases nothing twice"
  WHEN a landing is resumed after a death THEN it SHALL finish only the steps the checkpoint, the
  server and the record say are still owed, and SHALL write no mark twice and no second release.
- **AC-05-10-5** · Rev: 1 · Proof: tools/test/run/landing/resume.test.mjs "nothing else takes the landing's lock between the pin and the end of the install"
  WHILE a landing holds the lock, a journal landing or a self-landing release SHALL wait until the
  landing's install has completed.
- **AC-05-10-10** · Rev: 1 · Proof: none yet — ISS-2123
  IF an install of an older release is still in flight when a newer one completes THEN the older
  SHALL never overwrite the newer installed copy.
- **AC-05-10-6** · Rev: 1 · Proof: tools/test/run/landing/land-ready.test.mjs "the landing writes the checkpoint, the mark and the statuses, and no judgement of its own"
  WHEN a landing writes THEN it SHALL write only the checkpoint, the merged mark, the release
  verification, the park it owes and the status moves the flow table allows on the builder's records.
- **AC-05-10-7** · Rev: 2 · Proof: tools/test/run/landing/batch.test.mjs "a combination the gate refuses hands both branches back together, each naming the other"
  WHEN ready changes each pass alone as candidates on the pin and fail together THEN the landing
  SHALL hand them back together, each hand-back naming the others and the failing step, SHALL land
  the rest of the set as one candidate, and SHALL blame none of them alone.
- **AC-05-10-14** · Rev: 1 · Proof: tools/test/run/landing/red-batch/search.test.mjs "a red set whose failing step names one member's path alone hands that member back and lands the rest after one gate"
  WHEN every failing case of a set's red candidate reaches the paths of exactly one member THEN the
  landing SHALL hand that member back with the failing step and cases, SHALL spend no gate to find
  it, and SHALL gate the rest once as one candidate on the same pin.
- **AC-05-10-15** · Rev: 1 · Proof: tools/test/run/landing/red-batch/record.test.mjs "a red set attributed by paths is opened before its search and resolved with the member handed back and the gates spent"
  WHEN a set's candidate is red THEN the landing SHALL record that it was red before any gate of its
  search is spent, and SHALL record how it was resolved — the strategy, the outcome, the members
  handed back and landed alone, the rounds and the gates spent — so that a red set with no
  resolution on record is read as unknown and never as a set that cost nothing.
- **AC-05-10-11** · Rev: 1 · Proof: tools/test/run/landing/batch.test.mjs "two ready branches make one candidate, one gate, one version and one update to the base"
  WHEN several ready changes are landed together THEN the landing SHALL build one candidate over one
  pinned base, SHALL spend one gate, one version and one push on it, and SHALL write each change's
  own mark and statuses against that release.
- **AC-05-10-12** · Rev: 2 · Proof: tools/test/run/landing/batch.test.mjs "the bound on the gate runs a set may spend is named before the first of them is spent"
  WHERE a landing takes several ready changes as one candidate, the gate runs it may spend SHALL be
  named before the first of them is spent, SHALL be one for a green candidate, SHALL be, for a red
  one, none to find a member the failing cases' paths name alone and two per halving of the suspects
  otherwise, SHALL gate at once no more halves than the project's runs leaves places for, and SHALL
  add, for a base that moves, no run beyond the rebuild one change's own landing is already allowed.
- **AC-05-10-8** · Rev: 1 · Proof: tools/test/run/landing/land-ready.test.mjs "the install after that promotion holds the version the release commit carries"
  WHEN the candidate is promoted THEN the landing SHALL install from the tree that shipped.
- **AC-05-10-9** · Rev: 1 · Proof: tools/test/run/landing/land-ready.test.mjs "the merged mark names the judged head, the landed head and that the landing moved nothing"
  WHEN the install has completed THEN the landing SHALL write the merged mark naming the judged head,
  the landed head and whether the landing moved the change's own paths.

### UC-05-11 — An independent judge earns `testing`

Rev: 1 · Actors: agent · Enforces: BR-01, BR-02, BR-04

A builder judging its own criteria proves the code matches what the builder thought the criteria
meant. Where a project asks for it, the judgement between `developed` and `testing` is another
actor's, exercising the deployed change as a user would; for the check to hold, who judged must be
on the record as the CLI captured it, never as the writer claims it (BR-02), and the judgement is
of one deployment, so a candidate that changed after it is judged again (BR-04).

- **AC-05-11-1** · Rev: 1 · Proof: plugin/test/flow/verdicts/judge.test.mjs "every verdict a write makes carries the writer's session id as the CLI resolved it"
  WHEN a verdict is written THEN the record SHALL carry the writer's identity as the CLI captured it.
- **AC-05-11-5** · Rev: 1 · Proof: plugin/test/flow/verdicts/judge.test.mjs "--judge is refused rather than dropped, so no writer names another run as the judge"
  IF a caller offers the judge's identity as an argument THEN the write SHALL be refused naming the
  argument.
- **AC-05-11-6** · Rev: 1 · Proof: plugin/test/flow/verdicts/judge.test.mjs "the assembled view of an issue's verdicts keeps the judge on each"
  WHEN an issue's verdicts are assembled THEN the view SHALL keep the judge's identity on each.
- **AC-05-11-2** · Rev: 2 · Proof: plugin/test/flow/verdicts/independent.test.mjs "an ordinary landing carries no deployment identity, and its judge's verdicts earn the rung"
  WHERE the project's record asks for an independent judgement, the CLI SHALL refuse `testing` while
  any standing verdict carries the builder's identity or none, and SHALL earn it once every standing
  verdict carries another judge, because whether a deployment was reported is the rung above's
  question and a judging rung asking it demanded of one actor what another answers for.
- **AC-05-11-3** · Rev: 1 · Proof: none yet — ISS-2123
  WHERE the project's record does not ask for it, the builder's verdicts SHALL earn `testing` as
  they did before.
- **AC-05-11-4** · Rev: 1 · Proof: none yet — ISS-2123
  WHERE the route verifies before the merge, a candidate whose base or batch changed after its
  judgement SHALL be refused promotion naming the judgement as void.
- **AC-05-11-7** · Rev: 1 · Proof: plugin/test/flow/verdicts/judge.test.mjs "a run holding only the dispatching session's id records the judge as inherited"
  WHEN a verdict is written THEN the record SHALL carry where the writer's identity came from beside
  the identity itself, because two identities that differ are two actors only where each is its
  own actor's.
- **AC-05-11-8** · Rev: 1 · Proof: plugin/test/flow/verdicts/independent.test.mjs "a verdict whose judge id was inherited earns nothing, however that id compares with the builder's"
  WHERE the project's record asks for an independent judgement, IF a standing verdict's identity was
  inherited from the session that dispatched the run THEN the CLI SHALL refuse `testing` naming the
  environment variable that gives a run an identity of its own.
- **AC-05-11-9** · Rev: 1 · Proof: plugin/test/flow/verdicts/independent.test.mjs "a checkpoint declaring its builder unrecoverable earns the verdict the deployment half alone"
  WHERE the project's record asks for an independent judgement and the landing checkpoint carries a
  hand-written block naming who rebuilt it and why the builder could not be recovered, the CLI SHALL
  read that builder as unknown rather than as missing and SHALL let the verdict stand on the
  deployment half alone, because a record nobody made and a record nobody can make are different
  states and only the second can be stated honestly.
- **AC-05-11-10** · Rev: 1 · Proof: plugin/test/flow/landing/reconstruction.test.mjs "a builder the claim history answers for on its own is derived rather than declared unrecoverable"
  IF a hand-written block declares the builder unrecoverable WHILE the issue's own claim history
  names exactly one run that held it at a status the change was still being built at THEN the CLI
  SHALL refuse the verdict naming that run, because a builder the record answers for is derived and
  a declared one would be a guess the key exists to stop.
- **AC-05-11-11** · Rev: 1 · Proof: plugin/test/flow/verdicts/independent.test.mjs "a judge the claim history names as a run that held the build is no judge apart from it"
  IF the landing checkpoint declares its builder unrecoverable and the issue's own claim history
  names a standing verdict's judge as a run that held it at a status the change was still being
  built at THEN the CLI SHALL refuse `testing` naming that judge, because the builder is one of
  those runs and nothing shows the judge apart from a set it is inside.
- **AC-05-11-12** · Rev: 1 · Proof: plugin/test/flow/landing/reconstruction.test.mjs "a reconstruction is disclosed on the checkpoint line and on every verdict read back against it"
  WHERE a landing checkpoint carries a hand-written block, the CLI SHALL say that it was rebuilt by
  hand, by whom, and which keys it recovered nothing for, both wherever it prints that checkpoint
  and on every verdict it reads back against it, because a verdict read back against a
  reconstruction is weaker evidence than one read back against a capture, a reader reaching a
  verdict need not have read the checkpoint, and nothing else on the record separates them.
- **AC-05-11-13** · Rev: 1 · Proof: plugin/test/flow/verdicts/independent.test.mjs "one refusal names every criterion it refused rather than one refusal for each"
  WHERE more than one standing verdict is refused for the same missing item, the CLI SHALL report
  that item once naming every criterion it refused, because a sentence repeated per criterion buries
  the one fact the reader has to act on.
- **AC-05-11-14** · Rev: 1 · Proof: plugin/test/flow/verdicts/independent.test.mjs "a verdict refused for a checkpoint that is absent names the write that puts one there"
  IF a standing verdict is refused because no landing checkpoint stands on the issue THEN the CLI
  SHALL name the write that puts one there, because the route it names otherwise reports where the
  landing is and writes no checkpoint at all.
- **AC-05-11-15** · Rev: 1 · Proof: plugin/test/flow/verdicts/independent.test.mjs "the landing's reading of which criteria were judged refuses what the entry check refuses"
  WHERE a landing reads which criteria an independent judge answered for, it SHALL count a verdict
  only where the entry check to `testing` would let that verdict stand, because two readings of one
  judgement that disagree make the landing spend a promotion on a verdict the transition will then
  refuse.

- **AC-05-11-16** · Rev: 1 · Proof: plugin/test/flow/verdicts/independent.test.mjs "an identity the checkpoint does hold is still cited, and a verdict citing some other head is refused"
  WHERE the landing checkpoint names a deployment identity, the CLI SHALL refuse `testing` while any
  standing verdict's evidence cites nothing at that identity, because a checkpoint naming one was
  written off a reading of the deployment and a verdict answering to some other head judged
  something else.
- **AC-05-11-17** · Rev: 1 · Proof: plugin/test/flow/verdicts/independent.test.mjs "the builder's own verdict earns nothing on a checkpoint that names no deployment identity"
  IF a standing verdict carries the builder's identity, was written under an inherited identity or
  carries none WHILE the landing checkpoint names no deployment identity THEN the CLI SHALL refuse
  `testing`, because what the judging rung reads is who judged and no part of that reads a
  deployment.
- **AC-05-11-18** · Rev: 1 · Proof: plugin/test/flow/verdicts/independent.test.mjs "a judge refused on a checkpoint holding no identity is handed the verdict write"
  IF a standing verdict is refused WHILE a landing checkpoint stands on the issue THEN the CLI SHALL
  name the verdict write as the route past that refusal, because a route that reports where the
  landing is reprints the refusal the reader is already holding.
- **AC-05-11-19** · Rev: 1 · Proof: plugin/test/flow/verdicts/independent.test.mjs "the rung above still owes the verification where the project declares no automatic deploy"
  WHERE the project's record asks for an independent judgement, `awaiting_release` SHALL be refused
  until a record names where the change runs, at which commit and with what evidence, whatever the
  project declares about deploying on its own, because that is the rung the deployment reading
  belongs to and no configuration drops it.

### UC-05-12 — A judging run's blocking finding reopens the issue

Rev: 1 · Actors: agent · Enforces: BR-01, BR-02

A judgement that blocks has to reach a building run without anybody noticing it first. The status
that reaches one is the tracker's reopen: the ranked queue offers it, and the triage already routes
what falls out of it. A park lands the issue where work waits on somebody instead, and the unearned
set spends a correction on an outcome the flow produces every day. So the reopen is a write of this
verb's own, refused before the status moves where the record cannot say what the work got to, and
the finding under it is worth reading on either of two grounds: the words of whoever reported the
defect, or the evidence the run captured when it saw the defect itself.

- **AC-05-12-1** · Rev: 1 · Proof: plugin/test/flow/advance/reopen.test.mjs "a reopen moves the status and writes no correction for it"
  WHEN the agent reopens an issue THEN the CLI SHALL transition it to the tracker's reopen status and
  SHALL write no correction for that move.
- **AC-05-12-2** · Rev: 1 · Proof: plugin/test/flow/advance/reopen.test.mjs "a reopen is refused where nothing on the record says what the work got to"
  IF the record names neither a merged mark nor the status a dropped park left THEN the CLI SHALL
  refuse the reopen before the status moves.
- **AC-05-12-3** · Rev: 1 · Proof: plugin/test/flow/route/reopen.test.mjs "a finding the run made itself is whole on the evidence it captured"
  WHERE a finding carries the evidence the run captured, the CLI SHALL take it as whole without the
  words of anybody.
- **AC-05-12-4** · Rev: 1 · Proof: plugin/test/flow/route/reopen.test.mjs "a finding that quotes nobody and captured nothing is no finding"
  IF a finding carries neither the reporter's words nor any evidence THEN the CLI SHALL refuse it
  naming both of the two grounds.
- **AC-05-12-5** · Rev: 1 · Proof: plugin/test/flow/advance/reopen.test.mjs "a failing verdict moves no status, the reopen being an act of its own"
  WHEN a verdict fails THEN the CLI SHALL leave the issue's status where it stands.
- **AC-05-12-6** · Rev: 1 · Proof: plugin/test/flow/route/reopen.test.mjs "a second triage repeating the first asks for nothing it already answered"
  WHERE a reopen holds more than one triage, the CLI SHALL read what that reopen owes from the
  oldest triage of the unbroken run of like outcomes ending at the newest, so that a record already
  written to answer the first of that run is not asked for a second time.
- **AC-05-12-7** · Rev: 1 · Proof: plugin/test/flow/route/reopen.test.mjs "a record the tracker stamped with the triage that unearned is not older than it"
  WHERE the record answering a reopen's triage carries the same moment as the triage that unearned,
  the CLI SHALL count it as answering that triage rather than as written before it.

## Business rules enforced

*Which rules of the BRD does this requirement carry out?*

| Rule | How this requirement carries it |
|---|---|
| BR-01 | every refusal names the missing item and the one command that supplies it |
| BR-02 | the record is read and the repository is not |
| BR-03 | a superseded review or verdict stays on the record beside the new one |
| BR-04 | the entry criteria are re-checked, so a moved commit or edited criteria fall the status back |
| BR-06 | the same checks apply to a transition asked for through the tracker's own tool (ISS-5 owes the pre-hook half) |
