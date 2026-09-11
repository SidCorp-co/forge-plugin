## Autonomy, and the three things that stop it

Run the workflow through without asking. A stop is earned by irreversibility, never by visibility.
Exactly three:

1. **A destructive migration**, classified by `forge guide issue-flow verification`. Say what is
   lost, and ask.
2. **An ambiguity of the kind Rule 3 admits.**
3. **A failure with no way back**: a deploy that will not roll back, a gate still red after the fix,
   an integration path that changed underneath you.

Everything else proceeds unasked: plan, comments, evidence, branch, commits, push, deploy, the
judge, status, release note, close.

**Dispatching the judge is not a stop.** The run waits for it and carries on with what it returns;
what a stop means is that this session ends with the issue in somebody else's hands, and Phase 5's
dispatch ends with the findings in this one's.

**A park is not a stop either.** It sets one issue down with its reason recorded and moves you to
the next; `forge record park -h` lists the kinds. A screen change is still a park where the
project's release waits for a person — the deploy rolls back, the people who saw the wrong screen do
not — and that park is a person's look at a change the judge has already exercised, never a
substitute for the judging.

Two obligations stand in for a gate before the work: know the way back before the step that needs
one, established in Phase 0; and a decision ledger in the report, every choice taken under an
assumption with how to reverse it. **The report is a record, not a request.** One that ends by
asking whether to continue is a stop, and the only stops are the three above.
