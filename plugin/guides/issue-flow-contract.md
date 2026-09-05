# The issue-flow contract — a status is earned, and the tracker says what it costs

**Contract 1.** The number every typed record carries, and the one `forge doctor` reads this
file for: a copy whose file states a number the build does not read was assembled out of two
versions, and neither half knows it.

**Status: the verb is built; the contract is still ahead of it.** `forge record` (ISS-2, ISS-10),
`forge advance` (ISS-3) and `forge claim` (ISS-4) implement most of what follows. Where a rule here exceeds what the code does,
the rule names the issue that owes it, so a reader can tell the specification from the shipped
behaviour without reading the code.

## The constraint

Nine phases across ten files is more than a session reliably holds, and the only check that an
issue finished was the agent's memory of having read them. One run this week showed the split:
every obligation with a gate behind it held, every one that lived in prose slipped at least once,
and the issue that skipped the workflow was declared done with an empty criteria field and a QA
verdict that was false when posted.

The tracker already holds everything the workflow produces — plan, criteria, comments,
attachments, release notes, a merged mark — and a `transition` action over its statuses. What it
lacks is the rule that a status is *earned*: a transition succeeds whatever the record holds. So
the order of the work is prose, and prose is read only by someone who chose to read it.

## Two layers, one record

**The statuses are a communication contract.** A status is a promise to whoever reads the tracker
next, and the payload that earned it is what they may rely on. **The phases are the agent's
workflow under that contract.** Each phase exists to produce one payload, and the status an issue
holds tells the agent which phase it is in. The two do not compete; one says what is owed, the
other says how it is produced.

That collapses the workflow to a single cycle: pick an issue and claim it, read its status, run
the phase that status owes, write the payload, advance. `forge advance --owed` says what the payload is. The
skill keeps the method, its five rules and its three judgement calls — is this a screen change, is
this ambiguity expensive to reverse, is this lesson worth a line — and cites the verb for the rest.

Phases 0 and 8 sit outside the issue: discovery before the run, cleanup and learning after each
issue. They write to the project, never to a transition.

## The flow

| Status | Promise to the next reader | Earned by | Phase owed while held |
|---|---|---|---|
| `open` | someone filed this | nothing; the one status nobody earns | 1 Triage |
| `confirmed` | we read the code; the problem is real and it is this | a confirmation: where the reader looked, what the issue is in the code's own terms, and a finding — *holds*, or one of the dispositions the triage reference admits | 2 Clarify |
| `clarified` | every ambiguity is decided or answered | a decision record: each reading decided, its assumption and the sentence that undoes it, or an explicit *none found*; no question left open | 3 Plan |
| `approved` | object to the plan now, not after | plan and numbered criteria, one per line, each in its own field; the plan states whether this is a screen change and whether it touches the schema | 4 Implement, to the branch |
| `in_progress` | code is being written against this plan | `approved`; every blocker that gates dispatch at least `developed`, read from the edge's own answer and not from the list it arrived in, so a mention gates nothing; a baseline naming what already fails, recorded before entering; for a batch, the member list written when the branch is cut | 4 Implement, to the review; 5 Prove; then 7's landing |
| `developed` | the change was reviewed and is on the default branch | an approving review of the head that landed: the reviewer, the findings with a verdict on each by id, the outcome *approved*; a person's approval where the project asks for one; then the merged mark with its commit | 5 Prove |
| `tested` | the evidence is here to be judged | one verdict per criterion, each citing evidence, all at the commit the `developed` stage says a verdict may cite; every skipped check named with its reason; the migration risk classification when the plan declared schema coupling | 6, 7 Ship |
| `released` | you can see it now | a verification write citing where the change now runs; release notes, or an explicit withholding with its reason; a review comment from a person where the plan declares a screen change or a user-facing outcome and the project's config asks for one | 7 Ship, the close |
| `closed` | nothing more happens unless reopened; code landed | `released` | none |
| `reopen` | a person disagreed with a close or a drop, and their finding is here | a person's word; nothing earns it and the verb never enters it | the finding typed on their behalf and the triage of it, then the fall the triage decides: `developed`, `in_progress`, or `on_hold` blocked |

The phase a status owes produces the payload that earns the next row, so reading the status is
reading the phase — with one break, and it is the `in_progress` row. The landing that earns
`developed` is a step of Phase 7, so the judging that earns `tested` is done while the issue is
still `in_progress`, and both statuses move after the mark on a record written before it. Which
order the phases run in is the skill's to say and its Phases 5 and 7 say it; what a verdict
written before the landing has to cite is under `developed` below.

Every *earned by* is checked for presence, recency, the commit it names and, where a rule says
*since* or *later than*, its order against the record it names — a correction since a triage, a
verdict later than it — never for fit: whether an attachment is really the migration classification,
or a comment really an approving screen review, is the reviewer's judgement, and a check that tried
to make it would refuse honest records and pass dishonest ones alike. The tracker's `draft`, `testing` and `reopen` statuses are not steps and `advance`
never enters them: `draft` is the reporter's, before `open`; `testing` is a label this contract has
no use for, since `developed` already says where the change is; `reopen` is a person's, and the verb
reads the finding and the triage it leaves behind and routes what follows, below.

**The parks are messages to a person, typed by who has to answer.** Each records the status it
left, and `advance` resumes there. The other half is who lifts it: a reply from any author but the
one who parked lifts `needs_info` and `waiting`, so another agent's answer counts; a person's word
lifts `on_hold` and reopens `dropped`, and a person is a comment the tracker did not mark as an
agent's. A park that was a mistake is lifted on the record too: a correction naming the park and
the status resumed, written before the transition back, so a reader of the record sees the retraction
beside the park rather than a status that quietly disagrees with the last typed write. Owed by
ISS-13; today the lift is a raw transition the report never shows.

- `needs_info` speaks to the reporter, from `open` or `confirmed`: two or more readings, each
  with the outcome it produces. Fewer is not a question. It resumes on a reply from another author.
- `waiting` speaks to a reviewer: the kind — code review, screen review, or a destructive
  migration — and the evidence to look at. It resumes on their comment.
- `on_hold` speaks to the owner: what failed and whether the route rolled it back, why the change
  is unshippable, what blocks it, that a person paused it, or that it keeps crashing. It resumes by
  hand, except a blocked issue, which the next run picks up once its blocker is `developed`.
- `dropped` speaks to everyone: the reason — a disposition the triage reference admits, or one of
  the project's own. Reachable only before `developed`, so it always means no code landed, and it
  is never marked merged. Terminal unless reopened. Abandoning code that did land is a revert: the
  commit goes, the mark is cleared with `unmark`, the issue falls back to `approved`, and only then
  may it drop.

