# SRS §13 — FR-11 — The project's own code rules

Rev: 1 · Actors: project, agent · Enforces: BR-07, BR-09, BR-10, BR-12 · Source: plugin/hooks/how/code-quality.md

← [Index](./README.md) · [§12 FR-10 Comments read before a write](./fr-10-read-before-write.md) · Next: [§14 FR-12 The documentation gates](./fr-12-documentation-gates.md)

## Purpose

*Why does this requirement exist?*

This product owns *when and where* a rule fires, and owns no rule about what good code is. The
project owns that: its linter, its configuration, its thresholds. So the code files a call wrote —
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
binary and the configuration. The project's installed copy is preferred and the vendored copy is
the fallback. Linting is the slowest thing a post-call gate does and the whole line shares one
deadline, so the number of files one call can carry is capped — which is why the cap is a clause
here rather than an implementation detail.

- **AC-11-1-1** · Rev: 1 · Proof: plugin/test/code-quality.test.mjs
  WHEN a call writes code files THEN the gate SHALL hand them to the project's own linter, up to the
  cap the event's deadline imposes.
- **AC-11-1-5** · Rev: 1 · Proof: none yet — ISS-38
  IF a call wrote more files than that cap THEN the gate SHALL name the files it did not lint.
- **AC-11-1-2** · Rev: 1 · Proof: plugin/test/code-quality.test.mjs
  IF the project configures no linter THEN the gate SHALL say nothing.
- **AC-11-1-3** · Rev: 1 · Proof: plugin/test/code-quality.test.mjs
  WHEN a file has already been reported at its current content THEN naming it again SHALL not be
  answered twice.
- **AC-11-1-4** · Rev: 1 · Proof: plugin/test/code-quality.test.mjs
  WHEN a finding is reported THEN the report SHALL name the rules that fired, and a clean file SHALL
  produce nothing.

### UC-11-2 — A rules file's claims about its own repository

Rev: 1 · Actors: agent · Enforces: BR-12

Each kind of claim is settled by a command rather than by an opinion: a path that is not there, a
script no manifest holds, a help flag a script does not handle, a tool not on the path, a reference
that does not resolve, a file said to be absent that exists, a commit that is no ancestor, an
identifier cited nowhere else. Only backticked spans and link targets are claims, so prose naming a
file is not one.

- **AC-11-2-1** · Rev: 1 · Proof: plugin/test/claude-md-hook.test.mjs
  IF a write introduces a claim the repository does not bear out THEN the gate SHALL refuse the
  write, SHALL name the claim, and SHALL name one move that clears it.
- **AC-11-2-2** · Rev: 1 · Proof: plugin/test/claude-md-hook.test.mjs
  IF the claim is already broken in the committed file THEN this write SHALL not be refused for it,
  so the edit that fixes an inherited file lands.
- **AC-11-2-3** · Rev: 1 · Proof: plugin/test/claude-md.test.mjs
  WHERE a rule is already enforced by a checker the report SHALL raise it where a person is reading
  rather than refusing the write.
- **AC-11-2-4** · Rev: 1 · Proof: plugin/test/claude-md-hook.test.mjs
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

## Business rules enforced

*Which rules of the BRD does this requirement carry out?*

| Rule | How this requirement carries it |
|---|---|
| BR-07 | every threshold and every rule comes from the project, and silence is the answer where it decided nothing |
| BR-09 | a rule a checker enforces is not restated in the project's rules file |
| BR-10 | the vendored script travels alone, and its drift from its source is checked |
| BR-12 | a claim is settled by a command, so the file it names is the authority |
