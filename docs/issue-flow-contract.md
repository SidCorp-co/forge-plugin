# The issue-flow contract — a status is earned, and the tracker says what it costs

**Status: proposal for `forge advance`.** Nothing here is built. It records the shape before the first
issue is filed, so each part ships against a stated whole. The figures: `diagrams/issue-flow.html`.

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

That collapses the workflow to a single cycle: pick an issue, read its status, run the phase that
status owes, write the payload, advance. `forge advance --owed` says what the payload is. The
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
| `in_progress` | code is being written against this plan | `approved`; every blocker at least `developed`; a baseline naming what already fails, recorded before entering; for a batch, the member list written when the branch is cut | 4 Implement, to the merge |
| `developed` | the change is on the default branch | the merged mark with its commit | 5 Prove |
| `tested` | the evidence is here to be judged | one verdict per criterion, each citing evidence, all against the merged commit; every skipped check named with its reason; the migration risk classification when the plan declared schema coupling | 6, 7 Ship |
| `released` | you can see it now | a verification write citing where the change now runs; release notes, or an explicit withholding with its reason; for a screen change, a review comment from a person | closing, by a person or the run's end |
| `closed` | nothing more happens unless reopened; code landed | `released` | none |

The phase a status owes produces the payload that earns the next row, so reading the status is
reading the phase. The tracker's `draft`, `testing` and `reopen` statuses are not steps and `advance`
never enters them: `draft` is the reporter's, before `open`; `testing` is a label this contract has
no use for, since `developed` already says where the change is; `reopen` is an action, below.

**The parks are messages to a person, typed by who has to answer.** Each records the status it
left, and `advance` resumes there.

- `needs_info` speaks to the reporter, from `open` or `confirmed`: two or more readings, each
  with the outcome it produces. Fewer is not a question. It resumes on a reply from another author.
- `waiting` speaks to a reviewer: the kind — screen review, or a destructive migration — and the
  evidence to look at. It resumes on their comment.
- `on_hold` speaks to the owner: what failed and whether the route rolled it back, why the change
  is unshippable, what blocks it, that a person paused it, or that it keeps crashing. It resumes by
  hand, except a blocked issue, which the next run picks up once its blocker is `developed`.
- `dropped` speaks to everyone: the reason — a disposition the triage reference admits, or one of
  the project's own. Reachable only before `developed`, so it always means no code landed, and it
  is never marked merged. Terminal unless reopened. Abandoning code that did land is a revert: the
  commit goes, the mark is cleared with `unmark`, the issue falls back to `approved`, and only then
  may it drop.

**Who moves a status.** The agent, by advancing. A project that wants a person on `approved` or
`released` says so in its settings, and `advance` then waits for that person's comment instead of
moving. The default is autonomous, which is what the skill already says.

## The stages, scenario by scenario

What each status reads, and for every scenario it can meet, the payload owed and where the issue
goes. The scenario is the person's or the agent's to decide; the contract checks the payload.

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
| ambiguity cheap to reverse | a decision record: reading chosen, assumption, undo sentence | `clarified` |
| ambiguity expensive to reverse | a question | `needs_info`; the reply resumes at `confirmed` and the decision record quotes it |

### `clarified` — reads the decision record and the body

| Scenario | Writes | Goes to |
|---|---|---|
| the plan is possible | the plan in its field; numbered criteria in theirs; the screen and schema flags | `approved` |
| a criterion joined by a conjunction | a warning at the write, never a refusal | unchanged until the author splits it or keeps it |
| planning proves the claim false | a new confirmation with a disposition finding | back to `confirmed`, then `dropped` |
| the project names an approver | nothing more | `approved` once that person has commented |

### `approved` — reads the plan, the criteria and the blocking relations

| Scenario | Writes | Goes to |
|---|---|---|
| every blocker at least `developed` | the branch cut; the baseline naming what already fails, so a later red has something to be judged against; the batch relation when several ride together | `in_progress` |
| a blocker not yet `developed` | nothing; the refusal names the blocker | unchanged |
| the plan or criteria change now | a correction comment saying what moved and why, at the write | unchanged |

### `in_progress` — reads the plan and the baseline

| Scenario | Writes | Goes to |
|---|---|---|
| the change is on the default branch | the merged mark with its commit | `developed` |
| scope grows | a plan correction before the edit | unchanged |
| a destructive migration | the classification, attached | `waiting`, kind destructive migration; a reviewer's comment resumes |
| it cannot be built soundly | the finding; the branch left named | `on_hold`, kind unshippable |

### `developed` — reads the criteria, the merged commit and the baseline

| Scenario | Writes | Goes to |
|---|---|---|
| every criterion judged | one verdict per criterion with evidence, all at the merged commit; skipped checks named with reasons; the migration classification when the schema flag is set | `tested` |
| a criterion fails | its failing verdict | unchanged; the fix moves the merged commit, which supersedes every verdict, and judging starts over |
| proves unshippable | the finding | `on_hold`, kind unshippable |