**Who moves a status.** The agent, by advancing, and every move, a park and a drop included, can
be asked before it is made: `--owed` prints what the move would write and where it would go and
writes nothing. A verb that can only be rehearsed for the moves that need no rehearsal is the wrong
way round; the fourth dry run dropped an issue for real to learn what a drop does. Owed by ISS-12;
today `--owed` is refused beside a park or a drop. A project that wants a person on `approved` or
`released` says so in its settings, and `advance` then waits for that person's comment instead of
moving. The default is autonomous, which is what the skill already says.

## The stages, scenario by scenario

What each status reads, and for every scenario it can meet, the payload owed and where the issue
goes. The scenario is the person's or the agent's to decide; the contract checks the payload.

**The size decides the ladder, and the ladder has three rungs.** Every tier runs the same statuses
in the same order; what differs is what three of those statuses ask for, and how many rounds the
work between them is expected to take.

**Two sources say the size, and the higher of them decides.** The first is the issue's own
`complexity` field on the tracker, whose five values claim a rung each: `xs` a trivial, `s` a fix,
and `m`, `l` and `xl` a feature, the top two of those also worth a question about splitting. The
second is a line in the body — `Size: trivial.`, `Size: fix.` or `Size: feature.` — which is what
carries an issue nobody set the field on, and every open issue filed before this rule was one. A
body claiming two rungs is at the higher, and a mark inside a fenced or indented example is not a
mark, so a body quoting this paragraph claims nothing. Where both sources speak and disagree, the
higher rung wins: the rung is spent at three statuses, so one lowered after the plan would make a
later status demand less than an earlier one already established. An issue with neither is a
**feature**, the top rung being what an unclaimed issue falls to. `forge new --size <rung>` writes
both at once, so the two agree on anything filed through this CLI; the line retires from every
surface the day no open issue carries one.

| Tier | What it claims | Payloads it stops owing | Rounds it may spend fewer of |
|---|---|---|---|
| `trivial` | one tree, no hook or skill file, no screen, no migration | the decision record, the plan field, the release note | Phase 0 is the brief alone where no source of it is stale; one consult, which *is* the whole-set read at the replayed head; no gate run after the ship, the ship having spent it |
| `fix` | one behaviour and its replacement, carrying no rule | the same three | no recheck after a consult that raised nothing |
| `feature` | anything else, and everything filed before this ladder existed | none | none |

**What a tier drops is a payload; what it saves is mostly rounds.** The two tiers below `feature`
stop owing the same three payloads, so a reader who only counts payloads cannot tell them apart.
The difference is in the last column and it is the larger saving: three payloads of ten is not half
a run, because eight transitions, the claim and the reads are a floor no entry criterion reaches.
`forge stats runs` groups its profile by tier so each row of that column is a number the next change
to this ladder is judged against, and a batch counts at the largest tier among its members.

**What no tier buys is a judgement.** The gate, the codex pass, the review, the baseline and a
verdict on every criterion cost a `trivial` exactly what they cost a `feature`: the shortest change
breaks a tree as well as the longest, and the run that spends one whole gate run is the run whose
later scoped ones mean anything. A tier that bought a judgement would be a tier that made the record
say something nobody established.

**Escalation is by meaning, before the plan, and one rung at a time.** A plan declaring a screen
change or a user-facing outcome moves the issue up one rung, because the change a person will look
at is not the change nobody sees. Work that turns out larger moves it by a correction naming the
re-size — the mark is a line in the reporter's own description, which this flow does not rewrite, so
the retraction is a record. Only the upward direction is read: a correction re-sizing an issue *down*
would unearn statuses it already holds, and a rung is not something to claim back after the plan.
The ship's own measurement of what landed is the backstop and never the decision: it prints the
tier's ceiling beside the count and the correction command past it, after the judging, where a
refusal would have nothing left to protect.

Two things no tier touches, whatever the mark says. A plan declaring schema coupling owes its
migration classification, because a destructive migration is not smaller for being small. And a
shortened comment page does not lighten anything: a cut cannot show a correction that re-sized the
issue, and losing one would *shrink* a shortfall where every other check can only grow one the cut
hid — so a page that came back short is judged as a feature's.

### `open` — reads the title, body, comments, attachments and blocking relations

| Scenario | Writes | Goes to |
|---|---|---|
| the claim holds | a confirmation with finding *holds* | `confirmed` |
| already fixed, duplicate, intended, obsolete, premise false | a confirmation with that finding | `confirmed`, then `dropped` on the next advance, the finding as reason |
| really several issues | siblings filed `open`, each naming the others; a confirmation naming them | `confirmed`, as the first of them |
| cannot tell what it is | a question: two or more readings, each with its outcome | `needs_info`; a reply from another author resumes at `open` |
| not worth doing, by a project reason | the reason | `dropped` |

### `confirmed` — reads the confirmation and the code behind it

| Scenario | Writes | Goes to |
|---|---|---|
| the finding was a disposition | nothing more; the confirmation is the evidence | `dropped` |
| no ambiguity | a decision record saying *none found* | `clarified` |
| **trivial** — the finding was *holds* | nothing, for the reason the row below gives; a one-tree change has less to be ambiguous about, not a lower bar for asking | `clarified` |
| **fix** — the finding was *holds* | nothing; the reading that mattered is the defect and the confirmation held it. A disposition still drops it, and an ambiguity too expensive to reverse is still a question: the tier drops the record, never the right to ask | `clarified` |
| ambiguity cheap to reverse | a decision record: reading chosen, assumption, undo sentence | `clarified` |
| ambiguity expensive to reverse | a question | `needs_info`; the reply resumes at `confirmed` and the decision record quotes it |

### `clarified` — reads the decision record and the body

| Scenario | Writes | Goes to |
|---|---|---|
| the plan is possible | the plan in its field; numbered criteria in theirs; the screen and schema flags, and the user-facing outcome where a person judges the result | `approved` |
| **trivial** — the plan is possible | numbered criteria alone, as the row below; writing a plan that declares a screen change or a user-facing outcome moves it one rung to `fix` | `approved` |
| **fix** — the plan is possible | numbered criteria alone, being the one check that fails without the change; no plan field, and its absent declarations read *no* — writing one that declares a screen change or a user-facing outcome is how a fix moves up a rung | `approved` |
| a criterion joined by a conjunction | a warning at the write, never a refusal | unchanged until the author splits it or keeps it |
| planning proves the claim false | a new confirmation with a disposition finding | back to `confirmed`, then `dropped` |
| the project names an approver | nothing more | `approved` once that person has commented |

### `approved` — reads the plan, the criteria and the blocking relations

