# SRS §13 — FR-11 — The project's own code rules

Rev: 1 · Actors: project, agent · Enforces: BR-07, BR-09, BR-10, BR-12 · Source: plugin/hooks/how/code-quality.md

← [Index](./README.md) · [§12 FR-10 Comments read before a write](./fr-10-read-before-write.md) · Next: [§14 FR-12 The documentation gates](./fr-12-documentation-gates.md)

## Purpose

*Why does this requirement exist?*

The division this requirement sits on has one home, `docs/two-levels.md`,
and what falls to the project here is concrete: its linter, its configuration, its thresholds. So
the code files a call wrote —
by whichever route, and up to the cap UC-11-1 states — are handed to the linter the project itself
configured, and a project with no linter is answered with silence, which is an opt-out rather than a
misconfiguration.

The same division decides where a claim is checked. A project's own rules file loads into every
session, so a dead path in it is read as fact, and nothing fails loudly; it is therefore checked at
the write, and only for the claims that write introduces.

## Actors

*Who acts here?*

- **The project**, whose configuration decides every finding.
- **The agent**, which fixes what a finding names, at the source.

## Use cases

*What is linted, and which claims are refused?*

### UC-11-1 — A written code file reaches the project's linter

Rev: 1 · Actors: project, agent · Enforces: BR-07

The files a call wrote are found rather than assumed, including the ones written through a shell,
and they are handed to the project's own linting entry point, which resolves the workspace, the
binary and the configuration; which copy of that entry point answers is `README.md`'s.
Linting is the slowest thing a post-call gate does and the whole line shares one
deadline, so the number of files one call can carry is capped — which is why the cap is a clause
here rather than an implementation detail.

- **AC-11-1-1** · Rev: 1 · Proof: plugin/test/gates/code-quality.test.mjs "a finding is refused in the delegate's protocol and written to the log like every other"
  WHEN a call writes code files THEN the gate SHALL hand them to the project's own linter, up to the
  cap the event's deadline imposes.
- **AC-11-1-5** · Rev: 1 · Proof: plugin/test/gates/code-quality.test.mjs "a call writing more code files than the cap is told which went unlinted, and a call inside it hears nothing"
  IF a call wrote more files than that cap THEN the gate SHALL name the files it did not lint.
- **AC-11-1-2** · Rev: 1 · Proof: plugin/test/gates/code-quality.test.mjs "a project that configured no linter hears nothing, and the same file speaks once it configures one"
  IF the project configures no linter THEN the gate SHALL say nothing.
- **AC-11-1-3** · Rev: 1 · Proof: plugin/test/gates/code-quality.test.mjs "a finding is refused in the delegate's protocol and written to the log like every other"
  WHEN a file has already been reported at its current content THEN naming it again SHALL not be
  answered twice.
- **AC-11-1-4** · Rev: 1 · Proof: plugin/test/gates/code-quality.test.mjs "a finding is refused in the delegate's protocol and written to the log like every other"
  WHEN a finding is reported THEN the report SHALL name the rules that fired, and a clean file SHALL
  produce nothing.
- **AC-11-1-6** · Rev: 1 · Proof: none yet — ISS-2123
  WHERE a line is the waiver one rule asks for, the density rule SHALL not count that line as a
  comment.

### UC-11-2 — A rules file's claims about its own repository

Rev: 1 · Actors: agent · Enforces: BR-12

Every kind of claim is settled by running something rather than by an opinion — the kinds
themselves, and what counts as a claim at all, are listed in the gate's own document. The duty here
is that the file a claim names is the authority over the claim.

- **AC-11-2-1** · Rev: 1 · Proof: plugin/test/gates/claude-md-hook.test.mjs "a claim the write introduces is refused, named, with one move and where the argument is"
  IF a write introduces a claim the repository does not bear out THEN the gate SHALL refuse the
  write, SHALL name the claim, and SHALL name one move that clears it.
- **AC-11-2-2** · Rev: 1 · Proof: plugin/test/gates/claude-md-hook.test.mjs "a claim already broken in the committed file is not this write's doing"
  IF the claim is already broken in the committed file THEN this write SHALL not be refused for it,
  so the edit that fixes an inherited file lands.
- **AC-11-2-3** · Rev: 1 · Proof: plugin/test/checks/claude-md/claims.test.mjs "a rule a checker declares is reported where CLAUDE.md explains it"
  WHERE a rule is already enforced by a checker the report SHALL raise it where a person is reading
  rather than refusing the write.
- **AC-11-2-4** · Rev: 1 · Proof: plugin/test/gates/claude-md-hook.test.mjs "a project's own guides and every other file are its business"
  WHERE a file belongs to the project rather than to this product the gate SHALL leave it to the
  project.

### UC-11-3 — The vendored copy is a copy on purpose

Rev: 1 · Actors: agent · Enforces: BR-10

A plugin directory travels alone and cannot import a sibling package (C-02), so the shared script
is vendored into it. Because a copy is a copy, drift between it and its source is a gate rather
than a habit, and it compares the code rather than a version — a source that is not there fails as
a broken tree, not as an absent checkout.

