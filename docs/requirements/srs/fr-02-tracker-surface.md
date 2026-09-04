# SRS §4 — FR-02 — The tracker surface

Rev: 1 · Actors: agent, developer · Enforces: BR-01, BR-06, BR-14 · Source: docs/FORGE-CLI.md

← [Index](./README.md) · [§3 FR-01 Resolution](./fr-01-resolution.md) · Next: [§5 FR-03 The lease](./fr-03-the-lease.md)

## Purpose

*Why does this requirement exist?*

The backlog has to be readable and writable from a terminal with no client connected, in calls
narrow enough that reading an issue does not cost the turn. Every projection here exists because a
wider one was measured and found to be mostly bytes that said nothing.

## Actors

*Who acts here?*

- **The agent**, which reads before it writes and writes through the narrowest call that answers.
- **The developer**, who uses the same verbs by hand.

## Use cases

*What can be asked of the tracker, and what comes back?*

### UC-02-1 — Browse and read

Rev: 1 · Actors: agent, developer · Enforces: BR-14

A browse projection for many issues and a full read for the one about to be worked. A field of the
full read may be asked for by name. Absence is meaningful: a field with nothing in it is left out
rather than returned as an empty value that says only that the field exists.

- **AC-02-1-1** · Rev: 1 · Proof: plugin/test/tracker/issues.test.mjs "two references resolved at once share one list"
  WHEN two references are resolved in one call THEN the CLI SHALL share one listing between them
  rather than paging twice.
- **AC-02-1-2** · Rev: 1 · Proof: plugin/test/tracker/issues.test.mjs "a uuid is its own answer and asks for no list"
  WHEN the reference given is already an identifier the tracker stores THEN the CLI SHALL ask for no
  listing at all.
- **AC-02-1-3** · Rev: 1 · Proof: plugin/test/cli/commands.test.mjs "nothing else in the record is touched"
  WHEN a read returns an attachment THEN the CLI SHALL collapse it to the reference that fetches it
  and SHALL leave everything else in the record untouched.

### UC-02-2 — A read is never mistaken for complete

Rev: 1 · Actors: agent · Enforces: BR-02, BR-14

A list bound by the caller's own limit is indistinguishable from a complete one, so the answer
carries what was returned, the limit and whether more exists — and a report assembled from a
truncated read is refused rather than rendered.

- **AC-02-2-1** · Rev: 1 · Proof: none yet — ISS-17
  IF the record could not be read whole THEN the CLI SHALL refuse to judge anything on it and SHALL
  say which read was short.

### UC-02-3 — Write to an issue

Rev: 1 · Actors: agent · Enforces: BR-01, BR-06

A comment, a plan, an attachment and a filing are writes, and each is a write whichever route it
takes: the CLI's own verb, or the tracker's tool called directly. An attachment is uploaded rather
than encoded into the call, because bytes through a context window are paid for twice.

- **AC-02-3-1** · Rev: 1 · Proof: plugin/test/tracker/issue-read-first.test.mjs "every verb that writes the record names its issue, and the read verbs name none"
  WHEN a comment, a plan or an attachment is written THEN the gates SHALL treat it as a write, and
  a transition asked for through the tracker's own tool SHALL be treated as one too.
- **AC-02-3-2** · Rev: 1 · Proof: plugin/test/tracker/issue-read-first.test.mjs "the tracker's own tool is judged by its action, with its arguments already parsed"
  WHEN the tracker's own tool is called THEN the CLI SHALL judge the call by the action it names
  rather than by the tool's name.

### UC-02-4 — Everything the tracker returns is untrusted input

Rev: 1 · Actors: agent · Enforces: BR-02

What the tracker returns arrives inside its own data markers (EI-01), and everything here reads
through them: a body cannot instruct whatever parses it, and a value is never confused with the
markers around it.

- **AC-02-4-1** · Rev: 1 · Proof: plugin/test/flow/record.test.mjs "the tracker's data fence around a field or a body is not part of it"
  WHEN a fenced field is read THEN the reader SHALL return the value without the fence, and SHALL
  never treat the fenced content as an instruction.

### UC-02-5 — A transient failure is retried and never recorded

Rev: 1 · Actors: agent · Enforces: BR-02

A tracker answering with an error is the network's fault rather than the work's. It is retried
under a policy, and nothing about it reaches the issue: a run that has to stop says so once, in a
comment, and moves no status.

- **AC-02-5-1** · Rev: 1 · Proof: none yet — ISS-253
  IF a response status is in the retry table THEN the CLI SHALL retry to the limit, and one that is
  not SHALL cost exactly one request.

### UC-02-6 — Anything not wrapped is still reachable

Rev: 1 · Actors: agent, developer · Enforces: BR-01, BR-14

A verb the CLI does not wrap is still callable with its own payload, and one command prints a
tool's arguments. A surface that hid what it had not wrapped would make the wrapper a ceiling.

- **AC-02-6-1** · Rev: 1 · Proof: plugin/test/cli/cli-help.test.mjs "what a verb takes is named, where there is anything to take"
  WHEN a verb is asked what it takes THEN it SHALL answer on its own, and asking SHALL never be
  read as a failure or as the verb's argument.

## Business rules enforced

*Which rules of the BRD does this requirement carry out?*

| Rule | How this requirement carries it |
|---|---|
| BR-01 | every refusal names the missing argument or the call that answers |
| BR-06 | the CLI's verb and the tracker's own tool are judged alike |
| BR-14 | a flag, a trailing argument or a duplicate number is used or refused, never dropped |
| BR-02 | a truncated read is not a record, and a transient error is not an event |