The plan carries three declarations, each written `<name>: yes` or `<name>: no` in any case and
anywhere in its text: `Screen change`, `Schema coupling` and `User-facing outcome`. The first two
decide what the ship steps owe, and a plan without them does not earn `in_progress`; the third, with
the first, decides whether a person reviews the rendered change before it ships. The reader takes
the name, the colon and the next word, so a label closed in emphasis before its colon, as `**Screen
change:** no`, is a declaration it does not find.

Neither tier below `feature` owes a plan field, so each declares nothing and all three read *no*.
That is the reading, not an oversight: a change nobody sees is what the mark claims, and one that is
a screen change says so by writing the plan, which is the same act that moves it up a rung.
`forge advance --owed` prints the tier, what it drops and both routes up, because a rule whose way
out has to be inferred is a refusal nobody can act on.

| Scenario | Writes | Goes to |
|---|---|---|
| every gating blocker at least `developed` | the branch cut; the baseline naming what already fails and whether the gate run measured the whole tree, so a later red has something to be judged against; the batch relation when several ride together | `in_progress` |
| the baseline's gate ran over part of the tree | the whole run, and a baseline recording it | unchanged; a scoped run reports no red for the steps it skipped, so every green after it stands on a measurement nobody made, and the refusal names that baseline's own gate command rather than any ledger — this contract's checks read the record and no project's tooling |
| a blocker not yet `developed` | nothing; the refusal names the blocker | unchanged |
| the plan or criteria change now | a correction comment saying what moved and why, at the write | unchanged |

### `in_progress` — reads the plan and the baseline

| Scenario | Writes | Goes to |
|---|---|---|
| the change is ready | the replay onto the default branch's head, then the one read of the whole set of files the change touched, taken at that head, which is the pass the review is earned by; a review record: who reviewed, the head judged, each finding by id either accepted or rejected with the reason, the outcome | unchanged, until the merge |
| the reviewer requests changes | the fixes; a new head earns a new review | unchanged |
| the project asks a person to review | the head and the diff to look at | `waiting`, kind code review; their comment resumes |
| reviewed, and on the default branch | the merged mark with its commit and the base it landed on; where a squash changed the hash, the note names the reviewed head. The replay is the earning read's own first step, so no landing owes a round of its own: one that moves a path this change touched leaves a head nobody has read, and that head owes a fresh whole-set read and its verdicts again — never a recheck, which answers findings, and a clean pass leaves none | `developed` |
| scope grows | a plan correction before the edit | unchanged |
| the landing wrote a file the plan does not name | a correction naming it | unchanged; the mark's note says what this change itself wrote, beside what the landing moved under it, and a path in that clause appearing in neither the plan nor a correction refuses `developed` — which is where *do not silently expand scope* is enforced rather than asked |
| a destructive migration | the classification, attached | `waiting`, kind destructive migration; a reviewer's comment resumes |
| it cannot be built soundly | the finding; the branch left named | `on_hold`, kind unshippable |

### `developed` — reads the criteria, the merged commit and the baseline

| Scenario | Writes | Goes to |
|---|---|---|
| every criterion judged | one verdict per criterion with evidence, all at the merged commit or at the judged head the mark names; skipped checks named with reasons; the migration classification when the schema flag is set | `tested` |
| the plan declares a screen change | each verdict that is not *skipped* citing an attachment this issue carries | `tested`; a URL and a sha are citations and an attachment is the thing itself, and a screen is the one change whose proof is that somebody looked. A *skipped* verdict is exempt for the reason it owes no evidence at all: there was nothing to look at |
| a criterion fails | its failing verdict | unchanged; the fix moves the merged commit, so the issue falls to `in_progress` until the new head is reviewed, and judging starts over |
| proves unshippable | the finding | `on_hold`, kind unshippable |

A criterion is judged as the review left it. What the review taught about the code — a fallback it
cannot take, a call that exits rather than answers — is read against every criterion before the first
verdict, and a criterion the review proved impossible is corrected in the open, by a correction naming
the file that settles it, and judged as corrected; a verdict on the old wording passes a claim the code
cannot make.

**A verdict cites the commit it judged, and a landing that did not touch this change does not move
it.** Where a repository's landing *is* the merge — a rebase onto the default branch, a version
commit above it, a push — the merged commit does not exist until the change has shipped, so a run
that judges before it cites a head the landing replaces. Re-judging every criterion there buys
nothing: what a landing brings is other people's commits, this change's own diff is unchanged, and
the tree those commits sit on is the one the read that earned the review judged, the replay being
that read's first step. So
the mark's note names the judged head beside the landed one, and says which of the paths this change
touched the landing moved — *nothing*, or the paths themselves. Named as nothing, every verdict at
the judged head stands and none is written twice; naming paths, the verdicts at that head are
re-judged at the landed one, and the refusal names those paths. A note saying neither leaves the
verdicts owed at the merged commit, which is what every mark written before this rule says. The
predicate is `git diff <judged>..<landed>` over the paths the change touched, and it is run by the
landing run rather than by the transition: git is asked at the step that knows the answer, and the
answer is written onto the issue there — the same division the review's two path sets are held to
below. So the run replays its change on top of the default branch's head before it judges — that
direction moves the change and lands none of it — which leaves the landing nothing of the change's
own paths to move. Four runs on 2026-09-04 re-posted every verdict
after their ship, one of them twenty-eight records where fourteen carried the meaning (ISS-156).
Refusing only the criteria the moved paths reached is ISS-207's: a verdict's evidence is an
attachment, a URL or a sha, and none of the three names a path.

**The equivalence is about paths and it is not about behaviour**, so it stops short of a criterion
whose evidence rested on the tree rather than on the paths this change touched: a gate's result, a
suite's count, a rendered screen, a fixture or a generated input a foreign commit could have moved
without touching one path of this change. Those are judged again at the landed head whatever the
clause says, and the author is who knows which they are — the check reads the clause and the commit,
never the truth of either, exactly as it does every other field of a record.

### `tested` — reads the verdicts, the plan's flags and the release note field

| Scenario | Writes | Goes to |
|---|---|---|
| shipped and seen running | a verification citing where it runs; the release note, or *Skip* with a reason; a person's review comment where the plan declares a screen change or a user-facing outcome and the project's config asks for one | `released` |
| **trivial** — shipped and seen running | the verification alone, as the row below | `released` |
| **fix** — shipped and seen running | the verification alone; no release note, because a fix declaring no person is a change nobody sees and the withholding is the rule rather than a record to type | `released` |
| a result a person judges, not yet seen by one | the rendered evidence, attached | `waiting`, kind screen review; the reviewer's comment resumes |
| the deploy fails and the route rolls it back | the rollback taken and its evidence | `on_hold`, kind rolled back |
| the deploy fails and nothing rolls it back | what is lost, and the evidence | `on_hold`, kind no way back |
| a fix lands meanwhile | nothing; the merged commit moved | unearned to `in_progress` until the new head is reviewed |

