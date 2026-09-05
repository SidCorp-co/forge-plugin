# Showing the refusal survived

Three things get proved, and each is proved differently: that the gate still refuses, that a
narrowed step is still reached, and that the saving is real.

## The refusal inventory, collected before the change

A gate's value is entirely in what it says no to, so that is what the evidence has to be about.
Collect it *before* touching the harness, because afterwards you cannot tell a case that never
refused from one you broke:

- the project's own failing cases — a checker's test asserting a refusal, a fixture tree the gate
  is known to reject
- a deliberate violation of each rule the changed steps enforce, one per rule, on a scratch tree
- the exact message each refusal produced, not merely its exit code: a step now failing for a
  different reason has changed the answer

Run the inventory against the old harness, keep the output, run it against the new one, and compare
the two outputs rather than two verdicts.

**A step you cannot watch refuse anything has not been proven.** For such a step, green and
switched-off are the same observation, and no amount of running it distinguishes them. The verdict
says that rather than saying pass; and where the step matters, writing the case it lacks is the
most valuable thing the review produces.

## Where a scope was narrowed

The claim to test is the declaration, not the plumbing, and they need separate evidence:

1. **The harness does what it says.** Touch a path the step now disclaims and watch the step be
   skipped. This half passes even when the declaration is wrong, so on its own it proves nothing.
2. **What it says is true.** Spend that step by hand on the same tree and read its answer. If the
   answer moved, the declaration was too narrow and the step has been silently switched off for
   every tree of that shape.

3. **The disclaimed set is complete, and its members are tried in combination.** One path at a
   time is not enough. An excluded configuration file, a generated input or a mode selector often
   matters only *together* with a violation the step does catch: the config alone changes no
   answer, the violation alone is caught, and the tree holding both is skipped and accepted. So
   derive the disclaimed paths from what the step reads transitively, group them into classes —
   configuration, generated inputs, mode selectors, data — and try each class once alone and once
   beside a real violation.

The second is the half that gets left out of reports. The third is the one a refusal inventory
cannot reach, because an inventory tries every rule on its own and this failure only exists when
two things are true at once.

## Where concurrency changed

"Several times" is not a criterion, so fix the number before starting, and take it from the
project's own tolerance rather than from patience: a project accepting one red run in fifty needs
enough runs for a one-in-fifty race to have had its chance, and a project treating any flake as a
defect needs more runs than a review can afford — which is itself the answer, and means the
parallelism is proposed rather than shipped. Report the count, the tolerance it came from, and
what a failure at that rate would cost.

Then vary the schedule instead of repeating one: more than one concurrency level, a different unit
order, a loaded machine as well as an idle one. Repetition at a fixed schedule re-runs a single
interleaving and finds the same nothing every time.

And compare *failures*, not passes. Spend the units that fail at the old concurrency and at the new
one and read both: a race announces itself as a failure changing shape, never as a green run
staying green.

Where the machine differs from the one the gate normally runs on, say what both are. Parallelism
that helps on many cores can be neutral or worse on few, and a saving measured only on the wide
machine is a saving reported for a machine nobody uses.

## The two numbers

Before and after, taken under the conditions `forge guide gate-review measuring` pins down, with the
share of the run the changed step held on each side. The share matters as much as the seconds: an
identical absolute saving means very different things in a three-minute run and an hour-long one,
and the share is what tells the next review where to look.

## When the gate is red after a harness change

That is not a slow gate to push past. Restore the harness that answered, then reapply one change
and time it alone. A red gate under an unproven harness cannot distinguish a real defect the change
exposed from one the change introduced, and guessing between those two is how a coverage hole gets
committed as a fix.
