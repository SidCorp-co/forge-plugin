---
name: issue-flow
description: >-
  Implement a tracker issue end to end — verify it, build it, land it with its batch. Invoke
  when an issue has to become deployed code: verifying what it claims, implementing, checking
  what it reaches, and landing it and closing it once its criteria are met. For reading,
  listing or filing issues without implementing them, use the forge skill instead.
  Triggers on "work ISS-nn", "implement this issue", "fix ISS-nn", "làm issue",
  "xử lý ISS-nn", "ship this issue".
version: 2.1.7
---

This skill's method is served by the CLI, so every session reads the current text: run `forge guide issue-flow` and follow what it prints. It names the references it cites, each read with `forge guide issue-flow <reference>` at the point the method calls for it. What follows this paragraph, if anything, is the arguments the caller passed.
