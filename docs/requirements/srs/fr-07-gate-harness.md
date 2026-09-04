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

- **AC-07-1-1** · Rev: 1 · Proof: plugin/test/hooks/gate.test.mjs "before a call, the first gate to refuse is the answer and the rest are not asked"
  WHEN a call is about to be made THEN the first gate to refuse SHALL be the answer, and the gates
  after it SHALL not be asked.
- **AC-07-1-2** · Rev: 1 · Proof: plugin/test/hooks/gate.test.mjs "after a call, every gate's block and context travel together"
  WHEN a call has been made THEN every gate's answer SHALL be collected and sent together.
- **AC-07-1-3** · Rev: 1 · Proof: plugin/test/hooks/gate.test.mjs "a gate that crashes is skipped and logged, and the line goes on"
  IF one gate crashes THEN the runner SHALL skip it, log it, and ask the rest.
- **AC-07-1-4** · Rev: 1 · Proof: plugin/test/hooks/gate.test.mjs "the deadline runs from the process start, and the last gate reads what is left"
  WHILE the line runs the deadline SHALL be counted from the process start, so the last gate reads
  what is left of it rather than a fresh budget.
- **AC-07-1-5** · Rev: 1 · Proof: plugin/test/hooks/gate.test.mjs "a gate switched off on the line is skipped, and one that is not still answers"
  WHERE the same gate is asked on its own it SHALL answer with the same text as it does in the line.

### UC-07-2 — What counts as a write

Rev: 2 · Actors: agent · Enforces: BR-08, BR-09

Most edits arrive through a shell, so a gate watching the host's edit routes sees a fraction of
them. One account answers for every gate that asks: after a call the disk answers, and before a
call the command's text does, judged where a command starts.

The reach of that account is exactly its mechanism, and the clause says so rather than promising
more: after a call, a token in the command that names a real file whose mtime is at or after the
moment that call was asked for is a write, so a route that spells its target is covered, one that
computes the name is not, and a tree stamped whole before the call is nobody's work. Three cases sit
outside it and are claimed by nothing: a write that lands after its own call has been judged, a
route that preserves a timestamp it did not set, and a file written by another call of the same
request.

- **AC-07-2-1** · Rev: 1 · Proof: plugin/test/gates/code-quality.test.mjs "a finding is refused in the delegate's protocol and written to the log like every other"
  WHEN a call has written a file whose name the command spells THEN the gates SHALL see that file,
  whichever route wrote it.
- **AC-07-2-2** · Rev: 1 · Proof: plugin/test/gates/bash-guard.test.mjs "a literal inside a program is data, and the line that ran it is not"
  IF a write verb appears where a command starts THEN it SHALL count as a write, and one inside a
  data body SHALL not.
- **AC-07-2-3** · Rev: 1 · Proof: plugin/test/gates/bash-guard.test.mjs "git's globals before the verb are read as git reads them"
  WHEN a wrapper or a prefix stands before a verb THEN the gates SHALL read the verb it runs.
- **AC-07-2-4** · Rev: 1 · Proof: none yet — ISS-37
  IF a call wrote a file under a name the command never spells THEN the gates SHALL either see that
  file or SHALL say that they could not.
- **AC-07-2-5** · Rev: 1 · Proof: plugin/test/hooks/writes.test.mjs "a file the checkout stamped before the call began is nobody's write"
  WHERE a checkout stamped every file in it moments before a call, a call that only reads one of
  those files SHALL count as no write.

### UC-07-3 — A refusal, and the document behind it

Rev: 1 · Actors: agent · Enforces: BR-01

What a refusal must carry is BR-01's, and what it may cost is C-08's; the wording itself lives in
the gate that produces it, because a message assembled anywhere else drifts from what the code
actually refused, and `docs/HOOKS.md` records the four failures that shaped it. What this
requirement adds is that both the refusal and the document behind it have a *checkable* shape, so a
document that argues where it should instruct fails a test rather than a reader's patience.

- **AC-07-3-1** · Rev: 1 · Proof: plugin/test/hooks/hook-how.test.mjs "each document opens with its claim, argues briefly, and points nowhere unreachable"
  WHEN a gate's document is written THEN it SHALL open with the gate's name and its claim, SHALL
  carry its reason as the second paragraph within the cap, SHALL say what is not judged on a line of
  its own, and SHALL stay under the size cap.
- **AC-07-3-2** · Rev: 1 · Proof: plugin/test/hooks/hook-how.test.mjs "each document opens with its claim, argues briefly, and points nowhere unreachable"
  WHEN a gate's document is written THEN it SHALL name no absolute path and SHALL explain no code,
  since only the plugin's own directory travels into an installed copy.
- **AC-07-3-3** · Rev: 1 · Proof: plugin/test/checks/docs/doc-claims.test.mjs "every command a document tells a reader to run is one the CLI has"
  IF a document tells a reader to run a command THEN that command SHALL be one the CLI has.

### UC-07-4 — Every gate can be switched off, one at a time

Rev: 1 · Actors: developer · Enforces: BR-07, BR-08

The host has no per-gate switch (C-06), so this is the product's own: one key in the account's
configuration, written by one command, read by the gate process rather than by the registration, so
a switch takes effect without a restart. Why there is one key and not a second beside it is BR-08,
and `docs/HOOKS.md` carries the state that settled it.

