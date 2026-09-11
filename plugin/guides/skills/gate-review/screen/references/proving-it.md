# Showing the refusal survived

Three things are proved, each differently: the gate still refuses, a narrowed step is still reached,
the saving is real.

## The refusal inventory, collected before the change

Collect it *before* touching the harness; afterwards a case that never refused and one you broke look
the same:

- the project's own failing cases: a checker's test asserting a refusal, a fixture tree the gate
  rejects
- a deliberate violation of each rule the changed steps enforce, one per rule, on a scratch tree
- the exact message each refusal produced, not its exit code

Run the inventory against the old harness, keep the output, run it against the new one, and compare
the two outputs.

**A step you cannot watch refuse anything has not been proven.** Green and switched-off are the same
observation. The verdict says that rather than pass, and writing the case it lacks is the most
valuable thing the review produces.

## Where a scope was narrowed

The claim under test is the declaration, and it takes three pieces of evidence:

1. **The harness does what it says.** Touch a path the step now disclaims and watch it be skipped.
   This passes even when the declaration is wrong.
2. **What it says is true.** Spend the step by hand on the same tree and read its answer. If the
   answer moved, the step has been silently switched off for every tree of that shape.
3. **The disclaimed set is complete, and tried in combination.** Derive the disclaimed paths from
   what the step reads transitively, group them into classes (configuration, generated inputs, mode
   selectors, data), and try each class once alone and once beside a real violation. A config alone
   changes no answer and a violation alone is caught; the tree holding both is the one that slips.

## Where concurrency changed

Fix the number of runs before starting, from the project's own tolerance: a project accepting one red
run in fifty needs enough runs for that race to have had its chance; one treating any flake as a
defect needs more than a review can afford, which means the parallelism is proposed, not shipped.
Report the count and the tolerance it came from.

Vary the schedule: more than one concurrency level, a different unit order, a loaded machine as well
as an idle one. Compare *failures*, not passes: spend the units that fail at the old concurrency and
at the new one and read both.

Where the machine differs from the one the gate normally runs on, say what both are.

## The two numbers

Before and after under the conditions `forge guide gate-review measuring` pins down, with the share
of the run the changed step held on each side. The share is what tells the next review where to
look.

## When the gate is red after a harness change

Restore the harness that answered, then reapply one change and time it alone. A red gate under an
unproven harness cannot distinguish a defect the change exposed from one it introduced.
