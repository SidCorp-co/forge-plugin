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

- **AC-01-1-1** · Rev: 1 · Proof: plugin/test/cli/env-flags.test.mjs "no value is read from the environment"
  WHERE a setting could be taken from the environment the CLI SHALL take none, and the test SHALL
  fail when a new environment read is added.
- **AC-01-1-2** · Rev: 1 · Proof: plugin/test/tools/doctor.test.mjs "the saved credential is owner-only, and lands outside the repository it was saved from"
  WHEN the credential is written THEN the CLI SHALL store it at owner-only permissions outside the
  repository.

### UC-01-2 — Resolve the project

Rev: 1 · Actors: agent · Enforces: BR-08, BR-14

The project's slug lives in the project's own settings file at its root, and it is demanded only by
a call that needs a project identifier. The identifier itself is never configured: it is looked up
from the slug at runtime, so a copied settings file cannot point one project's calls at another's
records.

- **AC-01-2-1** · Rev: 1 · Proof: plugin/test/tools/doctor.test.mjs "a slug header alone is reported, with where to put it instead"
  WHEN a call needs a project identifier THEN the CLI SHALL look it up from the slug and SHALL
  accept no identifier as input.
- **AC-01-2-2** · Rev: 1 · Proof: plugin/test/tools/doctor.test.mjs "a .mcp.json naming a forge server is reported and not read"
  IF a competing configuration is present — a client configuration naming a server of this product,
  or a project header set elsewhere — THEN the report SHALL name it, SHALL not read it, and SHALL
  print the command that saves the same value properly.

### UC-01-3 — Report what resolved, and from where

Rev: 1 · Actors: developer, agent · Enforces: BR-01, BR-08

One verb prints every resolved setting, the source that answered for it, and whether the endpoint
can be reached. It is what a refusal points at, so it answers before the question is asked twice.

- **AC-01-3-1** · Rev: 1 · Proof: plugin/test/tools/doctor.test.mjs "the three release values are reported with where they came from"
  WHEN the report runs THEN it SHALL name each setting with the source that answered, and SHALL
  report a setting that resolved to nothing as absent rather than omitting it.
- **AC-01-3-2** · Rev: 1 · Proof: plugin/test/hooks/hook-switch.test.mjs "doctor reports a switch wired to nothing"
  IF a switch names a gate that does not exist THEN the report SHALL say so, so a gate somebody
  believes is off cannot be silently on.

### UC-01-4 — Withhold a verb

Rev: 1 · Actors: developer · Enforces: BR-01, BR-07

Two things can shorten the usage list: a record of which tools refused this credential, and a
developer hiding a verb by hand. Because a verb can be missing for either reason, the CLI says so
rather than behaving as though the verb never existed.

- **AC-01-4-1** · Rev: 1 · Proof: plugin/test/cli/cli-help.test.mjs "no run of anything else is advertised"
  WHEN the usage list is printed THEN it SHALL advertise only what this credential may run.
- **AC-01-4-2** · Rev: 1 · Proof: none yet — ISS-8
  WHEN a tool refuses this credential THEN the CLI SHALL record which tool, for which project, and
  when, and SHALL offer a way to list past that record.
- **AC-01-4-3** · Rev: 1 · Proof: none yet — ISS-673
  WHERE the project withholds the channel to this product's own backlog, the usage list SHALL not
  advertise the filing verb for it.
- **AC-01-4-4** · Rev: 1 · Proof: none yet — ISS-673
  WHERE the project withholds that channel, the filing verb typed SHALL refuse in one line naming the
  project's key.
- **AC-01-4-5** · Rev: 1 · Proof: none yet — ISS-673
  WHERE the project withholds that channel, a body aimed at this product filed on the project's own
  backlog SHALL be held with the report route in the reply, except in this product's own repository,
  where a defect in the product is the project's issue and nothing is held.
- **AC-01-4-6** · Rev: 1 · Proof: none yet — ISS-673
  WHERE the project allows only defects on that channel, an enhancement filing SHALL be refused by
  its kind, and WHERE it allows all, the filing SHALL be read against the enhancement shape.
