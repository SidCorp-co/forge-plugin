# SRS §14 — FR-12 — The documentation gates

Rev: 1 · Actors: agent, developer · Enforces: BR-09, BR-13, BR-12 · Source: CLAUDE.md

← [Index](./README.md) · [§13 FR-11 The project's own code rules](./fr-11-project-code-rules.md) · Next: [§15 FR-13 Natural Vietnamese](./fr-13-natural-vietnamese.md)

## Purpose

*Why does this requirement exist?*

Documents rot without failing anything. A command a document tells a reader to run gets renamed; a
path a skill names stops existing; a rule stated in prose gains a checker underneath it and the
prose becomes a second copy nobody corrects. Each of those has been measured here: one gate
document drifted three ways in a day while every other check stayed green, and one skill cited a
script for months against a tree that had no such file.

So the documents are checked like code. Every gate in this requirement fails on a document, and
each exists because the failure it catches happened.

## Actors

*Who acts here?*

- **The agent**, whose document is refused by a check it can run before committing.
- **The developer**, who reads the failure and fixes the document or the code it lied about.

## Use cases

*What is checked about a document?*

### UC-12-1 — Every command a document names is one the CLI has

Rev: 1 · Actors: agent · Enforces: BR-09, BR-13

The CLI's own tables are the authority, so a verb or a flag renamed there fails here. A flag is held
to a word boundary, because a truncation reads exactly like a flag that works and truncation is how
a flag drifts. A verb whose flags belong to its sub-verbs is exempt from the flag half, since its
own usage line cannot name them and holding it there would fail on every true document. A document
specifying something not yet built declares that on its first line and may then name only the verbs
it declares.

- **AC-12-1-1** · Rev: 1 · Proof: plugin/test/doc-claims.test.mjs
  WHEN a document names a command in a code span THEN the check SHALL hold the verb against the
  CLI's own verb table, and SHALL hold a flag against the verb's own usage line only where that
  verb carries its flags itself rather than under a sub-verb.
- **AC-12-1-2** · Rev: 1 · Proof: plugin/test/doc-claims.test.mjs
  IF a document opens by declaring itself a proposal for named verbs THEN those verbs SHALL be
  allowed and no others the CLI lacks.
- **AC-12-1-3** · Rev: 1 · Proof: plugin/test/doc-claims.test.mjs
  IF a document names a switch the code reads nowhere THEN the check SHALL fail.
- **AC-12-1-4** · Rev: 1 · Proof: plugin/test/doc-claims.test.mjs
  WHILE the check runs it SHALL count the claims it found and SHALL fail when the count says its
  own pattern matched nothing.

### UC-12-2 — No document restates what has a home elsewhere

Rev: 1 · Actors: agent · Enforces: BR-09

A document saying what a help text, a skill or the repository's rules file already says is a home
nobody updates. The measure is a sentence overlap against every place a fact may already live, at a
threshold calibrated on real documents rather than guessed.

- **AC-12-2-1** · Rev: 1 · Proof: plugin/test/docs-have-one-home.test.mjs
  IF a document's sentence overlaps a skill, a gate document or the rules file past the threshold
  THEN the check SHALL fail and SHALL print both sentences and where the other one lives.
- **AC-12-2-2** · Rev: 1 · Proof: plugin/test/docs-have-one-home.test.mjs
  IF a document explains code THEN the check SHALL fail, since mechanics belong to the help text and
  to the source.
- **AC-12-2-3** · Rev: 1 · Proof: plugin/test/docs-have-one-home.test.mjs
  WHILE the check runs it SHALL assert that its own selector matched documents, because a selector
  matching nothing looks exactly like a clean repository.
- **AC-12-2-4** · Rev: 1 · Proof: none yet — ISS-27
  WHERE a document lives below the documents directory rather than in it the same check SHALL reach
  it.

### UC-12-3 — A skill stays method

Rev: 1 · Actors: agent · Enforces: BR-09

A path inside a skill is a claim about a checkout that skill will never see, and it rots without
failing anything — one such citation stood for months against a tree that held no such file. Two
skills whose descriptions cover the same ground are one skill under two names; why the measure is
taken over the descriptions rather than left to a reviewer's reading is in
`plugin/scripts/skill-boundaries.mjs`'s own help.

- **AC-12-3-1** · Rev: 1 · Proof: plugin/scripts/skill-paths.mjs
  IF a skill's own text names a repository path THEN the check SHALL fail and SHALL name the skill
  and the path.
- **AC-12-3-2** · Rev: 1 · Proof: plugin/scripts/skill-boundaries.mjs
  IF two skill descriptions overlap past the measure THEN the check SHALL fail and SHALL ask for a
  boundary.
- **AC-12-3-3** · Rev: 1 · Proof: plugin/scripts/skill-boundaries.mjs
  IF a skill names a skill that is not installed THEN the check SHALL fail, since the instruction is
  dead.
- **AC-12-3-4** · Rev: 1 · Proof: plugin/scripts/skill-dup.mjs
  IF the same prose appears twice in one tree THEN the check SHALL report it, and a waiver SHALL
  require a reason to be accepted.

### UC-12-4 — A source file is text a reader can see

Rev: 1 · Actors: agent · Enforces: BR-13

A character no one can see is not a character anyone chose. One reached a source file here: the file
ran, the suite passed, the diff reported binary content and a search matched nothing in it.

- **AC-12-4-1** · Rev: 1 · Proof: plugin/test/sources-are-text.test.mjs
  IF a tracked source holds a control character a text file has no use for THEN the check SHALL fail
  and SHALL name the file.

### UC-12-5 — A change is shown the readers a search would miss

Rev: 1 · Actors: agent · Enforces: BR-13

A reader that mentions nothing the change renamed is invisible to a search of the diff. So the files
a change can reach are listed and ranked, with a cutoff that scales with the tree and a floor for a
small one.

- **AC-12-5-1** · Rev: 1 · Proof: plugin/test/blast-radius.test.mjs
  WHEN a change is examined THEN the check SHALL list the files that can reach it and SHALL not
  report the changed file as its own reader.
- **AC-12-5-2** · Rev: 1 · Proof: plugin/test/blast-radius.test.mjs
  WHEN an identifier is deleted THEN it SHALL still count, because a reader elsewhere may expect it.

## Business rules enforced

*Which rules of the BRD does this requirement carry out?*

| Rule | How this requirement carries it |
|---|---|
| BR-09 | every check here exists to keep one fact in one home |
| BR-12 | a document that lied is fixed at the source, and so is the code it lied about |
| BR-13 | each check asserts that its own selector matched something |
