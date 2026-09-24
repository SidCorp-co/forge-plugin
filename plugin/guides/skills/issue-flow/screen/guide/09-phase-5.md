## Phase 5 — Make the change judgeable, and hand it over by status

**This run does not judge its own change where the project asks for a judgement other than the
builder's**: a verdict under its own id earns nothing there, so writing one is a round spent to be
refused. What it does is make the change judgeable and leave the record a judging run claims from.

**Where the judging sits inside the run is the project's route, read in Phase 0.** Where a candidate
is deployed before it is promoted, the deploy comes first and the promotion waits on the judgement.
Where the deployment is fed by the branch a change lands on, Phase 7's landing is taken first and
this phase resumes at the deployment that landing produced. The statuses move in one order either
way — `developed` on the mark the landing writes, `testing` on the judgement — and neither moves
before what earns it.

**The deployment identity is acquired here and left on the issue.** Read back the commit the
deployment itself reports serving. A deploy command's exit code says a command returned and a branch
head says what somebody pushed; neither is the identity, and a judging run that finds none is
refused and comes back having judged nothing. It reads the identity back for itself rather than
taking this run's word for it, so what this phase leaves is what its own reading is compared
against. Which head, what each kind of change owes as evidence and how to capture it is the
verification reference again, read for that question: `forge guide issue-flow verification`.

**Then the two runs part, and which of them judges is the declaration Phase 0 read.**

**The parting below is for the route that judges after the landing**, and the other route has no
version of it: where the candidate is judged before it is promoted, nothing has landed for a second
run to claim from, and a status nothing has reached hands nothing over. That combination — an
independent judge and a judging route that comes first — is not one this method answers, and the
run that meets it says so in its report rather than inventing a handover to fit.

**Where that judgement is an independent run's, this run judges none of it and ends where its ship
mode leaves it.** It writes the records it has earned, judges what Phase 3 left it to judge, and
stops. It dispatches nobody and it waits for nothing. The criteria the plan named under `##
Witnessed on screen` stay on the issue, which is where the judging run reads its own brief.

<!-- forge:when ship self -->
**This run lands the change itself, so it ends at `developed` and the handoff is that status** —
not a message and not a lease. A lease ends with the run that took it, so an issue left there is a
free issue at a status somebody else claims from, and nothing in the route asks for a tool a judging
role does not ship.
<!-- forge:end -->
<!-- forge:when ship ready -->
**This run reaches no rung**, so the identity and the records it left on the issue are the whole of
what it hands over, and the judging is dispatched off the landing rather than off a status.
<!-- forge:end -->

**Where the project declared the judgement the builder's own, or declared nothing, no second run
exists to hand to and this one carries on.** It judges its own change against the criteria, writes
the verdicts under its own id, and takes the rungs the phases below name. A `screen` project that
has declared neither is a clash `forge doctor` reports on every run, met in Phase 0 rather than
discovered here.

**Judging your own change starts with a charter and not with the criteria.** Starting from the list
means re-reading your own intent, and a change that answers every line of it can still lose the
person using it. So the charter is written before any observation is mapped to a criterion: the role
being played, the task being attempted, the state it starts from, the result it intends, and the
short trace of acts and outcomes it took. It covers the screen the journey enters by and the one it
leaves by, one interruption or recovery — the lapsed session, the second submit, the back button —
and one alternate state or role. Only then are the observations read against the criteria. What a
charter is not: a redesign nobody asked for, a requirement nobody stated, or a destructive act taken
on a live system to see what happens.

**Only a demonstrated harm is worth a repair.** A finding earns one where it demonstrates material
harm to a task this change is meant to support — the task cannot be completed, its result is
materially wrong, work is lost, or an accessibility barrier stands with no reasonable way round it —
and it carries the steps that reproduce it, the behaviour expected and what that expectation rests
on, the harm observed, and the identity it was seen at. Everything else is written and holds
nothing: a preference about a layout no harm was demonstrated from, and a defect that was there
before this change, are each an issue of their own rather than this one's to answer, and the rung
they were met at moves on the verdicts.

**A repair replaces the thing that was judged, and the verdicts taken at the identity it replaced do
not carry**: they judged something that is no longer running, and a rung that accepted them would be
answering for code nobody shipped. Under an independent judgement that repair is a fresh dispatch
against this issue rather than this run resumed, so what it needs is on the record and not in a
session.

**A criterion the judging run could not reach is a shortfall, not a pass.** Where every criterion
under a declared screen change would be a skip, what was owed was a credential, a capture route or a
person — and that is asked for the way Phase 2 asks, not reported at Phase 7 when the judging is
over.

A change that proves unshippable is an outcome: post the finding, leave the branch named, park the
issue.

Something you found that belongs to another issue goes there with `forge comment -h`, and the record
that it went stays on this one: `forge record routed` names what was found and where it went, and
`--none` is how a run that met nothing beside its own subject says so. That record is the only thing
the report's filing line is built from, so a finding delivered and never recorded reads afterwards as
a run that found nothing.

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
