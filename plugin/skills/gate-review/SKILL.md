---
name: gate-review
description: >-
  Profile a project's gate — the check, lint, build and test pipeline a change has to pass — and
  make the same gate answer faster on the same machine without letting anything through it. Use
  when a gate run has grown into a tax every run pays, when its whole-run time crosses the budget
  the project set or has grown by a quarter since it was last profiled, or when asked why the
  pipeline takes as long as it does. Triggers on "the gate is slow", "profile the gate", "speed up
  the suite", "why does check take so long", "run the tests in parallel", "the fixtures are
  piling up".
version: 0.1.0
---

# Gate review

A gate is the one cost a project pays on every run, and pays again on every re-run after a fix.
Halving it hands the difference back to every run that follows, in every session, for as long as
the project lives. That is the whole reason this exists, and it is also the reason it is dangerous:
the fastest gate available is the one that checks nothing.

## The answer is not yours; the harness is

A gate has two halves. The **answer** is which trees it refuses and why. The **harness** is
everything that arrives at that answer — the order of the steps, what each one reads, what runs
beside what, how fixtures are built, what gets spent twice. This review changes the harness only.
After it, the gate refuses every tree it refused before, for the same reason, and the sole
difference is the clock.

Four changes are refused however much they save, because each buys the seconds by buying coverage:

- deleting a case
- weakening an assertion
- raising a limit
- skipping a step

A gate made smaller and reported as faster is worse than the slow one it replaced, because nobody
knows it happened. Where the measurement says the only saving available is one of those four, that
finding *is* the outcome — write it, and leave the gate as it stands.

## 1. Take the gate the project states

Read it off the project rather than assembling one: the scripts its manifest declares, its CI
workflow, a make target, the command its rules file calls the gate. Whichever of those the project
calls the gate is the one under review, even where a cheaper subset of it exists.

**Where a project states no gate, say so and stop.** A pipeline put together from the commands
that happen to be present is nobody's gate, so making it quicker returns time to no one, and every
number after that is about an artefact of the review's own making.

Then find out how often it is spent. A step run once before a merge and a step run forty times in
one session are the same seconds and nothing like the same tax — and the second is where the whole
saving lives.

## 2. Measure before you read the harness

Where the minutes go is routinely not where the code looks expensive: a step that walks the entire
tree in one process can be cheaper than one that spawns a process per file. So four measurements
come first, and each is kept as output, because the verdicts at the end cite the measurement rather
than paraphrasing a reading of it.

| Measurement | What only measuring can tell you |
|---|---|
| the whole run, then every step on its own clock | whether one step holds the majority of the run or the cost is spread evenly — two different problems |
| inside that step, its slowest units and their durations | whether the cost sits in a handful of units or lies flat across all of them |
| what a run leaves behind, sized and counted before and after | growth that never comes back: fixtures, caches, temporary trees |
| the same work spent in two steps | a compile a test step repeats, one linter run under two configurations |

How to take each of the four against a harness you have never seen, and what makes one timing
comparable with another: [`references/measuring.md`](references/measuring.md).

## 3. Change the harness, one change at a time

Time each change on its own. A batch of five that saves a minute together says nothing about which
of the five earned it, and the one that saved nothing stays in the tree as a permanent cost whose
benefit nobody can find again.

The moves that keep the answer, and the shape each takes when it silently stops keeping it:
[`references/the-moves.md`](references/the-moves.md).

## 4. Prove the gate still refuses

A green run on the tree in front of you is the weakest evidence available, because that tree passed
before you touched anything. What has to be shown is *refusal*: the project's own failing cases
still failing, each changed step still reached by a change that reaches it, nothing quietly absent.
[`references/proving-it.md`](references/proving-it.md).

## 5. Report two numbers, and revert whatever earned neither

Before and after, same tree, same stated conditions, both in the release note. A change whose
saving sits inside the noise is reverted rather than argued for: it is a harness somebody has to
understand for years, bought with nothing.

## When one of these is due, and the run it happens in

Not when the gate feels slow. It is owed by the gate's own timing — a budget crossed, or a
proportion grown — and the review ends by recording the number the next one measures from. The
trigger, what a project that records nothing does for its first review, and the shape of the run
itself: [`references/when-it-is-owed.md`](references/when-it-is-owed.md).

Taking that run from its issue to a release is the issue-flow skill's job, not this one's. This
skill is what such a run does between its plan and its evidence.

## Reference material

Read on arrival at the step that cites it.

| File | Read at |
|---|---|
| [`references/measuring.md`](references/measuring.md) | step 2, and whenever a number has to be comparable to another |
| [`references/the-moves.md`](references/the-moves.md) | step 3 |
| [`references/proving-it.md`](references/proving-it.md) | step 4, and before any verdict |
| [`references/when-it-is-owed.md`](references/when-it-is-owed.md) | before step 1, to learn whether a review is due at all |
