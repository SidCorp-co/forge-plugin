# SRS §9 — FR-07 — The gate harness

Rev: 1 · Actors: developer, agent · Enforces: BR-01, BR-07, BR-08, BR-13 · Source: docs/HOOKS.md

← [Index](./README.md) · [§8 FR-06 The second opinion](./fr-06-second-opinion.md) · Next: [§10 FR-08 Irreversible commands](./fr-08-irreversible-commands.md)

## Purpose

*Why does this requirement exist?*

Every gate in this product shares four problems: what counts as a write, how a refusal is worded,
what it costs to run, and how it is turned off. Solving each of them once is the difference between
a set of gates and an arrangement — a second account of what a write is would diverge the first
time one of them was corrected.

The cost was measured: registering each gate separately paid a language runtime's startup per gate
per tool call, with several of them reading the same transcript apart.

## Actors

*Who acts here?*

- **The developer**, who switches a gate off and reads why one fired.
- **The agent**, which is refused, and which opens the gate's own document to find the way out.

## Use cases

*What is shared, and what does a refusal owe its reader?*

### UC-07-1 — One process per event

Rev: 1 · Actors: agent · Enforces: BR-08

The host is given one registration per event, and the gates named on it run in one process against
one event, sharing the reads they all need. Before a call the first refusal is the answer and the
rest are not asked; after one, every gate's answer travels together.

- **AC-07-1-1** · Rev: 1 · Proof: plugin/test/gate.test.mjs
  WHEN a call is about to be made THEN the first gate to refuse SHALL be the answer, and the gates
  after it SHALL not be asked.
- **AC-07-1-2** · Rev: 1 · Proof: plugin/test/gate.test.mjs
  WHEN a call has been made THEN every gate's answer SHALL be collected and sent together.
- **AC-07-1-3** · Rev: 1 · Proof: plugin/test/gate.test.mjs
  IF one gate crashes THEN the runner SHALL skip it, log it, and ask the rest.
- **AC-07-1-4** · Rev: 1 · Proof: plugin/test/gate.test.mjs
  WHILE the line runs the deadline SHALL be counted from the process start, so the last gate reads
  what is left of it rather than a fresh budget.
- **AC-07-1-5** · Rev: 1 · Proof: plugin/test/gate.test.mjs
  WHERE the same gate is asked on its own it SHALL answer with the same text as it does in the line.

### UC-07-2 — What counts as a write

Rev: 1 · Actors: agent · Enforces: BR-08, BR-09

Most edits arrive through a shell, so a gate watching the host's edit routes sees a fraction of
them. One account answers for every gate that asks: after a call the disk answers, and before a
call the command's text does, judged where a command starts.

The reach of that account is exactly its mechanism, and the clause says so rather than promising
more: after a call, a token in the command that names a real file changed within the last breath is
a write, so a route that spells its target is covered and one that computes the name is not.

- **AC-07-2-1** · Rev: 1 · Proof: plugin/test/code-quality.test.mjs
  WHEN a call has written a file whose name the command spells THEN the gates SHALL see that file,
  whichever route wrote it.
- **AC-07-2-2** · Rev: 1 · Proof: plugin/test/bash-guard.test.mjs
  IF a write verb appears where a command starts THEN it SHALL count as a write, and one inside a
  data body SHALL not.
- **AC-07-2-3** · Rev: 1 · Proof: plugin/test/bash-guard.test.mjs
  WHEN a wrapper or a prefix stands before a verb THEN the gates SHALL read the verb it runs.
- **AC-07-2-4** · Rev: 1 · Proof: none yet — ISS-37
  IF a call wrote a file under a name the command never spells THEN the gates SHALL either see that
  file or SHALL say that they could not.

### UC-07-3 — A refusal, and the document behind it

Rev: 1 · Actors: agent · Enforces: BR-01

What a refusal must carry is BR-01's, and what it may cost is C-08's; the wording itself lives in
the gate that produces it, because a message assembled anywhere else drifts from what the code
actually refused, and `docs/HOOKS.md` records the four failures that shaped it. What this
requirement adds is that both the refusal and the document behind it have a *checkable* shape, so a
document that argues where it should instruct fails a test rather than a reader's patience.

