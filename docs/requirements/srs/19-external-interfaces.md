# SRS §19 — External interfaces

← [Index](./README.md) · [§18 Data](./18-data.md) · Next: [§20 Traceability](./traceability.md)

## What this product talks to

*Which boundaries does it cross, and what does each one owe?*

Every interface here is somebody else's, so each clause says what this product may assume about it
and what it does when the assumption fails.

### EI-01 — The tracker

Rev: 1 · Enforces: BR-02, BR-14

One request per call over the tracker's own endpoint, with the credential and the project's slug in
the request. The tracker owns its state machine, its fields and its data fence; this product owns
none of them. Its errors are the network's fault rather than the work's, and are retried and never
recorded (UC-02-5).

- **AC-19-1-1** · Rev: 1 · Proof: plugin/test/tracker/rpc.test.mjs "the identifying argument is derivable from the reference set"
  WHEN the tracker declares a surface THEN the CLI SHALL read the declaration rather than assume
  it, and SHALL refresh the cached copy when a name lookup misses.
- **AC-19-1-2** · Rev: 1 · Proof: plugin/test/flow/record.test.mjs "the tracker's data fence around a field or a body is not part of it"
  WHEN a field arrives inside the tracker's data fence THEN the reader SHALL take the value and
  never the fence.

### EI-02 — The review provider

Rev: 1 · Enforces: BR-16

A model from another provider, reached over its own gateway. It is worth its tokens only because it
is a different family, so a slot resolving to this model's own family is refused (C-09). Every tool
call it makes is printed as it runs, and a path it asks for outside the checkout is refused.

- **AC-19-2-1** · Rev: 1 · Proof: plugin/test/codex/codex.test.mjs "the model slot resolves through the profile, not the flag"
  WHEN the review model is resolved THEN the resolution SHALL come from the profile rather than
  from a flag, and an own-family slot SHALL be refused.
- **AC-19-2-2** · Rev: 1 · Proof: plugin/test/codex/codex-tools.test.mjs "a path that is not there is answered with the nearest directory that is"
  IF the reviewer asks for a path outside the checkout THEN the CLI SHALL refuse and SHALL name what
  the checkout holds at its top.

### EI-03 — The host that runs the gates

Rev: 1 · Enforces: BR-01, BR-07

The session host hands each gate an event and reads back a decision. What the host offers is fixed:
one registration per event, no per-gate switch (C-06), and a copy of the plugin taken at install
time (C-01). How a gate's answer becomes that protocol is `docs/HOOKS.md`'s.

- **AC-19-3-1** · Rev: 1 · Proof: plugin/test/hooks/gate.test.mjs "after a call, every gate's block and context travel together"
  WHEN a gate decides THEN the runner SHALL express that decision in the host's own protocol.
- **AC-19-3-2** · Rev: 1 · Proof: plugin/test/hooks/gate-entry.test.mjs "an empty bin gets both"
  WHEN a session starts THEN the product SHALL put its binaries on the path from the copy that is
  running.

### EI-04 — The project's linter

Rev: 1 · Enforces: BR-07

Reached through its own entry point, which resolves the workspace, the binary and the
configuration. Which copy of it answers is `README.md`'s; a project with neither is silence
(NFR-09).

- **AC-19-4-1** · Rev: 1 · Proof: plugin/test/gates/code-quality.test.mjs "a finding is refused in the delegate's protocol and written to the log like every other"
  WHEN a file is linted THEN the finding SHALL come from the project's own configuration, and the
  product SHALL add no rule of its own.

### EI-05 — The Vietnamese gateway

Rev: 1 · Enforces: BR-11, BR-14

A streaming model call per segment, with its own key in its own configuration file. Placeholder
accounting and segmentation are this product's; the prose is the model's and is judged by a person
(NFR-10).

- **AC-19-5-1** · Rev: 1 · Proof: plugin/test/vi/vi-gateway.test.mjs "a key reaches the results only where its translation carries the source's placeholders and no others"
  WHEN a batch is sent THEN the result SHALL be accepted only if every placeholder is accounted
  for.

### EI-06 — The zone and record service

Rev: 1 · Enforces: BR-08

Zones, records and cache purges on the developer's own credential, from the same account
configuration as everything else — one source, so nothing about which credential answered is a
precedence rule.

- **AC-19-6-1** · Rev: 1 · Proof: plugin/test/tools/cloudflare.test.mjs "an environment pair is not an account"
  WHEN a zone or record call is made THEN the credential SHALL come from the account's own
  configuration.

### EI-07 — The version-control host

Rev: 1 · Enforces: BR-02

Branches, commits and pushes are the developer's own tooling, not this product's. It reads the tree
to decide what a call wrote and what a commit would land, and it writes nothing to a remote of its
own accord. What the repository knows is written onto the issue at the step that knew it, and never
read back at judging time.

- **AC-19-7-1** · Rev: 1 · Proof: plugin/test/gates/codex-second.test.mjs "a commit is judged by the tree it names, not the shell's"
  WHEN a commit is judged THEN the tree judged SHALL be the one the command names rather than the
  shell's.

### EI-08 — The session host's record of a run

Rev: 1 · Enforces: BR-08

The same host keeps a line-delimited record of what each subagent it ran did, in a scratch directory
of its own naming. The shape is the host's and may move under this product; the directory is worked
out from the project's own path rather than held anywhere, so there is nothing to keep in step with
it. Reading is all this product does there.

- **AC-19-8-1** · Rev: 1 · Proof: plugin/test/stats/runs.test.mjs "nothing a caller writes is opened"
  WHEN a profile is asked for THEN the CLI SHALL work the directory out from the project directory
  given, and SHALL refuse a location arriving any other way.
- **AC-19-8-2** · Rev: 1 · Proof: plugin/test/stats/runs.test.mjs "a window is read off the run's own clock, not the file's"
  WHEN a run is judged against a window THEN the CLI SHALL take the run's own last moment rather
  than the moment the file was last touched.
- **AC-19-8-3** · Rev: 1 · Proof: plugin/test/stats/runs.test.mjs "every row of a fixture run is what the transcript adds up to"
  WHERE a call in that record was never answered the CLI SHALL report it as unanswered and SHALL
  add nothing to any waiting time on its account.
