# SRS §15 — FR-13 — Natural Vietnamese

Rev: 1 · Actors: developer, agent · Enforces: BR-11, BR-14, BR-16 · Coupling: schema · Source: VI-NATURAL.md

← [Index](./README.md) · [§14 FR-12 The documentation gates](./fr-12-documentation-gates.md) · Next: [§16 FR-14 The requirements tree](./fr-14-requirements-tree.md)

## Purpose

*Why does this requirement exist?*

Vietnamese here is the product's own language and the tracker's, and everything a developer reads is
English (BR-11). The prose a user sees is therefore the product, and typing it by hand is the
failure a reviewer who does not read Vietnamese cannot see. So the rule is structural rather than
textual: no source file of this route may hold Vietnamese text at all, and everything the product
may send comes from one generated module.

What comes back from a model is not diffable (BR-16), so a change to a prompt or a style contract
is verified by running it and reading the output. A green tree says the plumbing survived.

## Actors

*Who acts here?*

- **The developer**, who changes the style contract and reads the output to judge it.
- **The agent**, which writes a locale file or a document through this route rather than by hand.

## Use cases

*What is guaranteed about the text, and what is not?*

### UC-13-1 — Product prose lives in one module

Rev: 1 · Actors: developer · Enforces: BR-11

Every Vietnamese string this route can send comes from the generated module, and no other source
file may hold one. Comments are exempt: prose *about* the code is not something a user ever
receives.

- **AC-13-1-1** · Rev: 1 · Proof: tools/check-vi-text.mjs
  IF a source file of this route holds Vietnamese text outside the generated module THEN the check
  SHALL fail, SHALL name the file and line, and SHALL name where the text belongs.
- **AC-13-1-2** · Rev: 1 · Proof: tools/check-vi-text.mjs
  WHERE the text sits in a comment the check SHALL allow it.

### UC-13-2 — A placeholder is accounted for

Rev: 1 · Actors: agent · Enforces: BR-14

A translation that loses a placeholder, or invents one, breaks the caller rather than reading badly.
Every placeholder in the source has to appear in the result, and the order of a catalog's keys is
preserved so a locale file stays diffable against its source.

- **AC-13-2-1** · Rev: 1 · Proof: plugin/test/vi-gateway.test.mjs
  WHEN a segment is translated THEN every placeholder in the source SHALL be present in the result,
  and none SHALL be invented.
- **AC-13-2-2** · Rev: 1 · Proof: plugin/test/vi-gateway.test.mjs
  WHEN a catalog is written back THEN its key order SHALL be preserved.

### UC-13-3 — The output is judged by reading it

Rev: 1 · Actors: developer · Enforces: BR-16

Nothing here proves the Vietnamese is good. The goldens hold what the route produced for known
input, so a change to a prompt or an effort level shows up as a diff a person reads — the diff is
the evidence, and the person is the judge.

- **AC-13-3-1** · Rev: 1 · Proof: tools/diff-python.mjs
  WHEN the route's output for the known inputs changes THEN the check SHALL show the difference
  rather than pass or fail on it.

## The way back

*What undoes a change here?*

The generated module and the goldens are both derived files, and both are regenerated rather than
edited: the way back from a bad regeneration is the previous commit of those two files, which is why
they are committed rather than built at install time. A prompt change that makes the output worse
cannot be detected by any check here (BR-16), so the way back is the diff of the goldens and a
person's reading of it — recorded in the issue that made the change, since nothing else will hold
it.

## Business rules enforced

*Which rules of the BRD does this requirement carry out?*

| Rule | How this requirement carries it |
|---|---|
| BR-11 | the product's language lives in one module, and everything a developer reads is English |
| BR-14 | a lost or invented placeholder is refused rather than shipped |
| BR-16 | the goldens make a prompt change visible, and a person judges it |
