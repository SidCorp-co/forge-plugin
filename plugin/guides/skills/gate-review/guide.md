# Gate review

A gate is paid on every run and again on every re-run after a fix. This review makes it cheaper
without letting one more tree through.

## The answer is not yours; the harness is

The **answer** is which trees the gate refuses and why. The **harness** is everything that arrives
at it: step order, what each step reads, what runs beside what, how fixtures are built, what is
spent twice. This review changes the harness only. After it, the gate refuses every tree it refused
before, for the same reason, and the sole difference is the clock.

Four changes are refused however much they save: deleting a case, weakening an assertion, raising a
limit, skipping a step. Where the measurement says the only saving available is one of those, that
finding is the outcome: write it, and leave the gate as it stands.

## 1. Take the gate the project states

Read it off the project: the scripts its manifest declares, its CI workflow, a make target, the
command its rules file calls the gate. Whichever the project calls the gate is the one under review,
even where a cheaper subset exists.

**Where a project states no gate, say so and stop.** A pipeline assembled from the commands that
happen to be present is nobody's gate.

## 2. Measure before you read the harness

Four measurements come first, each kept as output the verdicts cite:

| Measurement | What it separates |
|---|---|
| the whole run, then every step on its own clock | one step holding the majority, or the cost spread evenly |
| inside that step, its slowest units and their durations | a handful of expensive units, or per-unit overhead paid n times |
| what a run leaves behind, sized and counted before and after | growth that never comes back |
| the same work spent in two steps | a compile a test step repeats, one linter under two configurations |

How to take each against a harness you have never seen, and what makes two timings comparable:
`forge guide gate-review measuring`.

## 3. Change the harness, one change at a time

Time each change alone. A batch of five that saves a minute says nothing about which earned it.

**Order comes first: cheap steps before expensive ones.** A tree that is going to fail should fail in
seconds, so every re-run after a fix pays for the cheap steps and stops. The other moves that keep the
answer, and the hole each opens when it stops keeping it: `forge guide gate-review the-moves`.

## 4. Prove the gate still refuses

A green run on a tree that passed before you touched anything proves nothing. Show refusal: the
project's own failing cases still failing, each narrowed step still reached, nothing quietly absent.
`forge guide gate-review proving-it`.

## 5. Report two numbers, and revert whatever earned neither

Before and after, same tree, same stated conditions, both in the release note. A saving inside the
noise is reverted.

## When one is due

By the gate's own timing, never by how slow it feels. The two triggers, the arithmetic behind each,
and the figure this review has to leave for the next one: `forge guide gate-review when-it-is-owed`.

Taking the run from its issue to a release is the `issue-flow` skill's job. This skill is what such a
run does between its plan and its evidence.

## Reference material

| Read | At |
|---|---|
| `forge guide gate-review when-it-is-owed` | before step 1, to learn whether a review is due |
| `forge guide gate-review measuring` | step 2, and whenever two numbers must compare |
| `forge guide gate-review the-moves` | step 3 |
| `forge guide gate-review proving-it` | step 4, and before any verdict |