Whether a user-facing change waits for that person is the project's answer and not this contract's:
the tracker's project config names the staging branch, the production branch and whether production
deploys go without being asked, and a project whose release lands on staging, or which deploys
production itself, does not park here.

### `released` — reads nothing more

`released` means the change is on the project's staging branch and running wherever that branch
deploys, which is what the verification cites; where the production branch is a different one,
promotion to it is a step outside this ladder — automatic or a person's, as the project's config
says, and the verification carries the line that says which.

The close is the shipping run's own last step, not a decision it waits on: the entry criterion for
`closed` is this status and no payload, so no comment decides it and a thread too long to return
whole cannot refuse it. A person still closes an issue whose run never came back.

| Scenario | Writes | Goes to |
|---|---|---|
| the run has verified it and its note is up | nothing | `closed`, made by that run |
| the run is not the one that shipped it | nothing | `closed`, made by a person |
| a later regression | a new issue | unchanged |

### `closed`, `dropped` — terminal, until a person disagrees

| Scenario | Writes | Goes to |
|---|---|---|
| a person disagrees with a close or a drop | `reopen`, a person's word, and a finding typed on their behalf: what they expected, what they saw, the evidence, the criterion or use case it concerns when they name one, and their own words quoted | `reopen`, which is where their word leaves the issue and is no step of the flow |
| the criterion asked the wrong thing | a triage, outcome *wrong-test*, on a finding that names the criterion; the criteria corrected, and a correction written since the triage — the fall is refused without all three, and the finding's own quote of that line is what says whether it moved | `developed`, new verdicts owed and the old ones standing as superseded |
| the criterion was right and was not met | a triage, outcome *not-met*; a failing verdict written since the triage, on the criterion the finding names where it names one, which the fall is refused without | `in_progress`, until the new head is reviewed |
| nothing ever promised what they expected | a triage, outcome *not-in-spec*; a spec change or a new issue, blocking this one by an edge, which the park is refused without | `on_hold`, kind blocked, at the status the reopen landed on; nothing about this issue's own work was wrong |
| a regression, rather than a result that was always wrong | a new issue naming this one | unchanged |

Where the reopen landed is read from the merged mark: a mark means code landed, so a close was
reopened and the issue lands on `released`; no mark means nothing landed, so a drop was reopened and
it lands on the status its dropped park recorded. A triage says how far back the work goes and never
how far forward, so the landing status is the ceiling — a reopened drop that landed at `clarified`
is not sent to `developed` by a triage. A reopen with no finding, or a finding with no triage, moves
nothing, and the refusal names both writes. Each outcome owes one write of its own before the fall,
because a triage is a ruling about the record as it stands and the record has to change to match it.
Every reopen owes a finding and a triage of
its own, each stamped at the write with the reopen it belongs to and matched by that number, because
the ruling on one look is not the ruling on the next. A reopen also judges again: every verdict
written before this reopen's triage is unearned, since a *wrong-test* moves no commit and the
verdicts already there would otherwise pass again on the judgement the person disagreed with. Every
triage names
what would have caught it, since a reopen whose lesson goes unwritten is one the next issue pays for
again.

Across every stage: a park records its kind, its evidence and the status it left; a refusal names
the missing item and the command that supplies it.

## When the run breaks

The stages above are the happy path and its known forks. Runs also die, collide, run out of
budget and learn things halfway. Two families of software settled how to hold that, and the
contract borrows their shapes rather than inventing its own.

**The workflow engines.** Temporal detects a dead worker by a heartbeat timeout and a
start-to-close timeout, retries under a policy, and replays a workflow from its event history so a
resumed run repeats the commands it already issued. Kubernetes coordinates through a lease: a
holder identity, a renew time, a duration, and a holder that stops renewing loses it when it
expires. Prefect and Airflow mark a run whose heartbeats stopped *crashed*, a state distinct from
*failed*, and retry or hand it to a person. Argo separates *error*, the infrastructure's fault, from
*failed*, the work's fault, and retries transient errors alone. LangGraph checkpoints state at every
step and resumes from the last one; a pause for a person is a checkpoint that waits. Temporal
versions a workflow definition so a change made today never re-judges a run started yesterday.

**The coding-agent orchestrators.** The agent-orchestrator that watches GitHub keeps its whole
state "in the issue itself — one workflow label plus one pinned JSON comment", so it restarts
without losing context; a dev or reviewer agent that "timed out or crashed" is simply retried on
the next tick, requested changes send the issue to a *fixing* state and back, and done means a
mergeable pull request the reviewer approved, with the merge left to a person. Baton claims an
issue, runs one worktree per claim, and releases the claim the moment a pull request exists. Gas
Town keeps work in a git-backed ledger of beads, pins each agent to a hook that "survives crashes and
restarts", has a Witness that "detects stuck agents, triggers recovery (nudge or handoff)", and lands
work through a merge queue where agents "never push directly to main". Paperclip gives issues
"atomic checkout with execution locks, first-class blocker dependencies", recovers orphaned runs,
and stops an agent hard when its budget is spent. Buzz makes the relay the single source of truth:
every workflow step is a signed event, a run is pending, running, waiting approval, completed,
failed or cancelled, and an approval suspends it with a timeout. Orca gives each task its own
worktree and tells the person when an agent "finishes or needs attention". Composio's orchestrator
derives its board from facts — session, pull request, CI, review — and puts blocked sessions,
missing input, failed CI, requested changes and "lost signals" in one column: needs you.

**How the contract carries each of them.**

- **A claim is a lease, in a field the issue already has.** The issue's session field holds the
  holder's session, the renew time and the duration; every payload write renews it. A second agent
  that picks an issue with a live lease is refused, naming the holder. A lease past its duration is
  reclaimable by any run, and its own holder's next write renews it rather than being refused: the
  field still naming that session is what says no other run took the issue, since a claim replaces
  the holder, so the only command the refusal could name is one the write makes for itself — and it
  says on one line that it made it (ISS-65). It says so of the read it made, which is as far as any
  route here reaches: the refusal named `forge claim`, whose own read-write-read carries the same
  window, and closing that window is the tracker's conditional write below. What the fifth dry run caught is narrower than the rule
  it wrote: a build that renewed a dead run's lease without reading the state at all, and silently. A
  reclaim is a handoff between two holders, so a holder retaking its own lapsed lease appends no
  reclaim and counts toward no park. The field also
  keeps the claim history, each claim and reclaim appended by the write that made it, so who held the
  issue when is on the record with no second write that could fail or lie. The
  claim, and every status or payload write the lease covers, is a compare-and-set on the whole field:
  the write carries the field value it read, holder, renew time, duration and history together, lands
  only if the field is still exactly that, and the tracker refuses otherwise. That refusal is the tracker's to add and the first item in its part of the
  plan; until it exists the lease is advisory: two runs that both find no lease may both claim, the
  later write can erase the earlier, and nothing on the record promises to show it. A project that
  runs more than one agent at a time needs the tracker's refusal before it can trust the lease.