### `tested` — reads the verdicts, the plan's flags and the release note field

| Scenario | Writes | Goes to |
|---|---|---|
| shipped and seen running | a verification citing where it runs; the release note, or *Skip* with a reason; for a screen change, a person's review comment | `released` |
| a screen change not yet reviewed | the rendered evidence, attached | `waiting`, kind screen review; the reviewer's comment resumes |
| the deploy fails and the route rolls it back | the rollback taken and its evidence | `on_hold`, kind rolled back |
| the deploy fails and nothing rolls it back | what is lost, and the evidence | `on_hold`, kind no way back |
| a fix lands meanwhile | nothing; the merged commit moved | unearned to `developed` |

### `released` — reads nothing more

| Scenario | Writes | Goes to |
|---|---|---|
| the run ends, or a person decides | nothing | `closed` |
| a later regression | a new issue | unchanged |

### `closed`, `dropped` — terminal

| Scenario | Writes | Goes to |
|---|---|---|
| a person disagrees with a drop | `reopen`, a person's word | the status held before the drop, its criteria rechecked |
| a person disagrees with a close | `reopen` | `released`; a regression is a new issue, not a reopen |

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
  reclaimable by any run, and the first holder's later writes are refused as stale. The field also
  keeps the claim history, each claim and reclaim appended by the write that made it, so who held the
  issue when is on the record with no second write that could fail or lie. The
  claim, and every status or payload write the lease covers, is a compare-and-set on the whole field:
  the write carries the field value it read, holder, renew time, duration and history together, lands
  only if the field is still exactly that, and the tracker refuses otherwise. That refusal is the tracker's to add and the first item in its part of the
  plan; until it exists the lease is advisory: two runs that both find no lease may both claim, the
  later write can erase the earlier, and nothing on the record promises to show it. A project that
  runs more than one agent at a time needs the tracker's refusal before it can trust the lease.
- **Crashed is not failed.** An expired lease says nothing about the work. The status stands, the
  payloads written so far stand, and the next run resumes the phase the status owes. The third
  reclaim of one status parks the issue as `on_hold`, kind crashed, with the claim history as
  evidence: Gas Town's handoff, Composio's needs-you column.
- **The record is the checkpoint.** The tracker holds the process, the pushed branch holds the code,
  and nothing lives in a session. A commit is pushed as it is made, because a branch on one disk is a
  checkpoint nobody can resume from. Every payload write is idempotent: the same content twice is one
  record, the latest verdict per criterion wins, the merged mark keeps its first stamp. Where a
  project lands work through a merge queue, the lease holder writes the merged mark once the queue
  reports the landing, with the commit the queue landed; the queue itself writes nothing to the issue.
- **A park is a checkpoint with a person at it.** Nothing runs while it waits. A reply resumes the
  three parks that wait on a person; a blocked issue is resumed by the next run that picks it and
  finds its blocker `developed`, and that run takes the lease as it would for any issue. The parks
  carry no timeout: unlike Buzz's approval, the person's reply is the only clock.
- **Transient is retried, never recorded.** A tracker that answers with an error is retried with
  backoff; a hook that refuses a command is a command to rewrite; neither reaches the issue. A run
  that has to stop — the tracker unreachable past its budget, the stack down, the agent's own budget
  spent — writes one comment saying so when the tracker allows it, and moves no status. The next run
  finds the lease stale and resumes.
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
| the tracker answers with an error | nothing | retry with backoff; past the budget, the run stops; nothing is written | unchanged |
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
| the default branch moved under the branch | a rebase; a fresh baseline, since the old one measured another base | unchanged |
| a gate is red for a reason outside this issue | the verdict names the failure as baseline-identical, with the baseline as evidence | judged as the criterion says |
| the reporter's answer changes what the issue is | a new confirmation superseding the first | back to `confirmed` |
| the screen reviewer rejects | their comment stands as a failing verdict from a person | unearned to `developed`; a fix moves the merged commit and judging restarts |
| a batch member fails its criteria | its failing verdict; the others' verdicts stand | that member parks, kind unshippable; the rest advance; its commits follow the project's revert policy |
| a finding whose disclosure is a decision | release note withheld with *Skip* and the reason; the decision handed to a person | `waiting`, kind release decision |
| a regression after release | a new issue naming this one | unchanged |

Across all of them: the status and the typed payloads are written only by the agent that holds the
lease; people write comments, replies, reviews and `reopen` at any time, need no lease and renew
none, and those writes are what the parks wait for. The branch is pushed as it moves, and the status
is the resume point. Nothing about the run has to be remembered
by anyone, because nothing about it is held anywhere but the record.

## The mechanics

**Two sources, one recorded.** The tracker record is the only thing checked, so anything the
repository knows — which commit merged, which commit a verdict judged — is written onto the issue
at the step that knows it: the merged mark carries its commit, a verdict carries the commit it
judged. Repository state is never read at transition time; the transition reads what the earlier
step wrote.

