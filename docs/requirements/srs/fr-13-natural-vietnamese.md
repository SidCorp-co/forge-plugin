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

BR-16 governs the rest: no clause here promises that the Vietnamese is good, and a change to a
prompt or a style contract is answered for by a person reading the output.

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

- **AC-13-2-1** · Rev: 1 · Proof: plugin/test/vi/vi-gateway.test.mjs "a key reaches the results only where its translation carries the source's placeholders and no others"
  WHEN a segment is translated THEN every placeholder in the source SHALL be present in the result,
  and none SHALL be invented.
- **AC-13-2-2** · Rev: 1 · Proof: tools/diff-python.mjs
  WHEN a catalog is written back THEN its key order SHALL be preserved.

### UC-13-3 — The output is judged by reading it

Rev: 1 · Actors: developer · Enforces: BR-16

Nothing here proves the Vietnamese is good. The goldens hold what the route produced for known
input, so a change to a prompt or an effort level shows up as a diff a person reads — the diff is
the evidence, and the person is the judge.

- **AC-13-3-1** · Rev: 1 · Proof: tools/diff-python.mjs
  WHEN the route's output for the known inputs changes THEN the check SHALL show the difference
  rather than pass or fail on it.

### UC-13-4 — A rewrite that drops a stated contrast or negation is refused

Rev: 1 · Actors: agent · Enforces: BR-14

A rewrite can stay fluent and structurally valid while dropping the one construct that decides what
a sentence claims: a contrast between two readings, or a negation. Neither the placeholder check
(UC-13-2) nor a markdown structure check reads for that, so this route reaches it by name.

- **AC-13-4-1** · Rev: 1 · Proof: plugin/test/vi/drift.test.mjs "vi-natural doc leaves a dropped-contrast block in English and exits 2"
  WHEN a translated block's source states a contrast between two readings and the candidate carries
  none of that contrast's Vietnamese counterparts THEN the route SHALL leave the block untranslated
  and SHALL report it.
- **AC-13-4-2** · Rev: 1 · Proof: plugin/test/vi/drift.test.mjs "vi-natural doc leaves a dropped-negation block in English and exits 2"
  WHEN a translated block's source negates a claim and the candidate carries no Vietnamese negation
  THEN the route SHALL leave the block untranslated and SHALL report it.
- **AC-13-4-3** · Rev: 1 · Proof: plugin/test/vi/drift.test.mjs "vi-natural doc keeps a Vietnamese block whose rewrite drops a negation as it was sent and exits 2"
  WHEN a block's source is already Vietnamese and the candidate carries fewer Vietnamese negation and
  contrast markers, taken together and with a word stating an absence counted as one, than the source
  holds outside the constructions a faithful rewrite may fold away THEN the route SHALL leave the
  block as it was sent and SHALL report it.

### UC-13-5 — A bare name crosses the rewrite whole

Rev: 1 · Actors: agent · Enforces: BR-14

A name the author did not quote carries nothing telling the model it is one, and a run id that lost
its last letter reads as fluently as the one that was sent. So a bare name is held out of the
model's reach the way an inline code span is, and accounted for on the way back as a placeholder is
(UC-13-2). What reads as a name is a shape rather than a list: letters and digits in one token that
is not an ordinal, an underscore between words, or camelCase.

- **AC-13-5-1** · Rev: 1 · Proof: plugin/test/vi/bare-names.test.mjs "a bare run id, issue key and sha in a body are stored byte for byte"
  WHEN a document block holds a bare name THEN the route SHALL keep that name out of what the model
  is sent and SHALL write it back byte for byte.
- **AC-13-5-2** · Rev: 1 · Proof: plugin/test/vi/bare-names.test.mjs "a title's bare names and code spans are stored byte for byte"
  WHEN a string is translated as a document THEN its bare names and its code spans SHALL be held as
  a document block's are.
- **AC-13-5-3** · Rev: 1 · Proof: plugin/test/vi/bare-names.test.mjs "a rewrite that loses a held name is refused and nothing is posted"
  IF a translation loses a held name THEN the route SHALL leave the text untranslated and SHALL
  report why.
- **AC-13-5-4** · Rev: 2 · Proof: plugin/test/vi/bare-names.test.mjs "words, hyphenated words, ordinals and a list's own numbers still reach the rewrite as prose"
  WHERE a token is a word, a hyphenated word, an ordinal or the number opening a list item the route
  SHALL send it to the model as prose.

### UC-13-6 — A figure crosses the rewrite as it was written

Rev: 1 · Actors: agent · Enforces: BR-14

A rewrite decides the wording, never what a number says. A model localising a figure swaps its
separators, so a total the source wrote as twelve point three came back reading twelve thousand, and
it can turn a pronoun into a numeral the source never stated. Both read fluently. So a figure in a
document is held out of the model's reach as a bare name is (UC-13-5), and a rewrite carrying a
figure its source does not is refused. A user interface string is localisation and keeps its own
conventions.

- **AC-13-6-1** · Rev: 1 · Proof: plugin/test/vi/figures.test.mjs "a figure in a body is stored spelled as it was sent, and never reaches the model"
  WHEN a document block holds a figure THEN the route SHALL keep that figure out of what the model
  is sent and SHALL write it back byte for byte.
- **AC-13-6-2** · Rev: 1 · Proof: plugin/test/vi/figures.test.mjs "a figure in a title is stored spelled as it was sent, and never reaches the model"
  WHEN a string is translated as a document THEN its figures SHALL be held as a document block's
  are.
- **AC-13-6-3** · Rev: 1 · Proof: plugin/test/vi/figures.test.mjs "a tracker write whose rewrite adds a figure posts nothing and names the figure"
  IF a document's translation carries a figure its source does not THEN the route SHALL leave the
  text untranslated and SHALL name the figure.
- **AC-13-6-4** · Rev: 1 · Proof: plugin/test/vi/figures.test.mjs "translate --kind prose refuses a translation that respells or adds a figure, naming it"
  IF a prose string's translation carries a figure its source does not THEN the route SHALL refuse
  it and SHALL name the figure.
- **AC-13-6-5** · Rev: 1 · Proof: plugin/test/vi/figures.test.mjs "a ui string and a locale file are judged as they were before"
  WHERE a string is user interface text the route SHALL leave its figures to the model.

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
| BR-14 | a lost or invented placeholder is refused rather than shipped, and so is an invented figure |
| BR-16 | the goldens make a prompt change visible, and a person judges it |