- **A run that cannot write cannot say it died.** Every tracker write is the CLI and the CLI is
  the shell, so a run that loses its shell cannot park, correct or release its lease; ISS-26 sat an
  hour in `in_progress` with no sign. The interruption is therefore read from what the run could not
  do: a lease past its duration is the record of a break, the board (ISS-24) shows it, and the
  worklog beside the lease (ISS-44) is what the successor reads first. The worklog is checkpointed
  by the same write that renews the lease, so every payload write, every push and every codex round
  that has something to capture leaves it current. Each block carries the time it was taken, and a
  capture with nothing in it changes nothing rather than replacing a true statement about an earlier
  push with none, so what a successor reads is that block and the time on it. It holds the state the
  record does not: branch, head and base, the files
  touched, the one-line next step, the consult id and round with whether a recheck is owed, and the
  scratch decisions. A run that dies between two writes loses at most the work since the last one,
  and a successor that cannot continue from the record and the worklog has found a fact that belongs
  in one of them. The push capture is made at the push, before the merge: after a fast-forward the
  base equals the head and the files touched read as none, which the eighth dry run recorded on its
  own issue and the twelfth wrote three times over. A capture that captures nothing says so in one
  line, names which of the four reasons held and writes no worklog, because a record that looks like
  one and holds nothing is what a successor reads first; what a capture holds is said on one line
  too, since a flag whose silence means both success and nothing at all is one an author reads back
  with a second call (ISS-65). An earlier capture is left where it is, dated as it always was: it is
  a true statement about an earlier push, and deleting it to keep a line honest would take the last
  known head with it. The worklog's set is the run's note and scopes nothing; the set that scopes the earning
  review is the one the merging run writes into the mark from the commit that actually landed, and
  where a queue landed a different commit the mark's set is the truth and the worklog is refreshed
  from it. A brief that shows part of the record says how much it left out and where the rest is.
- **Crashed is not failed.** An expired lease says nothing about the work. The status stands, the
  payloads written so far stand, and the next run resumes the phase the status owes. The third
  reclaim of one status parks the issue as `on_hold`, kind crashed, with the claim history as
  evidence: Gas Town's handoff, Composio's needs-you column. The history is the park's reason where
  the typed evidence admits no history yet (ISS-35 owes the field-as-evidence form).
- **The record is the checkpoint.** The tracker holds the process, the pushed branch holds the code,
  and nothing lives in a session. A commit is pushed as it is made, because a branch on one disk is a
  checkpoint nobody can resume from. Every payload write is idempotent: the same content twice is one
  record, the latest verdict per criterion wins, the merged mark keeps its first stamp. Where a
  project lands work through a merge queue, the lease holder writes the merged mark once the queue
  reports the landing, with the commit the queue landed; the queue itself writes nothing to the issue.
  A wrong typed payload is not deleted: a correction beside it says what was wrong, and the report
  shows both, because a record that can be quietly removed and reposted is a record that can be made
  to say anything. The fifth dry run deleted and reposted four of its own records and the report
  shows no sign of it; until the verb refuses the deletion, the rule is the author's to keep.
  A relation write renews the lease on the issue the run holds, the one the verb for it takes
  second: for a *blocks* edge that is the blocked issue, for a *relates* edge the one in hand; the
  issue named first is only checked not to be another run's, so filing a blocker for the issue in
  hand keeps working. That write is not every credential's — `forge doctor` says whether this one
  carries it, the verb is withheld where it does not, and the refusal that demands a *blocks* edge
  carries the one call that makes it.
- **A park is a checkpoint with a person at it.** Nothing runs while it waits. A reply resumes the
  three parks that wait on a person; a blocked issue is resumed by the next run that picks it and
  finds its blocker `developed`, and that run takes the lease as it would for any issue. The parks
  carry no timeout: unlike Buzz's approval, the person's reply is the only clock.
- **Transient is retried, never recorded.** A tracker that answers with an error is retried with
  backoff; a hook that refuses a command is a command to rewrite; neither reaches the issue. A run
  that has to stop — the tracker unreachable past its budget, the stack down, the agent's own budget
  spent — writes one comment saying so when the tracker allows it, and moves no status. The next run
  finds the lease stale and resumes. That is the run's own write; a gate holding someone else's
  write answers the same failure differently, under the routes below.
- **A rule change owes nothing backwards.** Every typed write carries the contract version it was
  written under. A held status whose payload exists, under the version on that payload, stands even
  if today's rule asks for more. A held status with no payload at all is unearned whatever the
  version, which is how a status set from the tracker's own screens is told apart from one earned
  under an older rule.

### Breaks mid-run

| Scenario | What the record shows | What happens | Goes to |
|---|---|---|---|
| the agent dies mid-phase: context exhausted, process killed, machine off, budget spent | status unchanged, lease going stale, payloads so far intact | the next run reclaims the lease and resumes the phase from the record; uncommitted tree work is gone, pushed commits are not | unchanged |
| the agent dies between two writes, say merged but not marked | git shows the merge, the record shows no mark | `advance --owed` names the missing mark; the step that knows the commit writes it | unchanged, then `developed` |
| the same status reclaimed a third time | three reclaims of one status in the claim history | the issue parks with that history as evidence | `on_hold`, kind crashed |
| two agents pick the same issue | a live lease held by another session | the second is refused, naming the holder and the renew time | unchanged |
| the tracker answers with an error | nothing | retry with backoff; past the budget, the run's write stops and nothing is written; a gate's hold ends instead, and the write passes with a line saying what went unchecked | unchanged |
| a hook refuses a write | nothing | the command is rewritten to satisfy the gate; not an issue event | unchanged |
| the environment breaks: stack down, ports taken | one comment saying the run stopped and why | the run stops; the next run reads why | unchanged |
| a person pauses or reprioritises mid-run | a person's comment | the branch is left named; nothing else changes | `on_hold`, kind paused; resumes by hand |

### Findings mid-development

