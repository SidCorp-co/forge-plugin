# Project discovery — the half `forge project` cannot answer

The workflow is global; everything it needs to act is local. This file says **where to look**, never
what is there.

## A project's file holds rules, not facts

A fact copied into prose has two authorities and no way to notice when they diverge, so the
project's agent file is expected to carry what the code cannot say for itself, invariants, dangers,
conventions, reasons, and to delegate the rest: a script prints its own interface, a checker owns the
shape and the remedy of its rule, environment specifics resolve at runtime. A danger is stated as a
rule with the fact resolved at runtime, not as the fact.

**A project that decided otherwise wins** (Rule 4). If its file holds the command list, use the
command list.

## What each line has to establish

One line per item, carrying where it was read:

- How to build, test and lint, and which of those the project treats as the gate.
- How to run something locally, and whether the project provides that.
- **How a change reaches the default branch, and how it reaches production**: review, gates, merge
  policy, deploy trigger. This is the path Phase 7 follows.
- **The way back from each step of that path**: how a deploy is rolled back, whether the previous
  artefact is reachable, what a rollback does not undo. Established before the step, not looked for
  once something is wrong.
- What is dangerous and fails silently.
- Where credentials and environment settings come from. **Ask rather than assume.** A credential is
  established here and not at Phase 7, where the criteria it was needed for have already gone
  unjudged.
- **The prose language, which is a project setting and not a default.** A project whose config
  declares one gets its prose translated on the way out; one that declares none gets plain English
  and no translation step. Read the config; never infer the language from the code, the repository
  name or who is asking.

## Where to look

1. **The tracker's knowledge store.** `forge knowledge search "<the issue's title>"`, then
   `forge knowledge get <slug>` on a hit. An entry is a lead to check against the source it cites,
   never a fact to quote, and one the run finds wrong is corrected with `forge knowledge write`.
2. **`CLAUDE.md` at the repository root**, then the nested ones nearer the files you touch. A
   one-line file that imports another (`@AGENTS.md`) is a pointer; follow it.
3. **What the root file points at**: a README, an architecture note, a spec directory.
4. **The code, the tiebreaker for mechanics.** A container entrypoint and a stack script each settle
   what runs at boot and what the wrapper overrides on the way in.

**Code decides what the system currently does, not what it should do**; an approved specification, a
tracker decision or a product rule decides that. When sources disagree, name the disagreement.

## When the root file is missing

Say so. Offer to write one from what Phase 0 found; it is repository policy, so it lands by proposal.
Keep it short: an invariant whose violation is a defect regardless of tests, a danger whose failure
mode is silent, a reason a reader cannot recover from the code beside it. Not a restatement of what
a checker already refuses.