- **AC-01-4-7** · Rev: 1 · Proof: none yet — ISS-673
  WHEN a run's report is assembled THEN it SHALL tell nothing filed from filing withheld by the
  project, as two distinct lines.
- **AC-01-4-8** · Rev: 1 · Proof: none yet — ISS-673
  WHEN the product's own method text is read THEN it SHALL name no destination verb for a finding.
- **AC-01-4-9** · Rev: 1 · Proof: none yet — ISS-673
  WHEN the filing verb's help is printed THEN it SHALL render the destination of a finding off the
  project's key, naming the channel's verb where the key allows it and no verb where it does not.

### UC-01-5 — The project's keys, and the machine's own

Rev: 3 · Actors: developer, agent · Enforces: BR-07, BR-08

A project decides how this product behaves inside its checkout — what a run may report about the
product, which version of the method it runs, how its changes land — and it decides in its own
project file, because a decision held anywhere else is a plugin default wearing the project's name
(BR-07). The key listed below as the machine's is the machine's instead, because what it answers is
a fact about the box rather than about the checkout: whether a release here lands itself or stops
ready to land. How many runs are carried at once is the project's, because it bounds the work a
checkout takes on rather than what the box can hold. Each key is read from one place and reported
with its source (BR-08), and a project that declares no number of runs is one this says nothing
about.

- **AC-01-5-1** · Rev: 1 · Proof: plugin/test/tools/doctor.test.mjs "every key the project set is printed with .forge.json as its source"
  WHEN the resolution report is printed THEN the CLI SHALL list each project key with its value and
  where it was read from.
- **AC-01-5-2** · Rev: 1 · Proof: plugin/test/tools/doctor.test.mjs "a key the project left out is printed at the plugin's default, with the default as its source"
  IF the project file does not set a key that has a product default THEN the CLI SHALL take that
  default and SHALL name the default as the source.
- **AC-01-5-3** · Rev: 1 · Proof: plugin/test/tools/doctor.test.mjs "the landing mode is the machine's: it is written to the user config and the project's file is untouched"
  WHEN the developer sets the landing mode through the report verb THEN the CLI SHALL write it to
  the account's configuration and to nothing of the project's.
- **AC-01-5-4** · Rev: 1 · Proof: plugin/test/tracker/project-config.test.mjs "the landing route comes off the branch pair and the auto-deploy flag, and a key overrides it"
  WHEN the project's release policy is read THEN the CLI SHALL derive the landing route from the
  staging branch, the production branch and whether production deploys on its own, SHALL say `not
  stated` where they do not answer, and SHALL let the project file's own key override the derivation.
- **AC-01-5-5** · Rev: 1 · Proof: plugin/test/cli/doctor/project-block.test.mjs "a qa key in the checkout moves nothing the report prints"
  WHEN the project's release policy is read THEN the CLI SHALL print whether an independent judgement
  is asked for, read from the tracker's project record and from nowhere else.
- **AC-01-5-6** · Rev: 1 · Proof: plugin/test/tools/doctor.test.mjs "the mode the report prints is the mode last written, either way"
  WHEN the resolution report is printed THEN it SHALL print the landing mode the account's
  configuration holds.
- **AC-01-5-7** · Rev: 2 · Proof: plugin/test/tools/doctor.test.mjs "the number of parallel runs is the project's: it is read out of the project file, with that file named as its source"
  WHEN the project declares how many runs it carries at once THEN the resolution report SHALL print
  that number, SHALL name the project's own file as where it was read, and SHALL neither read nor
  write that number in the account's configuration.
- **AC-01-5-8** · Rev: 2 · Proof: plugin/test/tools/doctor.test.mjs "a project that declares no number of runs is told the key is unset and what follows from that"
  IF the project declares no number of runs THEN the resolution report SHALL say the key is unset
  and SHALL say what follows for a wave and for a gate.

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