| Scenario | Writes | Goes to |
|---|---|---|
| a second defect found while building | a new issue, related to this one; nothing of it is fixed here | unchanged |
| a defect this issue cannot pass without | a new issue that blocks this one, by relation | `on_hold`, kind blocked; the next run that finds the blocker `developed` picks it up |
| the plan proves wrong | the plan field replaced; a correction comment saying what moved and why | unchanged |
| a criterion proves wrong or impossible | the criteria field corrected; a correction comment with the reason | unchanged; if already `tested`, unearned to `developed` |
| the default branch moved under the branch | a rebase; a fresh baseline, since the old one measured another base, owed by the verb once the mark names its base (ISS-40) | unchanged |
| a gate is red for a reason outside this issue | the verdict names the failure as baseline-identical, with the baseline as evidence | judged as the criterion says |
| the reporter's answer changes what the issue is | a new confirmation superseding the first | back to `confirmed` |
| the screen reviewer rejects | their comment stands as a failing verdict from a person | unearned to `developed`; a fix moves the merged commit, which sends the issue to `in_progress` for review |
| a batch member fails its criteria | its failing verdict; the others' verdicts stand | that member parks, kind unshippable; the rest advance; its commits follow the project's revert policy |
| a finding whose disclosure is a decision | release note withheld with *Skip* and the reason; the decision handed to a person | `waiting`, kind release decision |
| a regression after release | a new issue naming this one | unchanged |

Across all of them: the status and the typed payloads that earn it are written only by the agent that
holds the lease; people write comments, replies, reviews and `reopen` at any time, need no lease and renew
none, and those writes are what the parks wait for. A run that finds something on an issue it is not
working posts it the same way, as a finding through `forge new --into`, and takes no lease: the lease
says who is moving the status, and a finding moves nothing (ISS-63 owes the refusal that says so). The branch is pushed as it moves, and the status
is the resume point. Nothing about the run has to be remembered
by anyone, because nothing about it is held anywhere but the record.

## The mechanics

This address is the index of the mechanics, and holds nothing else. How the record is kept honest
between the stages is served in four parts, each taken when the stage that leans on it is reached:
`forge guide contract earning-and-unearning` for what moves a status and what takes it back, read
at `open` through `approved`; `forge guide contract the-review` for what a reviewer judged and when
a review is done, read at `developed`; `forge guide contract evidence` for the shapes a payload
takes and the checks that stand in for one, read at `tested`; `forge guide contract
release-and-routes` for the installed copy, the schema and the gates every route shares, read at
`released` and by anyone building a route.

### Earning and unearning — what moves a status and what takes it back

**Two sources, one recorded.** The tracker record is the only thing checked, so anything the
repository knows — which commit merged, which commit a verdict judged — is written onto the issue
at the step that knows it: the merged mark carries its commit, a review the head it judged, a
verdict the commit it judged. Repository state is never read at transition time; the transition reads what the earlier
step wrote. This is not advice but the constraint that makes the verb possible: a check that read
the working tree would answer differently on every machine that ran it. It is honoured by
convention in one place, the merged mark, which today takes no commit and carries it in the
prose of its note; until the tracker gives the mark a commit field, the note's form is part of the
contract.

**A later change unearns.** A review records the head it judged; a verdict records the commit it
judged and the criteria text it judged against. When the merged commit moves, `developed` and
everything above it are unearned and the issue falls back to `in_progress` until the new head has
its approving review and its mark. Who notices is the run that moved it: the merge that lands a
new head writes the mark again, and the new mark is what unearns, because the verb cannot see a
head it was never told about. A head moved without a re-mark is invisible until the tracker
compares for itself; when the criteria field changes, `tested`, `released` and
`closed` are unearned and the issue falls back to `developed`. Old reviews and verdicts stay as
superseded history and the new ones are written beside them. A plan or criteria edit after
`approved` also owes a correction comment saying what moved and why, and the write is refused
without it, so criteria cannot be quietly relaxed to fit what got built.

**And a person's finding unearns like a change to the code.** `reopen` is a person's word, and two
writes follow it: their finding, and the agent's triage of it. The triage is what unearns, and the
stages above say which way — the criteria, the code, or neither, when nothing about this issue's own
work was wrong. Nothing is deleted there either. What a person found is not a status that quietly
moved: it is a record with their words in it, and the count of reopens the tracker keeps beside it
is the one fact saying this has happened before. A defect the builder finds in the project's own change
after its issue is closed is not a reopen either: it goes to the nearest open issue of that project
that owns it, or to a new filing there, and the closed issue gets one note saying where. A defect
in this plugin met along the way goes to the plugin's own backlog through `forge feedback`,
whichever project the run is in.

**A disposition is a drop with its finding as the reason.** A confirmation whose finding is a
disposition earns `confirmed` and, on the next advance, `dropped`; the same comment is the evidence
and the reason. Nothing is jumped: `closed` stays what code that landed earns, and `dropped` what
nothing landing earns. Whoever disagrees reopens.

**A split is a filing, not a transition.** An issue that turns out to be several gets siblings
filed `open`, each naming the others in the same write, and the original is confirmed as the first
of them. Their blocking relations decide the order the run takes.

**A batch is a relation, written when the branch is cut.** Every member earns each status on its
own record. A verdict inherits the member list, so no report lists its batchmates by hand. A
member that fails its own criteria parks while the rest advance; what the branch does with that
member's commits is the project's revert policy, not this contract's.

**The verb asks, then moves.** `forge advance ISS-nn` names the next status, checks its entry
criteria, and either transitions or prints the shortfall. `forge advance ISS-nn --owed` prints
the shortfall without moving. A jump past a status is refused; a park is a transition to one of
the side statuses with a typed reason, so a judgement call is recorded rather than skipped, and a
drop is refused once the merged mark is set. A shortfall names only what the shape has: no item for
a field the kind does not take, no number the record did not carry, and one named item rather than a
list when the stored copy cannot be read, since a list of everything is a shortfall the record does
not have. A line the reader found and could not parse is reported as found and unparsed, quoting
it, never as missing, since the two read identically and send the writer to add what is already there
(the eighteenth run lost a cycle to a bolded label).

### The review — what a reviewer judged and when it is done

**A review is two voices in one record.** The outcome is the reviewer's word about the diff at
the head it judged, and nothing else: *approved* means the reviewer stood behind that head. The
finding lines are the author's disposition of each finding by id, accepted or rejected with a
reason; an id names the consult that issued it, because every consult numbers from one and a
review over four rounds has four findings called F1 (ISS-34 owes the grammar). Dispositions never add up to an approval: a rejected finding the reviewer never saw
answered is an open finding, and *approved* is written only from the reviewer's answer on the same
head with nothing standing, which for codex is a read of the whole touched set that found none
standing: the recheck after findings, or the first pass itself when it read the set whole and found
nothing. A record that could
only say *approved* or *changes requested* made the honest value and the passable value differ,
and the fourth dry run wrote the passable one. ISS-16 owes the separate value. A review is not
terminal either: a round folded before the earning recheck is on the record as *pending* with its
round, because a run that stopped between rounds otherwise reads as a run that never reviewed, which
is what ISS-26 read as for an hour. A disposition may be partial, on a finding and on a verdict
alike, with their meaning fixed: *accepted in part* names the half folded and the half rejected
with its reason, so nothing of it stands once the reviewer's recheck on that head found none
standing, and approval is decided as before; a pass *with a qualification* earns the criterion, the
qualification travels with the verdict onto the report and the trace page, and a qualification that
says the criterion is not met is not a qualification but a fail (ISS-34 owes both grammars).

