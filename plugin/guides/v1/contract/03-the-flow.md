## The flow

| Status | Promise to the next reader | Phase owed while held |
|---|---|---|
| `open` | someone filed this | 1 Triage |
| `confirmed` | we read the code; the problem is real and it is this | 2 Clarify |
| `clarified` | every ambiguity is decided or answered | 3 Plan |
| `approved` | object to the plan now, not after | 4 Implement, to the branch |
| `in_progress` | code is being written against this plan | 4 Implement, to the review; 5 Prove; then 7's landing |
| `developed` | the change was reviewed and is on the default branch | 5 Prove |
| `testing` | the evidence is here to be judged | 6, 7 Ship |
| `awaiting_release` | the change is running where it landed, and you can see it now | 7 Ship, the close |
| `closed` | nothing more happens unless reopened; code landed | none |
| `reopen` | a person disagreed with a close or a drop, and their finding is here | 1 Triage, of the person's finding |

Ask `forge advance <ref> --owed` what a row is earned by. The phase a status owes produces the
payload that earns the next row, with one break: the landing that earns `developed` is a step of
Phase 7, so the judging that earns `testing` happens while the issue is still `in_progress`, and
both statuses move on records written before the mark.

The last two rows are one end of a run split by the actor whose record earns each: a judge's verdicts
earn `testing`, and the deploying actor's verification earns `awaiting_release`. One rung asking for
both could not say whose record it was short of.

A park is a message to a person, and who lifts it is who was asked. `dropped` always means no code
landed. Abandon code that did land by reverting it, never by dropping the issue.
