---
name: dispatch
description: >-
  Run one wave of delegated issue work: triage what is open, group what shares a place, dispatch each
  through a shipped role, and fold what came back. Invoke when several issues are to be worked by
  delegated runs rather than by this session, or when a wave that was dispatched has reported and
  owes its fold. For taking one issue to landed code yourself, use the issue-flow skill instead; for
  reading or filing without either, the forge skill. Triggers on "dispatch a wave", "what should we
  work next", "delegate these issues", "fold the wave", "triage the backlog".
version: 1.0.0
---

This skill's method is served by the CLI, so every session reads the current text: run
`forge guide dispatch` and follow what it prints. It names the references it cites, each read with
`forge guide dispatch <reference>` at the point the method calls for it. What follows this
paragraph, if anything, is the arguments the caller passed.
