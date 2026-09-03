# SRS §3 — FR-01 — Account and project resolution

Rev: 1 · Actors: developer, agent · Enforces: BR-07, BR-08, BR-14, BR-17 · Coupling: schema · Source: README.md

← [Index](./README.md) · [§2 System overview](./02-system-overview.md) · Next: [§4 FR-02 The tracker surface](./fr-02-tracker-surface.md)

## Purpose

*Why does this requirement exist?*

Every call this product makes needs an endpoint, a credential and a project, and each of the three
has exactly one source. Two sources for one setting is a precedence rule to remember, a report that
has to say which layer answered, and an undo that is wrong whenever only one half applies (BR-08).
A credential also belongs outside every repository, because a token in a tracked file is one push
from public and nothing about it fails loudly.

## Actors

*Who acts here?*

- **The developer**, who writes the credential and decides what is hidden.
- **The agent**, which resolves rather than configures, and reads a report when something refuses.

## Use cases

*What has to be resolved, and how is it reported?*

### UC-01-1 — Resolve the account

Rev: 1 · Actors: agent · Enforces: BR-08

The endpoint and the token are one instance's and one credential's, for every project, and they are
read from the account's own configuration file at owner-only permissions. The environment is not a
source and neither is any file inside a repository — a credential that answers by directory is an
account setting in name only.

- **AC-01-1-1** · Rev: 1 · Proof: plugin/test/cli/env-flags.test.mjs
  WHERE a setting could be taken from the environment the CLI SHALL take none, and the test SHALL
  fail when a new environment read is added.
- **AC-01-1-2** · Rev: 1 · Proof: plugin/test/tools/doctor.test.mjs
  WHEN the credential is written THEN the CLI SHALL store it at owner-only permissions outside the
  repository.

### UC-01-2 — Resolve the project

Rev: 1 · Actors: agent · Enforces: BR-08, BR-14

The project's slug lives in the project's own settings file at its root, and it is demanded only by
a call that needs a project identifier. The identifier itself is never configured: it is looked up
from the slug at runtime, so a copied settings file cannot point one project's calls at another's
records.

- **AC-01-2-1** · Rev: 1 · Proof: plugin/test/tools/doctor.test.mjs
  WHEN a call needs a project identifier THEN the CLI SHALL look it up from the slug and SHALL
  accept no identifier as input.
- **AC-01-2-2** · Rev: 1 · Proof: plugin/test/tools/doctor.test.mjs
  IF a competing configuration is present — a client configuration naming a server of this product,
  or a project header set elsewhere — THEN the report SHALL name it, SHALL not read it, and SHALL
  print the command that saves the same value properly.

### UC-01-3 — Report what resolved, and from where

Rev: 1 · Actors: developer, agent · Enforces: BR-01, BR-08

One verb prints every resolved setting, the source that answered for it, and whether the endpoint
can be reached. It is what a refusal points at, so it answers before the question is asked twice.

- **AC-01-3-1** · Rev: 1 · Proof: plugin/test/tools/doctor.test.mjs
  WHEN the report runs THEN it SHALL name each setting with the source that answered, and SHALL
  report a setting that resolved to nothing as absent rather than omitting it.
- **AC-01-3-2** · Rev: 1 · Proof: plugin/test/hooks/hook-switch.test.mjs
  IF a switch names a gate that does not exist THEN the report SHALL say so, so a gate somebody
  believes is off cannot be silently on.

### UC-01-4 — Withhold a verb

Rev: 1 · Actors: developer · Enforces: BR-01, BR-07

Two things can shorten the usage list: a record of which tools refused this credential, and a
developer hiding a verb by hand. Because a verb can be missing for either reason, the CLI says so
rather than behaving as though the verb never existed.

- **AC-01-4-1** · Rev: 1 · Proof: plugin/test/cli/cli-help.test.mjs
  WHEN the usage list is printed THEN it SHALL advertise only what this credential may run.
- **AC-01-4-2** · Rev: 1 · Proof: none yet — ISS-8
  WHEN a tool refuses this credential THEN the CLI SHALL record which tool, for which project, and
  when, and SHALL offer a way to list past that record.

## The way back

*What undoes a change here?*

The account's configuration file is a shape this product owns, so a key renamed or removed leaves
an installed copy reading a file it no longer understands. The way back is that the report verb is
also the writer: it rewrites every key it owns, so a wrong or half-migrated file is repaired by
running it rather than by editing by hand. A key that is dropped is dropped by a version that still
reads the old one, and a test points the configuration directory at a temporary one first (BR-17),
because the alternative is a migration rehearsed on the developer's own token.

## Business rules enforced

*Which rules of the BRD does this requirement carry out?*

| Rule | How this requirement carries it |
|---|---|
| BR-07 | it reads the project's configuration and assumes nothing about the project |
| BR-08 | one source per setting, and a competing source is reported rather than merged |
| BR-14 | a setting that resolves to nothing is reported, never defaulted silently |
| BR-17 | the configuration directory is redirectable, which is how a test avoids the live credential |
