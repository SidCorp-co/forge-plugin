---
name: qa
description: >-
  Drain the issues a project's independent judgement has left standing at `developed`: claim each,
  read whether anybody has to witness it at the running product, judge it or dispatch a judging run
  for it, take it as far as its record earns, and stop when the status reads empty. Invoke when a
  project that declared an independent judgement has work waiting at that status, or when a judging
  run has to be given its own method. For a wave of open issues taken by building runs, use the
  dispatch skill instead; for taking one issue from its title to landed code, the issue-flow skill.
  Triggers on "drain developed", "run the QA master", "judge what is waiting", "who judges this",
  "the judging queue", "nothing has judged these".
version: 1.0.0
---

This skill's method is served by the CLI, so every session reads the current text:
run `forge guide qa` and follow what it prints. It names the references it cites,
each read with `forge guide qa <reference>` at the point the method calls for it.
A run dispatched to judge one issue reads `forge guide qa judging` and nothing above it.
What follows this paragraph, if anything, is the arguments the caller passed.
