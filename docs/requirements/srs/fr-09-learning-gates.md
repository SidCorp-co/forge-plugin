# SRS §11 — FR-09 — The learning gates

Rev: 2 · Actors: agent · Enforces: BR-01, BR-09, BR-13 · Source: plugin/hooks/how/learning-gate.md

← [Index](./README.md) · [§10 FR-08 Irreversible commands](./fr-08-irreversible-commands.md) · Next: [§12 FR-10 Comments read before a write](./fr-10-read-before-write.md)

## Purpose

*Why does this requirement exist?*

The habit these answer, and what it costs, are in `plugin/hooks/how/learning-gate.md`. What this
requirement adds is that two writes which look alike are not: one adds a fact about a project, the
other changes the method. Each is worth one question, asked once beside the write rather than
holding it, since whether a note is worth keeping is the agent's to decide; the two ask different
things.

The same reasoning covers a checker that hard-codes the cases it could derive: a hand-written list
is silent on the case it never met and fails on a correct change — measured, when a list copied out
of a switch broke on an addition that kept both halves consistent (BR-13).

## Actors

*Who acts here?*

- **The agent**, which is told once at such a write and answers the question it is told.

## Use cases

*What is asked, what answers it, and what is answered late?*

### UC-09-1 — One question at a note about the project

Rev: 2 · Actors: agent · Enforces: BR-01

The write goes ahead, and the session is told the conditions that make a note worth keeping and
asked to say which one holds, or to remove it. It asks once per file and content per session. It
does not judge whether the fact is true or useful — only that the write was decided on rather than
performed.

- **AC-09-1-1** · Rev: 2 · Proof: plugin/test/gates/learning/learning-gate.test.mjs "every memory write is taught once, well-formed or not"
  WHEN such a write is about to happen THEN the gate SHALL let it through, SHALL say once beside it
  the conditions the answer has to meet, and SHALL NOT decide a permission.
- **AC-09-1-2** · Rev: 2 · Proof: plugin/test/gates/learning/learning-gate.test.mjs "a redirect aimed at a guarded file is taught, appended or truncated"
  IF the write arrives by a route that carries no content to read THEN the gate SHALL let it through
  and SHALL say what it owes beside it, stamped so the post-call gate does not ask again.
- **AC-09-1-3** · Rev: 1 · Proof: plugin/test/gates/learning/learning-gate.test.mjs "reading a memory is free"
  WHEN a path is only read, or named inside a string, THEN the gate SHALL allow the command.

### UC-09-2 — A different question at a skill's own text

Rev: 2 · Actors: agent · Enforces: BR-01, BR-09

A skill edit is asked something else, and AC-09-2-1 names the three. A sentence the skill already
says is named with the line that already says it, because that is a second copy of a rule inside
the document that owns it, and the session is told to keep it in one place.

- **AC-09-2-1** · Rev: 2 · Proof: plugin/test/gates/learning/learning-gate.test.mjs "the teaching names the categories and does not reprint the test"
  WHEN a skill's text is about to be written THEN the gate SHALL let it through and SHALL ask beside
  it for the category, whether a check could enforce it, and what it displaces.
- **AC-09-2-2** · Rev: 2 · Proof: plugin/test/gates/learning/learning-gate.test.mjs "a fact already written names the file that has it"
  IF the sentence being added is one already written THEN the gate SHALL name the file that has it,
  before the once-per-file stamp that would otherwise say nothing.

### UC-09-3 — A file that arrived unasked is answered for late

Rev: 2 · Actors: agent · Enforces: BR-13

A gate standing before a write can only match the shapes it knows, so this one reads the disk
after the call instead: a guarded file changed in the last breath is asked about, as context and
never as a block, even where no shape saw it coming. Nothing here undoes the write, and `plugin/hooks/how/learning-landed.md` says
why asking late is still worth it.

- **AC-09-3-1** · Rev: 1 · Proof: plugin/test/gates/learning/learning-landed.test.mjs "a memory file that arrived by no route a check reads is caught after the fact"
  WHEN a guarded file has just changed and no stop asked about it THEN the gate SHALL ask which
  condition it meets.
- **AC-09-3-2** · Rev: 1 · Proof: plugin/test/gates/learning/learning-landed.test.mjs "a write the gate asked about before it landed is not asked about after"
  IF a write already passed the stop before it THEN the file SHALL not be asked about again.
- **AC-09-3-3** · Rev: 1 · Proof: plugin/test/gates/learning/learning-landed.test.mjs "a tracked skill is the tree's shipped product, so neither a restamp nor a change is asked"
  IF a tracked file matches what the tree already holds THEN it SHALL be read as restamped rather
  than written, so restoring a file is not answered for.
- **AC-09-3-4** · Rev: 1 · Proof: plugin/test/gates/learning/shipped-skill.test.mjs "the gate leaves a shipped skill alone and still stops before a home skill"
  IF a skill is one the project ships — tracked in its source tree, or named by its marketplace —
  THEN the gate SHALL NOT ask about it, since its text is the product and not a learning.

### UC-09-4 — A checker that types out what it could derive

Rev: 2 · Actors: agent · Enforces: BR-13

One nudge, once per file, when a check hard-codes cases it could read from the enumeration, the
switch or the declared type. Where enumerating *is* the point, saying so beside the list silences
it. It is said beside the write rather than holding it, so nothing is lost to it.

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
| BR-01 | each question prints the test its answer has to meet, and asks once |
| BR-09 | a sentence a skill already holds is named, to be kept in one place rather than duplicated |
| BR-13 | the nudge exists because a hand-written case list was measured failing a correct change |
