# SRS §17 — Non-functional requirements

← [Index](./README.md) · [§16 FR-14 The requirements tree](./fr-14-requirements-tree.md) · Next: [§18 Data](./18-data.md)

## What holds across every requirement

*Which qualities are not any one capability's?*

Each of these was fixed by a measurement or by a failure, and the reason is beside the clause. A
figure that was measured once is not restated elsewhere.

### NFR-01 — A gate costs the startup of one process per event

Rev: 1 · Enforces: BR-08

The gates share one process per event because a registration per gate paid a language runtime's
startup for each of them on every tool call, with several reading the same session history apart.

- **AC-17-1-1** · Rev: 1 · Proof: plugin/test/gate.test.mjs
  WHEN gates run for one event THEN they SHALL run in one process and SHALL share the reads they all
  need.

### NFR-02 — A gate fails open

Rev: 1 · Enforces: BR-13

A broken switch or an unreadable configuration has to cost a gate firing, never a gate silently
gone. The reverse failure is undetectable: nothing looks more like a clean session than one where
no gate ran.

- **AC-17-2-1** · Rev: 1 · Proof: plugin/test/hook-switch.test.mjs
  IF the switch cannot be read THEN every gate SHALL run.

### NFR-03 — A refusal is small, and its document is capped

Rev: 1 · Enforces: BR-01

A refusal lands in a context window on every tool call, so it carries what was refused, the rule,
one action and where to read more, and nothing else. One gate's message was more than twice its
current size in conditions and categories, and the conditions it kept are the test the agent has to
apply before re-sending.

- **AC-17-3-1** · Rev: 1 · Proof: plugin/test/hook-how.test.mjs
  WHEN a gate's document is written THEN its argument SHALL be within the cap and the document
  within its own, and the rest SHALL be instruction.

### NFR-04 — Help is an answer

Rev: 1 · Enforces: BR-01, BR-14

Asking what to type is not a failure and not an argument: on the error stream a pipe printed
nothing and every caller learned to redirect first, and three verbs resolved project scope before
parsing anything, so the one command that says what to type was the one a caller could not run.

- **AC-17-4-1** · Rev: 1 · Proof: plugin/test/cli-help.test.mjs
  WHEN help is asked for THEN it SHALL be answered on the output stream, before the verb parses
  anything, and SHALL never be read as the verb's own argument.
- **AC-17-4-2** · Rev: 1 · Proof: plugin/test/cli-help.test.mjs
  WHEN the write-time rules are not asked for THEN they SHALL not be printed, since they were paid
  for in every transcript that only asked what to type.

### NFR-05 — A projection carries no byte that says nothing

Rev: 1 · Enforces: BR-14

The identifier column of a browse was a fifth of its bytes and bought nothing; a null field and an
empty collection were a tenth of an issue's bytes and said only that the field exists. Absence
means absence.

- **AC-17-5-1** · Rev: 1 · Proof: plugin/test/commands.test.mjs
  WHEN a record is projected THEN a field with nothing in it SHALL be left out, and an attachment
  SHALL collapse to the reference that fetches it.

### NFR-06 — Nothing about a run is remembered outside the record

Rev: 1 · Enforces: BR-02, BR-05

A run that dies has to be resumable by another, so the tracker holds the process and the pushed
branch holds the code (C-10). A commit is pushed as it is made.

- **AC-17-6-1** · Rev: 1 · Proof: plugin/test/lease.test.mjs
  WHEN a run resumes an issue THEN everything it needs SHALL be readable from the record.

### NFR-07 — A write is idempotent

Rev: 1 · Enforces: BR-02, BR-03

The same content written twice is one record, the latest verdict per criterion wins, and the merged
mark keeps its first stamp — so a retry after a dropped connection is safe and a report does not
double-count.

- **AC-17-7-1** · Rev: 1 · Proof: plugin/test/advance.test.mjs
  WHEN the same payload is written twice THEN the record SHALL hold it once.

### NFR-08 — A credential never reaches a file that travels

Rev: 1 · Enforces: BR-17

The credential lives in the account's directory at owner-only permissions, and anything written to
a log is masked first — a value named as a credential is masked whatever it looks like, because the
shape of a secret is not reliable and the name is.

- **AC-17-8-1** · Rev: 1 · Proof: plugin/test/hook-log.test.mjs
  WHEN a line is logged THEN any credential in it SHALL be masked before the line is written.

### NFR-09 — A project that decided nothing hears nothing

Rev: 1 · Enforces: BR-07

Silence is an opt-out and not a misconfiguration. A repository with no linter, no gate and no
settings of its own gets no findings from this product about what good code is.

- **AC-17-9-1** · Rev: 1 · Proof: plugin/test/code-quality.test.mjs
  IF the project configures nothing THEN the product SHALL say nothing about its code.

### NFR-10 — The half no check reaches is verified by reading it

Rev: 1 · Enforces: BR-16

What a model returns is not diffable, so a change to a prompt, a style contract or an effort level
is verified by running it and reading the output. No clause here promises that an answer is good.

- **AC-17-10-1** · Rev: 1 · Proof: tools/diff-python.mjs
  WHEN the output for a known input changes THEN the change SHALL be shown to a person rather than
  judged by a check.
