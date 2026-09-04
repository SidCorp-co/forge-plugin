# SRS §11 — FR-09 — The learning gates

Rev: 1 · Actors: agent · Enforces: BR-01, BR-09, BR-13 · Source: plugin/hooks/how/learning-gate.md

← [Index](./README.md) · [§10 FR-08 Irreversible commands](./fr-08-irreversible-commands.md) · Next: [§12 FR-10 Comments read before a write](./fr-10-read-before-write.md)

## Purpose

*Why does this requirement exist?*

The habit these answer, and what it costs, are in `plugin/hooks/how/learning-gate.md`. What this
requirement adds is that two writes which look alike are not: one adds a fact about a project, the
other changes the method. Each is worth one stop, and the two stops ask different questions.

The same reasoning covers a checker that hard-codes the cases it could derive: a hand-written list
is silent on the case it never met and fails on a correct change — measured, when a list copied out
of a switch broke on an addition that kept both halves consistent (BR-13).

## Actors

*Who acts here?*

- **The agent**, which is stopped once before such a write and answers the stop's own question.

## Use cases

*What is stopped, what clears it, and what is answered late?*

### UC-09-1 — One stop before a note about the project

Rev: 1 · Actors: agent · Enforces: BR-01

The stop prints the conditions that make a note worth keeping, and the way through it is to apply
them and say which one holds. It asks once per file per session. It does not judge whether the
fact is true or useful — only that the write was decided on rather than performed.

- **AC-09-1-1** · Rev: 1 · Proof: plugin/test/gates/learning-gate.test.mjs "every memory write is stopped once, well-formed or not"
  WHEN such a write is about to happen THEN the gate SHALL refuse it once and SHALL print the
  conditions the answer has to meet.
- **AC-09-1-2** · Rev: 1 · Proof: plugin/test/gates/learning-gate.test.mjs "a redirect aimed at a guarded file is refused, appended or truncated"
  IF the write arrives by a route that carries no content to read THEN the gate SHALL refuse it,
  since the decision has to happen before the write.
- **AC-09-1-3** · Rev: 1 · Proof: plugin/test/gates/learning-gate.test.mjs "reading a memory is free"
  WHEN a path is only read, or named inside a string, THEN the gate SHALL allow the command.

### UC-09-2 — A different stop before a skill's own text

Rev: 1 · Actors: agent · Enforces: BR-01, BR-09

A skill edit is asked something else, and AC-09-2-1 names the three. A sentence the skill already
says is refused outright, because that is a second copy of a rule inside the document that owns
it.

- **AC-09-2-1** · Rev: 1 · Proof: plugin/test/gates/learning-gate.test.mjs "the refusal names the categories and does not reprint the test"
  WHEN a skill's text is about to be written THEN the gate SHALL ask for the category, whether a
  check could enforce it, and what it displaces.
- **AC-09-2-2** · Rev: 1 · Proof: plugin/test/gates/learning-gate.test.mjs "a fact already written names the file that has it"
  IF the sentence being added is one the skill already says THEN it SHALL be refused, before the
  once-per-file stamp that would otherwise let it through.

### UC-09-3 — A file that arrived unasked is answered for late

Rev: 1 · Actors: agent · Enforces: BR-13

A gate standing before a write can only match the shapes it knows, so this one reads the disk
after the call instead: a guarded file changed in the last breath is asked about even where no
shape saw it coming. Nothing here undoes the write, and `plugin/hooks/how/learning-landed.md` says
why asking late is still worth it.

- **AC-09-3-1** · Rev: 1 · Proof: plugin/test/gates/learning-landed.test.mjs "a memory file that arrived by no route a check reads is caught after the fact"
  WHEN a guarded file has just changed and no stop asked about it THEN the gate SHALL ask which
  condition it meets.
- **AC-09-3-2** · Rev: 1 · Proof: plugin/test/gates/learning-landed.test.mjs "a write the gate asked about before it landed is not asked about after"
  IF a write already passed the stop before it THEN the file SHALL not be asked about again.
- **AC-09-3-3** · Rev: 1 · Proof: plugin/test/gates/learning-landed.test.mjs "a tracked skill file the tree agrees with was not written here"
  IF a tracked file matches what the tree already holds THEN it SHALL be read as restamped rather
  than written, so restoring a file is not answered for.

### UC-09-4 — A checker that types out what it could derive

Rev: 1 · Actors: agent · Enforces: BR-13

One nudge, once per file, when a check hard-codes cases it could read from the enumeration, the
switch or the declared type. Where enumerating *is* the point, saying so beside the list silences
it. It blocks rather than refuses, so nothing is lost to it.

- **AC-09-4-1** · Rev: 1 · Proof: plugin/test/gates/derive-dont-list.test.mjs "a checker hard-coding what it could derive is asked once, and told where to look"
  WHEN a checker hard-codes a list of cases THEN the gate SHALL ask once, naming the file, the
  values it found, and the instruction to derive them from the source.
- **AC-09-4-2** · Rev: 1 · Proof: plugin/test/gates/derive-dont-list.test.mjs "a comment above the list is the answer, so it is not asked again"
  IF a note above the list says enumerating is the point THEN the gate SHALL not ask.
- **AC-09-4-3** · Rev: 1 · Proof: plugin/test/gates/derive-dont-list.test.mjs "a file that checks nothing keeps its own lists"
  WHERE a file checks nothing, or is a test's own table of cases, the gate SHALL leave its lists
  alone.

## Business rules enforced

*Which rules of the BRD does this requirement carry out?*

| Rule | How this requirement carries it |
|---|---|
| BR-01 | each stop prints the test its answer has to meet, and asks once |
| BR-09 | a sentence a skill already holds is refused rather than duplicated |
| BR-13 | the nudge exists because a hand-written case list was measured failing a correct change |
