---
name: harness-eval
description: >-
  Judge the harness by its own numbers: run the evals that compare the last window of consults and of
  issue-flow runs with the window before, attribute each figure that moved to the change that
  separates the windows, and file what the numbers say against the issue that made the change. Invoke
  when a release or a consult prints the line naming an eval, or before a harness change is judged by
  the feel of the next few runs. For building a change the numbers point at, use the issue-flow skill;
  for a wave of issues, the dispatch skill. Triggers on "run the eval", "did that release make runs
  cheaper", "judge the harness", "read the eval".
version: 1.0.0
---

This skill's method is served by the CLI, so every session reads the current text: run
`forge guide harness-eval` and follow what it prints. It names the references it cites, each read
with `forge guide harness-eval <reference>` at the point the method calls for it. What follows this
paragraph, if anything, is the arguments the caller passed.