**A later change unearns.** A verdict records the commit it judged and the criteria text it
judged against. When the merged commit moves, or the criteria field changes, `tested`, `released`
and `closed` are unearned and the issue falls back to `developed`; the old verdicts stay as
superseded history and the new ones are written beside them. A plan or criteria edit after
`approved` also owes a correction comment saying what moved and why, and the write is refused
without it, so criteria cannot be quietly relaxed to fit what got built. `reopen` is a person's
word: on `dropped` it returns the issue to the status it held before the drop, on `closed` to
`released`, and `advance` picks up with that status's criteria rechecked.

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
drop is refused once the merged mark is set.

**Evidence is typed at the write.** Every payload above is a write of a shape the CLI owns — a
confirmation, a decision record, a question, a verdict, a verification — and a report is
assembled from the latest of each rather than written from memory. A verdict names its criterion
by number and quotes the text it judged; one with no evidence is refused; a criterion with no
verdict keeps the issue out of `tested`. The kind of evidence a criterion needs is its author's to
name and the reviewer's to judge; the contract checks presence and the commit, not truth. Whether
a criterion is really two is a warning at the write, from a conjunction list the project's prose
language supplies, never a refusal.

**The schema is the document.** `forge schema forge_issues` and `forge advance --owed` carry the
entry criteria in the tool's own words. Nothing in the skill repeats them.

**Every route this plugin sees is the same route.** The CLI enforces; the pre-hook applies the same
check to the tracker tool called directly, so the contract cannot be stepped around by choosing a
client the plugin serves. The tracker's own screens and unhooked clients are outside it: a status
they set is unearned, and `advance --owed` on such an issue says what its record lacks. A check on
the server is the tracker's to add, and this contract is its specification.

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

## First dry run — ISS-1

The defect this contract's own commit gate showed three times in an afternoon was worked under the
flow above, on the tracker as it is, with every payload shaped by hand.

- Eight transitions, each a raw call, and none refused anything: the record held every payload
  because the agent chose to write it. That is the gap the verb closes, and it is the size it looked.
- The payloads with no shape to copy were the confirmation, the decision record, the baseline and the
  per-criterion verdict table. Each was invented at the keyboard, and a second run would invent them
  differently. They are the writes to type first.
- The correction rule fit. The version bump the ship path needs was not in the plan; a correction
  comment before the edit cost one paragraph.
- A criterion that said "the suite passes" had to be judged against the baseline, because one
  failure outside the issue predated it. The criterion should say so: no failure the baseline lacked.
- Codex's one finding was rejected by id with a reason, into the consult log, which the tracker
  never sees. The verdict belongs on the issue as a typed write, so the report reads it from the
  record like everything else, and the log stays what it is: the reviewer's own memory.
- The release note field is an object with a section, and the first write as a string was refused.
  The schema says so, and `forge advance --owed` should quote it before the write rather than after.
- About twenty tracker calls for one small fix. Under the cycle it is eight advances plus the
  payload writes, and nothing else to remember.

## Implementing the verb on the tracker as it is

What the run showed about the record `advance` will read, so the first implementation is not
surprised by it.

- The tracker's own state machine accepted every step, `closed` included. The checks live in the
  CLI and the pre-hook, and nowhere else; nothing on the server refuses. The reach of the guarantee
  is stated under "Every route this plugin sees is the same route".
- The issue has a session field and nothing that writes conditionally on it. The lease needs a
  compare-and-set on that field for the claim and for every write the lease covers, which is the
  tracker's to add.
- The merged mark exists: `mark_merged` stamps the time and writes an audit comment, and its target
  is a label. It has no commit field, so until one exists the commit lives in the mark's note in a
  fixed shape, and `developed` reads it from there.
- Closing stamps the merged mark when it is empty, so a status meaning that no code landed must
  never be `closed`. That is why a disposition lands in `dropped`, which nothing stamps, and why the
  contract needs no second write to undo a mark.
- The release note field is an object of section, user-facing text and technical text. A
  withholding is the `Skip` section with the reason as its text.
- Plan and criteria are plain text fields. A criterion is a line that opens with its number and a
  dot, which is what a verdict names and what the conjunction warning reads.
- Attachments are returned by the full issue read and by nothing narrower, so an evidence reference
  is checked against that read.
- The first write to an issue's comments is refused until its comments were read this session. The
  verb reads the whole record before it decides, so it satisfies that gate on the way.
- Under the fixed turn hook, a document is recorded by content: reading, touching or naming a file the
  last consult already read at this content records nothing, verified live after the release. A
  verdict follows the same rule, judged by the hash of the criteria text and the commit, not by time.
- An edit and a consult in one shell command run before the hook records the edit, so the consult
  finds nothing. The verb has no such gap: it reads the record when it runs.
