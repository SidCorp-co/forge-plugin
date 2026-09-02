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
| `in_progress` | code is being written against this plan | `approved`; every blocker at least `developed`; for a batch, the member list written when the branch is cut | 4 Implement, to the merge |
| `developed` | the change is on the default branch | the merged mark with its commit, and a baseline recorded before it naming what already failed | 5 Prove |
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
- `on_hold` speaks to the owner: what failed with no way back, or why the change is unshippable.
  It resumes by hand.
- `dropped` speaks to everyone: the reason — a disposition the triage reference admits, or one of
  the project's own. Reachable only before `developed`, so it always means no code landed, and it
  is never marked merged. Terminal unless reopened. Abandoning code that did land is a revert: the
  commit goes, the mark is cleared with `unmark`, the issue falls back to `approved`, and only then
  may it drop.

**Who moves a status.** The agent, by advancing. A project that wants a person on `approved` or
`released` says so in its settings, and `advance` then waits for that person's comment instead of
moving. The default is autonomous, which is what the skill already says.

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
word, and it returns the issue to the status it held before the disposition or the drop, where
`advance` picks up with that status's criteria rechecked.

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