**A recorded verdict is the author's and stands.** A recheck confirms or refutes the reviewer's
findings; it does not rewrite the author's rulings on them, and a rejection with its reason is not
replaced by an acceptance the recheck inferred (ISS-34 owes the fix; twice in the seventeenth run).

**The reviewer read what it was shown.** A consult limited to a diff judges the diff; its truth
pass on the rest answers *not verified* and says so. So the pass that earns an approving review is
one read of the whole set of files the change touched (`--send bodies`), taken once, at the commit;
diff passes are for the rounds between edits and none is owed. Its place is the last step before the
criteria are judged, after the replay onto the default branch's head, so the head the reviewer
judged, the head every verdict names and both heads in the mark's note are one head: a run that
judges first owes every verdict again wherever the read moves a path, which cost the sixty-eighth
dry run thirty-eight records on nineteen criteria. A recheck follows a finding and
nothing else: over one hundred consults on 2026-09-04, fifteen rechecks confirmed fixes and not one
raised anything new, so a recheck after a clean whole-set pass is a round that buys nothing. The review
record names that set
beside the head so the transition can see the scope without the repository (ISS-34 owes the field
with the consult ids); the merging run, which is the one that knows, writes the touched files into
the mark's note beside the commit and the base, and a review whose recorded set is narrower than the
mark's is not approving. Both sets are on the record; nothing inspects the repository. The sixth dry run caught three *not verified* answers only because the
output said the words. A recheck confirms and does not discover: it answers, finding by finding,
whether the fix stands, and a finding it raises for the first time stands only with a clause naming
what made it invisible the round before. The review ends when the whole-set pass has been taken and
every finding it raised has its verdict — fixed and confirmed by the recheck, or rejected with the
reason on the review record; no further whole-set round is owed for that. Scope is causal, not positional: a finding on a line the change did not
touch is in scope when it names the changed line that breaks it, a caller or a test the new interface
no longer fits, and is outside the change otherwise, rejected as such or filed on its own issue. A
round whose only new findings are outside the change is the last round, since a reviewer that re-reads
the whole set each time need never grant zero (the fifteenth dry run ran eleven rounds to learn this;
ISS-77 owes the harness half).

### Evidence — the shapes a payload takes and the checks that stand in for one

**Evidence is typed at the write.** Every payload above is a write of a shape the CLI owns — a
confirmation, a decision record, a question, a review, a verdict, a verification, a person's finding
and the triage of it — and a report is
assembled from the record rather than written from memory: the latest of each kind that can only
be current, and every instance of a kind that repeats, so a report shows four corrections when
four were written (owed by ISS-11; today only verdicts, findings and triages are kept per instance). A separator between
repeated values must be one a value cannot contain, or the record does not read back as it was
written (met at the write: the fenced form starts each repeated value on its own
keyed line, carries any newline inside it on indented continuation lines, and sizes its
fence past the longest run of backticks inside it, so nothing joins the
values and nothing splits them back out; the reader still splits a repeating field of the older
bullet form on `; `, which is a tolerance for records already on the tracker and retires when none
remain). A
payload is machine data: it travels in a form the project's prose rewrite leaves alone, and its field
names are the flags the verb took, never the labels a screen renders, because a reader keyed on labels
was conformant in English and blind in Vietnamese (the fourteenth dry run). A kind kept
latest-wins is not overwritten while the status it earned still stands: the second write is refused
unless it names what it corrects, and the correction is printed beside the record it corrects. A
write after a change that unearned the status is not a second write but the new evidence the
re-earning owes, and passes (owed by ISS-74; today a release note on a closed issue is replaced in
silence), and a repeated
flag value, which the verb keeps to one line at the write, renders as one line each, because six
decision triples read back as one paragraph are six decisions nobody will read; a multi-line field
is one value and is rendered whole. A kind that repeats across occasions — a finding, a triage — is
stamped at the write with the occasion it belongs to, the tracker's count of reopens today, and is
matched by that stamp, so no reader counts backwards to guess which look a ruling was about. A verdict names its criterion
by number and quotes the text it judged; one with no evidence is refused; a criterion with no
verdict keeps the issue out of `tested`. An evidence document is attached once under one name, and
an amended one goes up under a new name that the later verdicts cite, because a name attached twice
resolves to two documents and every verdict naming it is ambiguous (ISS-55 owes the refusal). The kind of evidence a criterion needs is its author's to
name and the reviewer's to judge; the contract checks presence and the commit, not truth. Whether
a criterion is really two is a warning at the write, from a conjunction list the project's prose
language supplies, never a refusal.

**A change that claims no behaviour change earns `tested` by identity.** A refactor has nothing to
observe, so its criteria are the three things a move can break: the export surface of every touched
module diffed name for name against the base, the suite green from the new locations with the count
of tests it ran before and after, and history reaching each moved file through the rename. Each has a
verdict naming the commit. The suite is the one that catches a path that stopped resolving, which is
the one behaviour a move has, and the ninth dry run broke four of them. A verification for such a change
names the identity check as its place, not a screen.

**A fix is marked, and the mark is spent by the entry checks.** A change whose body carries no rule
and states one behaviour and its replacement is a fix, and the filing refuses it unless it is marked
or routed onto an issue already open. The mark is a line in the description rather than a label,
because the tracker creates no label it was not given and offers no route to read one back. What it
buys is three payloads of the ten a status is earned by — no decision record, no plan field, and the
release note withheld by rule — which the stages above state per status and `forge advance --owed`
prints beside what the record still lacks. It buys nothing else, and deliberately: the confirmation,
the baseline, the review of the head that landed, a verdict per criterion, the verification and a
schema-coupled plan's classification are a fix's exactly as they are a feature's. The size is the
tracker's the day it has a field for one, and the line goes the same day; until then the line is the
only source, read wherever it appears, since a mark that survives the tracker's own screens is one
anyone can type. Built (ISS-141).