- **AC-07-3-1** · Rev: 1 · Proof: plugin/test/hook-how.test.mjs
  WHEN a gate's document is written THEN it SHALL open with the gate's name and its claim, SHALL
  carry its reason as the second paragraph within the cap, SHALL say what is not judged on a line of
  its own, and SHALL stay under the size cap.
- **AC-07-3-2** · Rev: 1 · Proof: plugin/test/hook-how.test.mjs
  WHEN a gate's document is written THEN it SHALL name no absolute path and SHALL explain no code,
  since only the plugin's own directory travels into an installed copy.
- **AC-07-3-3** · Rev: 1 · Proof: plugin/test/doc-claims.test.mjs
  IF a document tells a reader to run a command THEN that command SHALL be one the CLI has.

### UC-07-4 — Every gate can be switched off, one at a time

Rev: 1 · Actors: developer · Enforces: BR-07, BR-08

The host has no per-gate switch (C-06), so this is the product's own: one key in the account's
configuration, written by one command, read by the gate process rather than by the registration, so
a switch takes effect without a restart. Why there is one key and not a second beside it is BR-08,
and `docs/HOOKS.md` carries the state that settled it.

- **AC-07-4-1** · Rev: 1 · Proof: plugin/test/hook-switch.test.mjs
  WHEN a gate is named in the switch THEN it SHALL not fire, and a gate not named SHALL fire.
- **AC-07-4-2** · Rev: 1 · Proof: plugin/test/hook-switch.test.mjs
  IF the configuration will not parse THEN every gate SHALL run, so a broken switch costs a gate
  firing rather than a gate silently gone.
- **AC-07-4-3** · Rev: 1 · Proof: plugin/test/hook-switch.test.mjs
  WHERE a gate exists it SHALL honour the switch, including a gate that reads no event.
- **AC-07-4-4** · Rev: 1 · Proof: plugin/test/hook-switch.test.mjs
  IF the name given matches no gate THEN the CLI SHALL refuse and SHALL name the nearest match.

### UC-07-5 — Every refusal is written down

Rev: 1 · Actors: developer · Enforces: BR-13

Refusing too much is this product's characteristic failure, and nothing else finds it: `docs/HOOKS.md`
carries what the years without a log cost. The duty here is that refusing is itself what writes the
line, so no gate can opt in or forget, and that a credential inside a logged line is masked before
it reaches the file.

- **AC-07-5-1** · Rev: 1 · Proof: plugin/test/hook-log.test.mjs
  WHEN a gate refuses THEN the refusal SHALL be written to the log by the act of refusing.
- **AC-07-5-2** · Rev: 1 · Proof: plugin/test/hook-log.test.mjs
  WHEN a value in a logged line is a credential, or is named as one, THEN it SHALL be masked before
  it is written.
- **AC-07-5-3** · Rev: 1 · Proof: plugin/test/hook-log.test.mjs
  IF the log does not exist THEN reading it SHALL answer with no entries rather than fail.

### UC-07-6 — A session running a stale copy is told

Rev: 1 · Actors: developer · Enforces: BR-01

The plugin runs from a copy the installer made, and the installer compares versions only (C-01), so
an edit that did not bump the manifest never reaches a session. A session running a copy the install
has moved past is told to restart, and one running the installed copy is told nothing.

- **AC-07-6-1** · Rev: 1 · Proof: plugin/test/plugin-copy.test.mjs
  IF the running copy is older than the installed one THEN the CLI SHALL say so and SHALL name the
  restart as the way out.
- **AC-07-6-2** · Rev: 1 · Proof: plugin/test/plugin-copy.test.mjs
  IF the install record cannot be read THEN the CLI SHALL stay silent rather than warn.
- **AC-07-6-3** · Rev: 1 · Proof: plugin/test/shipped-version.test.mjs
  WHEN the plugin is packaged THEN every manifest SHALL carry the version its package is at.

## Business rules enforced

*Which rules of the BRD does this requirement carry out?*

| Rule | How this requirement carries it |
|---|---|
| BR-01 | the shape of every refusal and the shape of the document behind it are both checked |
| BR-07 | the switch and the scope are the account's and the project's, never assumed |
| BR-08 | one account of what a write is, one place a gate is switched off |
| BR-13 | every refusal is logged by the act of refusing, so a false positive is findable |
