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

This skill's method is served by the CLI, so every session reads the current text: run `forge guide gate-review` and follow what it prints. It names the references it cites, each read with `forge guide gate-review <reference>` at the point the method calls for it. What follows this paragraph, if anything, is the arguments the caller passed.
