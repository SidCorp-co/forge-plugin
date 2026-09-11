## Phase 5 — Make it judgeable, hand it to the judge, and answer what comes back

**This run does not judge its own change**: a verdict under its own id earns nothing here, so writing
one is a round spent to be refused. What it does is make the change judgeable, dispatch the judge,
and answer what comes back.

**Where the judging sits inside the run is the project's route, read in Phase 0.** Where a candidate
is deployed before it is promoted, the deploy comes first and the promotion waits on the judgement.
Where the deployment is fed by the branch a change lands on, Phase 7's landing is taken first and
this phase resumes at the deployment that landing produced. The statuses move in one order either
way — `developed` on the mark the landing writes, `testing` on the judgement — and neither moves
before what earns it.

**The deployment identity is acquired before the dispatch, never after it.** Read back the commit the
deployment itself reports serving. A deploy command's exit code says a command returned and a branch
head says what somebody pushed; neither is the identity, and a judge dispatched without one is
refused and comes back having judged nothing. Which head, what each kind of change owes as evidence
and how to capture it: `forge guide issue-flow verification`.

**Then dispatch the judge and wait.** The brief is the issue, its criteria, the environment and that
identity, and the role is the `qa` one this plugin ships. It exercises the change as a person using
it, writes one verdict per criterion under an id of its own citing that identity, and writes a
finding for anything a user meets that no criterion named. Nothing advances from this phase; what a
record holds before either status is earned: `forge guide contract developed`,
`forge guide contract testing`.

**A finding that blocks is this run's work, not a note on the issue.** Which findings block, and
where the others go instead, is `forge guide issue-flow verification`. Answer it in the tree, deploy
again, acquire the identity that deployment now reports, and dispatch the judge again against it.
**The verdicts taken at the identity the repair replaced do not carry**: they judged a thing that is
no longer running, and a rung that accepted them would be answering for code nobody shipped.

**A criterion the judge could not reach is a shortfall, not a pass.** Where every criterion under a
declared screen change would be a skip, what was owed was a credential, a capture route or a person
— and that is asked for the way Phase 2 asks, not reported at Phase 7 when the judging is over.

A change that proves unshippable is an outcome: post the finding, leave the branch named, park the
issue.

Something you found that belongs to another issue goes there with `forge comment -h`.

<!-- forge:when feedback.plugin bugs all -->
A defect in this plugin that proving this change met is filed against this plugin's own backlog
here, with the evidence this phase captured cited on it rather than described in the report.
<!-- forge:end -->
<!-- forge:when feedback.plugin bugs -->

A defect is the only shape this project sends, so what this phase met that is not one — a verb
worth having, a phase that reads wrong and held anyway — goes in the run's report and no further.
<!-- forge:end -->
<!-- forge:when feedback.plugin all -->

What this phase met that is not a defect goes the same way and as the shape it is: this project
sends every shape, and one filed as a bug because that is the shape a defect takes is ranked as a
bug for the rest of its life.
<!-- forge:end -->
