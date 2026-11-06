## The flow

**The default path is the direct one.** Claim the issue, build it in its batch, land the batch,
record the merge and move the issue to `awaiting_release`; the release that claims it closes it.
Nobody stands between the build and the base branch: the criteria are judged once per batch, live,
after the release, and one red there goes into the next batch.

| Status | Promise to the next reader | Walked |
|---|---|---|
| `open` | someone filed this | always |
| `in_progress` | a run holds it; its step says how far the work got | always |
| `approved` | the plan and criteria were approved before the code | where `plan_approval` or `design_record` is enforced |
| `in_progress:test` | the change is on the base branch | reviewed first where `merge_review` is enforced |
| `in_progress:release` | the evidence is here to be judged | on the ladder, by a judge other than the builder where `independent_qa` or the flow asks one |
| `awaiting_release` | the change landed and its merge is recorded | always |
| `closed` | the release that claimed it shipped it | only that release enters it |
| `reopen` | a finding sent the work back: a person disputing a close or a drop, or a red criterion | on a finding |

The gates are `forge-runner api projects/<id>/gates`. `forge advance` walks every rung, `--owed`
saying what the next costs; with none on, take the direct path, where core's kernel still refuses
`awaiting_release` without the merge and any close but the release's. On the ladder the judge's
verdicts earn `in_progress:release` and the deployer's verification `awaiting_release`.

A park is a message to a person, and who lifts it is who was asked. `dropped` always means no code
landed. Abandon code that did land by reverting it, never by dropping the issue.