- **AC-11-3-1** · Rev: 1 · Proof: plugin/scripts/check-vendor.mjs
  WHEN the vendored copy and its source differ THEN the check SHALL fail and SHALL name what
  differs.
- **AC-11-3-2** · Rev: 1 · Proof: plugin/scripts/check-vendor.mjs
  IF the source is absent THEN the check SHALL fail as a broken tree.

### UC-11-4 — A sentence a module composes is pinned in one test file

Rev: 1 · Actors: agent · Enforces: BR-09

A module composes a refusal, the test file that imports it pins the wording, and a test file
reaching the same refusal through a verb re-states the whole sentence instead of proving its route.
A hand reading of the suite found the class over three hundred and seventy-nine files and cost seven
readers; fixing the instances it named fixes those instances, and the next one is written by a run
that cannot know they existed. The measure is lexical, on the assertion pattern itself, so it sees a
sentence pinned twice and nothing of a claim restated in other words.

- **AC-11-4-1** · Rev: 2 · Proof: plugin/test/checks/suite/one-wording.test.mjs "a sentence two reading files pin whole is named, the reader named for its module being the home"
  IF a sentence a module composes is pinned whole by more than one test file, at least one of which
  reaches that module through its own imports, THEN the check SHALL fail whichever side of the
  import line the other files stand on, SHALL name each other file with the line it pins it on,
  SHALL name the home with its line — of the reaching files, the one named for the module, then the
  one pinning most of what it composes — and SHALL name the fragment the other is to keep, since a
  refusal naming no survivor leaves a developer to guess which of two files to shorten.
- **AC-11-4-2** · Rev: 1 · Proof: plugin/test/checks/suite/one-wording.test.mjs "a negated assertion is a marker for a refusal that must not fire, not a second home"
  WHERE an assertion is negated the check SHALL report no pair for it, a refusal proved absent being
  a different claim from the refusal rather than a copy of it.
- **AC-11-4-3** · Rev: 1 · Proof: plugin/test/checks/suite/one-wording.test.mjs "a wording more than one module composes names no one sentence"
  WHERE more than one module composes the same wording the check SHALL report no pair for it, since
  there is then no one sentence to have a home and no one module to name as it.
- **AC-11-4-4** · Rev: 1 · Proof: plugin/test/checks/suite/one-wording.test.mjs "the walk reaches the suite's test files, so no pairs is a clean suite and not an empty selector"
  WHILE the check runs it SHALL assert that its walk reached the suite's own test files, because a
  selector matching nothing reports a clean suite and reads exactly like one.
- **AC-11-4-5** · Rev: 1 · Proof: plugin/test/checks/suite/one-wording.test.mjs "a pin carrying more than half of another's literal run is the same wording, whatever its kind"
  WHERE one test file's pin carries more than half of another's literal run the check SHALL read
  the two as one wording whatever pattern kind spells each, a fragment being what is left once most
  of a sentence is cut away.

### UC-11-5 — A case matches a path it did not choose as characters, never as a pattern

Rev: 1 · Actors: agent · Enforces: BR-12

A run's scratch root is named after the id its run was given, and a batch id joins its keys with
`+`, so a case building a `RegExp` from a path it was handed reads an operator where the path has a
character and goes red for a tree nobody changed. The check follows a name to where it got its value,
and a check that over-reaches is as costly as one that misses: a finding on a commit sha a case
compared is compliance paid for nothing, and the next case written beside a room is refused again.

- **AC-11-5-1** · Rev: 1 · Proof: plugin/test/checks/suite/regex-path.test.mjs "no case in either test tree puts a path it did not choose into a RegExp source"
  IF a case in any test tree puts a path it did not choose into a `RegExp` source without the
  escape the fixtures export, THEN the check SHALL fail naming the file, the line and the path.
- **AC-11-5-2** · Rev: 1 · Proof: plugin/test/checks/suite/regex-path.test.mjs "a sha destructured beside a path off the same call is not a finding"
  WHERE a name is destructured from a call to a function whose every return is an object literal
  the check SHALL read that name as a path only when its own property's value makes one, a sibling
  property of the same object being no evidence about it.
- **AC-11-5-3** · Rev: 1 · Proof: plugin/test/checks/suite/regex-path.test.mjs "a value read off a name destructured from a source nothing here can read is not a finding"
  WHERE a name is destructured from a source whose shape the check cannot read, the check SHALL read
  it as a path where that source makes one and SHALL NOT read a call to it as making one, a path
  being a value nobody calls.

## Business rules enforced

*Which rules of the BRD does this requirement carry out?*

| Rule | How this requirement carries it |
|---|---|
| BR-07 | every threshold and every rule comes from the project, and silence is the answer where it decided nothing |
| BR-09 | a rule a checker enforces is not restated in the project's rules file |
| BR-10 | the vendored script travels alone, and its drift from its source is checked |
| BR-12 | a claim is settled by a command, so the file it names is the authority |
