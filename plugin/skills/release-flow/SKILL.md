---
name: release-flow
description: >-
  Drive one release job from a change that has landed to a verified production deployment and
  the account of what happened — establishing the state before changing it, repairing forward
  where the world does not match the plan, and stopping at a declared bound rather than at a
  hunch. Invoke when a release run names this method, when a promotion or deploy did not come
  up as intended, or when a release has to be taken from a landed commit to a deployment
  somebody has read. For taking one tracker issue from its title to landed code, use the
  issue-flow skill instead. Triggers on "run the release", "promote to production",
  "the deploy did not come up", "the release job is stuck".
version: 1.0.0
---

This skill's method is served by the CLI, so every session reads the current text: run `forge guide release-flow` and follow what it prints.

**Announce what loaded first.** Where that call answered, its opening says how to declare the method and under what name. Where it did not — no such command, a refusal, an empty body — announce that and why, the way the release job's own prompt says to: a run that goes quiet about a method it could not read is one nobody can find afterwards.

**Repair forward.** A release here has no way back, so whatever arrives or fails to arrive is answered by a further step, not by undoing this one.

What follows this paragraph, if anything, is the arguments the caller passed.