- **AC-07-4-1** · Rev: 1 · Proof: plugin/test/hooks/hook-switch.test.mjs "a hook named in hooksOff does not fire, and one not named does"
  WHEN a gate is named in the switch THEN it SHALL not fire, and a gate not named SHALL fire.
- **AC-07-4-2** · Rev: 1 · Proof: plugin/test/hooks/hook-switch.test.mjs "a config that will not parse runs every gate"
  IF the configuration will not parse THEN every gate SHALL run, so a broken switch costs a gate
  firing rather than a gate silently gone.
- **AC-07-4-3** · Rev: 1 · Proof: plugin/test/hooks/hook-switch.test.mjs "every hook honours the switch, not only the ones that read an event"
  WHERE a gate exists it SHALL honour the switch, including a gate that reads no event.
- **AC-07-4-4** · Rev: 1 · Proof: plugin/test/hooks/hook-switch.test.mjs "a name that matches no hook is refused with the near miss"
  IF the name given matches no gate THEN the CLI SHALL refuse and SHALL name the nearest match.

### UC-07-5 — Every refusal is written down

Rev: 1 · Actors: developer · Enforces: BR-13

Refusing too much is this product's characteristic failure, and nothing else finds it: `docs/HOOKS.md`
carries what the years without a log cost. The duty here is that refusing is itself what writes the
line, so no gate can opt in or forget, and that a credential inside a logged line is masked before
it reaches the file.

- **AC-07-5-1** · Rev: 1 · Proof: plugin/test/hooks/hook-log.test.mjs "a refusal from a live hook lands in the log, redacted"
  WHEN a gate refuses THEN the refusal SHALL be written to the log by the act of refusing.
- **AC-07-5-2** · Rev: 1 · Proof: plugin/test/hooks/hook-log.test.mjs "a credential named as one is masked whatever its value looks like"
  WHEN a value in a logged line is a credential, or is named as one, THEN it SHALL be masked before
  it is written.
- **AC-07-5-3** · Rev: 1 · Proof: plugin/test/hooks/hook-log.test.mjs "a missing log reads as no entries, not as a throw"
  IF the log does not exist THEN reading it SHALL answer with no entries rather than fail.

### UC-07-6 — A session running a stale copy is told

Rev: 1 · Actors: developer · Enforces: BR-01

The plugin runs from a copy the installer made, and the installer compares versions only (C-01), so
an edit that did not bump the manifest never reaches a session. A session running a copy the install
has moved past is told to restart, and one running the installed copy is told nothing.

- **AC-07-6-1** · Rev: 1 · Proof: plugin/test/tools/plugin-copy.test.mjs "a session running a copy the install has moved past is told to restart"
  IF the running copy is older than the installed one THEN the CLI SHALL say so and SHALL name the
  restart as the way out.
- **AC-07-6-2** · Rev: 1 · Proof: plugin/test/tools/plugin-copy.test.mjs "an install record this cannot read is silence, not a warning"
  IF the install record cannot be read THEN the CLI SHALL stay silent rather than warn.
- **AC-07-6-3** · Rev: 1 · Proof: plugin/test/checks/shipped-version.test.mjs "every manifest ships the version its package is at"
  WHEN the plugin is packaged THEN every manifest SHALL carry the version its package is at.

### UC-07-7 — What a gate remembers is reaped by the gate that wrote it

Rev: 1 · Actors: agent · Enforces: BR-07

A gate that asks once has nowhere in the file it guards to keep the answer, so the asking is
remembered beside it — one small file per session, per subject, per kind. Nothing removed them and
they reached 29,626 files, taking a machine's temporary filesystem to 97% of its inodes at 58% of
its bytes; the next suite to start died before its first test, on a shared-memory failure whose
message named space. The machine is not this product's, so what the gates leave on it is bounded by
the writer clearing what nobody can still be reading.

- **AC-07-7-1** · Rev: 1 · Proof: plugin/test/hooks/stamps.test.mjs "every stamp lands in one room named for the plugin, which the first write makes"
  WHEN a gate remembers what it asked THEN the record SHALL land in one directory named for this
  product, which the harness makes for itself.
- **AC-07-7-2** · Rev: 1 · Proof: plugin/test/hooks/stamps.test.mjs "one write sweeps every kind past the bound and leaves the ones inside it"
  WHEN one of them is written THEN every record in that directory past the harness's bound SHALL be
  removed, whatever gate wrote it.
- **AC-07-7-3** · Rev: 1 · Proof: plugin/test/hooks/stamps.test.mjs "one write sweeps every kind past the bound and leaves the ones inside it"
  IF a record is inside that bound THEN it SHALL survive the write, since a session running now may
  still read it.

## Business rules enforced

*Which rules of the BRD does this requirement carry out?*

| Rule | How this requirement carries it |
|---|---|
| BR-01 | the shape of every refusal and the shape of the document behind it are both checked |
| BR-07 | the switch and the scope are the account's and the project's, never assumed; and what the gates leave on a machine of someone else's is bounded |
| BR-08 | one account of what a write is, one place a gate is switched off |
| BR-13 | every refusal is logged by the act of refusing, so a false positive is findable |
