# Project discovery

The workflow is global; everything it needs to act is local. This file is the contract for
acquiring the local knowledge — it names **where to look**, never what is there.

## A design choice: the project file holds rules, not facts

The instinct is to write a project's ports, ids, deploy targets and build commands into its
agent file. This skill takes the opposite position, and states it as a choice rather than a
law: **a fact copied into prose has two authorities and no way to notice when they
diverge.** A port typed from memory drives the wrong stack; a transcribed command list
survives the rename that broke it.

So the file is expected to carry what the code cannot say for itself — invariants, dangers,
conventions, reasons — and to delegate the rest:

- **A script that prints its own interface is the first source for it.** Read the source
  when the help is missing, incomplete, or when the side effects matter more than the
  arguments.
- **Where a checker enforces a rule, the checker owns the shape, the limit and the
  remedy**, and its message is the documentation. A project file may state the invariant
  behind it in one line.
- **Environment specifics resolve at runtime.** This binds what you write in a plan or a
  report exactly as it binds code.

A danger is still stated, but as a rule with the fact resolved at runtime: not "the
database is on port N", but "every dev process goes through the stack script, and here is
what happens if it does not."

**A project that decided otherwise wins** — Rule 4. If its file holds the command list, use
the command list.

## What to establish before working an issue

This list is also the brief's line set: a project's brief answers these one line at a time, each
with where it was read, so the second run reads what the first established. A run that had to
establish one of them by hand refreshes that line before it leaves.

- How to build, test and lint, and which of those the project treats as the gate.
- How to run something locally, and whether the project provides that or expects you to.
- **How a change reaches the default branch, and how it reaches production.** Review,
  gates, merge policy, deploy trigger, and who may pull it. This is the path Phase 7
  follows, and assuming another project's is how a workflow ships to the wrong place.
- **The way back from each step of that path** — how a deploy is rolled back, whether the
  previous artefact is still reachable, what a rollback does not undo. A pipeline that ships
  without asking is trading a human check for a known recovery, so the recovery has to be
  established first, not looked for once something is wrong.
- What is dangerous and fails silently.
- Where credentials and environment settings come from — a secret manager, injected
  environment, the tracker, an operator. **Ask rather than assume**; a wrong guess here is
  a leak or a broken run.
- **The prose language, which is a project setting and not a default.** A project whose
  config declares one gets its prose translated on the way out and its terminology pinned by
  the config; a project that declares none gets plain English and **no translation step at
  all**. Read the config — never infer the language from the code, the repository name or
  who is asking.

## Order of lookup

**1. `forge project`.** The branch a change lands on, whether production deploys unasked, the
staging hosts a change can be walked against and whether test credentials exist —
`--credentials` for their values. Under those, the project's **brief**: one line per item in
the list above, each carrying where it was read, written by an earlier run and read by this
one. Ask it before searching the repository, and ask it *here*: a credential discovered at
Phase 7 arrives after the criteria it was needed for have already gone unjudged.

**Two things the brief hands back to you, and only those two.** A line reading *not stated*
is a question this project has not answered, so establish it from 2 to 5 below and refresh the
brief on the way out. A `stale:` line names a file the brief was read from that has moved
since — read the lines citing that file, and nothing else. Where there is no brief at all, the
whole of this file is the phase, and writing one is what the run leaves behind.

**2. The rest of the tracker.** Its knowledge store, searched with the issue's own title:
whatever an earlier reading established about the module this issue touches, kept somewhere
later sessions can reach it rather than sealed inside a closed issue. And its memory, which is
accumulated findings and point-in-time. Both are leads to check against the source they cite,
and neither is a fact to quote.

**3. `CLAUDE.md` at the repository root**, then the nested ones nearer the files you are
touching. The root file holds what is true everywhere; a directory's file holds what is
true only there. A one-line file that imports another (`@AGENTS.md`) is a pointer, not an
absence — follow it.

**4. What the root file points at** — a README, an architecture note, a spec directory. The
rules file names the contract; the mechanics file holds the layout and the stack.

**5. The code, which is the tiebreaker for mechanics.** A container entrypoint and a stack
script each settle a question that prose about them gets wrong — what runs at boot, and what
the wrapper overrides on the way in.

**Code decides what the system currently does. It does not decide what it should do** — an
approved specification, a tracker decision or a product rule does. In an issue workflow the
code is frequently the thing that is wrong. When sources disagree, name the disagreement
rather than declaring one universally right.

## When the root file is missing

Say so; do not silently substitute guesses. Offer to write one from what Phase 0 found. It
is repository policy, so it lands by proposal.

Keep a first one short. What earns a line: an invariant whose violation is a defect
regardless of tests passing, a danger whose failure mode is silent, a reason a reader
cannot recover from the code beside it. What does not: a restatement of something a checker
already refuses.

Feeding a learning back is Rule 5 — `references/learning.md`.
