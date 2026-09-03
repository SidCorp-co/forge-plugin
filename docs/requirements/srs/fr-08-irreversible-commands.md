# SRS §10 — FR-08 — Irreversible commands

Rev: 1 · Actors: agent · Enforces: BR-01, BR-07, BR-15 · Source: plugin/hooks/how/bash-guard.md

← [Index](./README.md) · [§9 FR-07 The gate harness](./fr-07-gate-harness.md) · Next: [§11 FR-09 The learning gates](./fr-09-learning-gates.md)

## Purpose

*Why does this requirement exist?*

Some shell commands take something with nothing behind it: a process that has been running for
days, changes never committed, a checkout somebody else is using. The loss is not detectable and
not undoable, which is exactly the test BR-15 sets for stopping. So those shapes are refused before
they run, and the refusal names the safer form — because rewording a command until the pattern
misses teaches that the guard is noise.

It refuses a *shape* and never a style, and it judges the tree the command names rather than the
one the shell happens to be in (BR-07).

## Actors

*Who acts here?*

- **The agent**, whose command is refused and who rewrites it or puts the refusal to the user.

## Use cases

*Which commands are refused, and how is a command read?*

### UC-08-1 — Refuse a shape that cannot be undone

Rev: 1 · Actors: agent · Enforces: BR-01, BR-15

A refusal the agent believes is wrong goes to the user rather than into another attempt at the
same command, and the gate's own document says what the message owes.

- **AC-08-1-1** · Rev: 1 · Proof: plugin/test/gates/bash-guard.test.mjs
  WHEN a refused shape is about to run THEN the gate SHALL refuse the command and SHALL name the
  rule and one way out.
- **AC-08-1-2** · Rev: 1 · Proof: plugin/test/gates/bash-guard.test.mjs
  IF a command answers a checker instead of the code THEN the gate SHALL refuse it, since it takes
  work and leaves the finding.
- **AC-08-1-3** · Rev: 1 · Proof: plugin/test/gates/bash-guard.test.mjs
  WHEN a command reads the state a refused command would destroy THEN the gate SHALL allow it,
  because looking is not losing.

### UC-08-2 — A command is read where a command starts

Rev: 1 · Actors: agent · Enforces: BR-07

A rule applies at a command's start, so a phrase inside an argument is prose. Which readings that
commits the gate to — quoting, wrappers, and a body handed to another interpreter — is the gate's
own document; the duty here is that the reading is of command position and never of text.

- **AC-08-2-1** · Rev: 1 · Proof: plugin/test/gates/bash-guard.test.mjs
  IF a refused phrase appears only inside an argument or a program's own string THEN the gate SHALL
  read it as prose and SHALL allow the command.
- **AC-08-2-2** · Rev: 1 · Proof: plugin/test/gates/bash-guard.test.mjs
  WHEN a flag is quoted THEN the gate SHALL still read it as the flag.
- **AC-08-2-3** · Rev: 1 · Proof: plugin/test/gates/bash-guard.test.mjs
  WHEN a command names another tree THEN the gate SHALL judge that tree, and SHALL read the tree's
  own options the way the tool reads them.
- **AC-08-2-4** · Rev: 1 · Proof: plugin/test/gates/bash-guard.test.mjs
  WHERE a bound narrows a sweeping argument the gate SHALL allow it, since the bound is what makes
  the loss recoverable.

## Business rules enforced

*Which rules of the BRD does this requirement carry out?*

| Rule | How this requirement carries it |
|---|---|
| BR-01 | the refusal names the cause and the safer form, never a rephrasing |
| BR-07 | a shape is refused and a style is not, and the tree judged is the one the command names |
| BR-15 | the list is exactly the shapes whose loss cannot be detected and undone |