**A criterion a program can decide ships as a check.** When the evidence a criterion asks for is a
comparison a program can make — a gate exits zero, a count did not fall, every named path resolves —
the verdict that earns it is a check in the tree that fails when what it guards is broken: for a new
rule, on the tree without the change; for a property preserved, when the tree and the base differ. The
criterion names the check. A verdict written from one run proves that run; a check proves every run after it, and the
ninth dry run's most durable output was the one check the contract had not asked for. The case is proven red against a tree without the change: a
second worktree at the base, or the file checked out from the base in place and restored after, never
`git stash`, which is one stack for every worktree of the repository and traded two agents' work in the
twenty-first run.

**A rehearsal writes no person's record.** A run that exercises a transition with no person behind
it — a reopen route, a park a reviewer lifts — proves the route in a test or against the installed copy
and writes nothing that quotes a person. A verdict that says *the installed copy* names the binary it
invoked by path, because on a machine whose `forge` is the checkout the phrase proves the checkout;
each verdict says which artefact it judged, the tree or the installed copy, since only the second
guards the next session; and a probe whose path does not resolve is a failure, never a pass
that printed nothing (ISS-71). Every commit a payload names is read from git at the write and never
typed: the seventeenth run typed one from memory and corrected it with a second mark. A finding with words nobody said is a false record, and a
false record is corrected and never removed, so it is better never written; the tenth dry run built the
reopen and left it unrehearsed on a live issue for this reason.

### Release and routes — the installed copy, the schema, and the gates every route shares

**A change to what a session registered reaches it at its next start, and nothing else does.** A
gate, its harness and its how page are chosen per call and are live the moment they land; the
registration a session read, the entries it names by path, what those import, and the skills it
loaded are the session's own until it restarts. The release names exactly those files and the run's
report says a restart is owed for them; a dry run names the skill copy it ran under, since the
seventeenth ran three releases behind the tree without knowing.

**The version mark is part of the release.** The commit that moves the version is the one a rebase
drops without a conflict when an identical bump already landed upstream, leaving a tree whose manifest
names a version that carries none of the change and nothing red to say so. A release is proven by the
installed copy naming the merged commit, so the merged mark's evidence carries that pair, version and
commit, read from the installed copy and not from the tree (ISS-71).

**The schema is the document.** `forge schema forge_issues` and `forge advance --owed` carry the
entry criteria in the tool's own words. Nothing in the skill repeats them.

**Every route this plugin sees is the same route.** The CLI enforces; the pre-hook applies the same
check to the tracker tool called directly, so the contract cannot be stepped around by choosing a
client the plugin serves. A delegated agent is a route, and so is an argument form. What a run has
been shown of an issue's comments is therefore state this plugin writes, keyed by the session an
agent and the agents it delegates to share, and the write that owes a reading performs it: an issue
with no comments costs nothing, and every comment on the page the tracker returns that nobody here
has seen is the refusal itself, delivered once and re-sent against. The page is the reach of it,
which is the same seam a cursor closes. Past the page, an issue whose thread outgrew what the tracker
lists, every verb says what cut the page — a count or a response size — and the count the tracker
returned, never a count it did not measure, and then reads what it was sent: the cut keeps the most
recent rows, which is the end every entry check and every unearning rule reads, so a page that earns
a status earns it and only a shortfall can be one the cut invented. What a refusal past the page hands an agent is
therefore the write that supplies the item, that the item may already be behind the cut, and the
tracker's own screens for the whole thread; evidence too long to name goes up through `forge attach`.
A transition by hand is not among them: it writes a status no entry check read and leaves the lease's
next line as the last write set it. It is named only where the status is a person's to set and no
write of this flow earns it — a hold a person lifts, a reopen, a status the flow did not set, a park
record naming nowhere to go back to — and never in place of a write that would earn it. A page a
verb could not read whole is not one of those places: what the cut hid is a payload some write
supplies, and the shortfall names that write. Where the cut may have hid the status itself, which no
write of this flow sets, the refusal says the page was cut before it names anything else. A question
nobody has answered is the plainest case: the answer is the write that earns the resume, and the
shortfall names it (ISS-17 closes the seam, and ISS-131 the reading of it). A write naming its issue by uuid is checked exactly as one naming the
key, since a form is not a route either. Nothing about a route is read out of a transcript,
since the transcript of a delegated run is not the one a hook is handed. A comment this session did not create,
whatever wrote it, is one it has not been shown, and a batch worked on one branch pays that delivery
once per member. The tracker's own screens and unhooked clients are outside it: a status
they set is unearned, and `advance --owed` on such an issue says what its record lacks. A check on
the server is the tracker's to add, and this contract is its specification.

**When the tracker will not answer, the verb refuses and the gate lets the write through.** The
route is the same; the failure is not. A verb is a step the run can retry, so it fails closed with
the reason and the retry. A gate is a hold on a step the session is waiting on, and a hold that
outlives what the session waits for is a denial nobody chose: the ISS-59 gate cost one tracker call
for a plain filing and four for one naming three tokens, and one run in sixteen sat out a rate
limit longer than its registered budget. So a gate's retries fit inside the budget it registered,
past it the write goes through unchecked, and the pass is owed a line the session sees naming what
was not checked and the command that checks it after the fact. A gate that passes silently on an
expired token, a missing slug or a slow tracker is the one case the record cannot tell from a check
that ran; ISS-36 owes the budget and the line.

## What it does not do

- It cannot tell a true verdict from a false one. ISS-31's verdict cited a screenshot of a
  similar screen. Presence and recency are checkable; fit is the reviewer's and codex's.
- It cannot start a run. An issue worked outside the workflow meets the contract at its first
  transition, which is earlier than today and later than the plan.
- It does not add fields. Everything it reads exists on the issue now.

## Open questions

- Whether the tracker's task records fit the per-criterion verdict better than a shaped comment.
- What a project with no deploy step writes for `released`.
- Where the way back from each ship step is recorded — the plan, for a change with deploy
  coupling, or the project's settings once. Today it is checked nowhere.
- How a use case is marked as one a person judges. Today the plan declares it in a line of its own,
  because a status may not be decided by reading the repository and the plan is where a declaration
  about this change already lives; a field on the clause would let the criteria that cite it decide
  instead, which is ISS-28's citation form once it lands.
- What `advance` does on an issue whose comments exceed one page. Today it refuses every
  operation, `--owed` included, which is safe and useless; it wants a cursor from the tracker, or a
  rule that only a status-moving operation needs the whole record.
- Whether the entry criteria should be data rather than functions, so the flow table here, the
  checks in the code and the verb's own help can be diffed against each other instead of agreed by
  hand.

## Where the rules came from

Fifteen issues were worked under this document by agents reading only it and the record, and each
run's report was folded back as rule changes above and a dated section in
[`issue-flow-dry-runs.md`](issue-flow-dry-runs.md). That file is history, not rule: the issues it
names live in the tracker, the changes in git, and an agent working an issue owes it no reading.

