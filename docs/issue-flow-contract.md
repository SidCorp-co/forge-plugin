# The issue-flow contract — a status is earned, and the tracker says what it costs

**Status: proposal.** Nothing here is built. It records the shape before the first issue is filed,
so each part ships against a stated whole.

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

## The shape

**One status per step, entry criteria per status, checked from the issue's own record.** An
agent moves an issue forward with one verb, and the tracker's own schema publishes what each
status requires. A missing item is a refusal naming that item and the one command that supplies
it. There is nothing to remember beyond "advance, and read what you are told".

| Reaching | Requires on the record |
|---|---|
| `confirmed` | a comment stating what was verified in code, or the disposition that ends the issue |
| `approved` | a plan, and numbered criteria, one per line |
| `in_progress` | `approved` |
| `developed` | the merged mark, which records the commit it was merged at |
| `tested` | one verdict per criterion, each citing one or more attachments or runs, all recorded against the merged commit |
| `released` | release notes, and a verification write citing where the change now runs |
| `closed` | `released`, or a disposition — see below |
| `waiting`, `on_hold` | a reason and the status parked from, which is where `advance` resumes |
| `dropped` | a reason; terminal unless reopened |

**Two sources, one recorded.** The tracker record is the only thing checked, so anything the
repository knows — which commit merged, which commit a verdict judged — is written onto the issue
at the step that knows it: the merged mark carries its commit, a verdict carries the commit it
judged. Repository state is never read at transition time; the transition reads what the earlier
step wrote.

**A later change unearns.** A verdict records the commit it judged and the criteria text it
judged against. When the merged commit moves, or the criteria field changes, `tested`, `released`
and `closed` are unearned and the issue falls back to `developed`; the old verdicts stay as
superseded history and the new ones are written beside them. `reopen` is a person's word, and it
returns the issue to the status it held before the disposition or the drop, where `advance`
picks up with that status's criteria rechecked.

**A disposition is a defined shortcut.** Any disposition the triage reference admits moves
`confirmed` straight to `closed`, with the reason and the evidence comment, and is the one jump
`advance` permits. Whoever disagrees reopens.

**The verb asks, then moves.** `forge advance ISS-nn` names the next status, checks its entry
criteria, and either transitions or prints the shortfall. `forge advance ISS-nn --owed` prints
the shortfall without moving. A jump past a status is refused; a park is a transition to one of
the three side statuses with a reason, so a judgement call is recorded rather than skipped.

**Evidence is typed at the write.** A QA verdict is a comment of a shape the CLI owns — the
criterion's number and the criterion's text as judged, the verdict, the commit judged, and one or
more evidence references, each an attachment or a run — and the report is assembled from the latest verdict per criterion, so a
re-judged criterion replaces rather than duplicates. A verdict with no evidence is refused; a
criterion with no verdict keeps the issue out of `tested`. Release verification is the same
shape with the deployed target in place of a criterion. The kind of evidence a criterion needs is
its author's to name and the reviewer's to judge; the contract checks presence and the commit,
not truth. Criteria are numbered records, so a verdict names one by number; whether a criterion
is really two is a warning at the write, from a conjunction list the project's prose language
supplies, never a refusal.

**The schema is the document.** `forge schema forge_issues` and `forge advance --owed` carry the
entry criteria in the tool's own words. The skill keeps the five rules and the three judgement
calls — is this a screen change, is this ambiguity expensive to reverse, is this lesson worth a
line — and cites the verb for everything else.

**Every route is the same route.** The CLI enforces; the pre-hook applies the same check to the
tracker tool called directly, so the contract cannot be stepped around by choosing a client.

## What it does not do

- It cannot tell a true verdict from a false one. ISS-31's verdict cited a screenshot of a
  similar screen. Presence and recency are checkable; fit is the reviewer's and codex's.
- It cannot start a run. An issue worked outside the workflow meets the contract at its first
  transition, which is earlier than today and later than the plan.
- It does not add fields. Everything it reads exists on the issue now.

## Open questions

- Batches: members share the merge and the run and each cites the same evidence, and each earns
  its own statuses — a member that fails stays where it is while the rest advance. What the
  branch does with the failed member's commits is the project's revert policy, not this
  contract's.
- Whether the tracker's task records fit the per-criterion verdict better than a shaped comment.
- What a project with no deploy step writes for `released`.
