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
- **AC-01-1-3** · Rev: 1 · Proof: plugin/test/resolve/settings-home.test.mjs "the refusal for an unresolved account names the file it read"
  IF neither an endpoint nor a credential resolves THEN the CLI SHALL name the configuration file it
  read, rather than the one it would have read with the configuration directory left where it
  defaults, that directory being redirectable and the refusal otherwise pointing at a file it never
  opened.

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

- **AC-01-3-1** · Rev: 1 · Proof: plugin/test/tools/doctor/release.test.mjs "the three release values are reported with where they came from"
  WHEN the report runs THEN it SHALL name each setting with the source that answered, and SHALL
  report a setting that resolved to nothing as absent rather than omitting it.
- **AC-01-3-2** · Rev: 1 · Proof: plugin/test/hooks/hook-switch.test.mjs "doctor reports a switch wired to nothing"
  IF a switch names a gate that does not exist THEN the report SHALL say so, so a gate somebody
  believes is off cannot be silently on.
- **AC-01-3-3** · Rev: 1 · Proof: plugin/test/tools/services/doctor/install.test.mjs "the report prints the row and leaves the install exactly as it found it"
  IF a package the project's own manifest declares does not resolve THEN the report SHALL name it
  with the command that installs it, and SHALL install nothing of its own.
- **AC-01-3-4** · Rev: 1 · Proof: plugin/test/tools/services/doctor/subjects.test.mjs "a subject asked for prints its own rows and no other subject's"
  WHEN a subject of the report is named THEN the report SHALL print that subject's settings alone,
  and every flag the verb accepts SHALL be described under exactly one subject, so that a flag the
  verb names is one a caller can act on rather than one it can only find.
- **AC-01-3-5** · Rev: 1 · Proof: plugin/test/tools/services/doctor/subjects.test.mjs "a bare reading keeps a withheld subject's findings, drops its ok rows and leaves its detail"
  WHERE the report withholds a subject from the reading it SHALL print that subject's findings all
  the same and SHALL name the call that prints that subject whole, so that narrowing what is read
  loses no finding and leaves no reader without the route to the rest.

### UC-01-4 — Withhold a verb

Rev: 5 · Actors: developer · Enforces: BR-01, BR-07, BR-08

Three things can shorten the usage list: a record of which tools refused this credential, a
developer hiding a verb by hand, and a tool this machine has saved none of the local configuration
for. Because a verb can be missing for any of those reasons, the CLI says so rather than behaving as
though the verb never existed. The third is neither of the first two — the record is about what a
credential may spend, and the hiding is a choice — so it is answered separately, it withholds the
advertisement and not the verb, and the verb typed runs and refuses as it always did. By hand means one verb at a time or the
whole group a project has named for a job it does, and both write the one list this machine keeps,
so the report answers for a verb once and names every declared job the list matches, which is a
different claim from naming what caused it and is the only one the list can carry (BR-08). Which
jobs exist is the project's to declare, because no plugin can know what work is done in a checkout
it has never seen (BR-07). A job leaves the report verb advertised whether or not it names one,
since that verb is the only surface permitted to say what has gone missing.

A job names the methods it uses as well as the verbs, and names them rather than having them
derived from its verbs, because a method may drive no verb of this product at all and would derive
to one nobody is offered. The two are two lists on the project's side and two keys on the machine's,
so a job is named by the report only where the machine stands at the complement of both; a job
naming no method leaves every method offered, as a checkout declaring no job is left. What a
withheld method stops being is offered by this product's own surfaces, which is where it is listed
and where it is asked for by name, and the report says of a method those surfaces do not reach that
withholding it reaches nothing else.

One surface of a method is read before any of this product runs, and one copy of it ships to every
machine: the stub the session host loads off disk. Nothing can filter it, so it is written instead,
in the copy the harness installed and never in somebody's source tree, from the text this copy ships
kept beside it. It reaches a session only at the next start, so the start that writes it says which
text the session it is in is holding.

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
- **AC-01-4-10** · Rev: 1 · Proof: plugin/test/cli/doctor/job.test.mjs "one call replaces what this machine withholds with every verb the job does not offer"
  WHEN the developer turns on a job the project declares THEN the CLI SHALL replace what this
  machine withholds with every verb that job does not offer, in one call, and SHALL hold them in the
  same list a verb hidden one at a time goes into.
- **AC-01-4-11** · Rev: 1 · Proof: plugin/test/cli/doctor/job.test.mjs "turning off whatever job is on leaves nothing withheld, hand-hidden verbs included"
  WHEN the developer turns off whatever job is on THEN the CLI SHALL withhold no verb at all,
  including any the developer had hidden one at a time.
- **AC-01-4-12** · Rev: 1 · Proof: plugin/test/cli/doctor/job.test.mjs "the report names every declared job and the project's own record as where they were read"
  WHEN the resolution report is printed in a checkout whose project declares jobs THEN it SHALL name
  each job declared and SHALL name the project's own file as where they were read.
- **AC-01-4-13** · Rev: 2 · Proof: plugin/test/cli/doctor/job.test.mjs "the report names every declared job the withheld list matches, and says none matches where that is so"
  WHEN the resolution report is printed THEN it SHALL name every declared job whose withheld verbs
  and withheld methods are each exactly the ones this machine holds, SHALL say that the withholding
  matches them rather than that they caused it, and SHALL say that none matches where no declared
  job does.
- **AC-01-4-14** · Rev: 1 · Proof: plugin/test/resolve/wrapped.test.mjs "a withheld verb a declared job matches is refused by the route it wraps, in a sentence naming that job"
  WHERE a verb is withheld and exactly one declared job matches what this machine withholds, a
  refusal naming that verb SHALL name that job and the way back from it.
- **AC-01-4-15** · Rev: 1 · Proof: plugin/test/cli/doctor/job.test.mjs "a checkout declaring no job is told nothing about jobs"
  IF the project declares no job THEN the resolution report SHALL say nothing about jobs.
- **AC-01-4-16** · Rev: 1 · Proof: plugin/test/cli/doctor/job.test.mjs "a job naming a word that is no verb is refused before anything is written"
  IF a declared job names a word that is no verb of this CLI THEN the CLI SHALL refuse to turn that
  job on and SHALL write nothing.
- **AC-01-4-17** · Rev: 1 · Proof: plugin/test/cli/doctor/job.test.mjs "a job that names the report verb nowhere leaves it advertised all the same"
  IF a job names the report verb nowhere THEN turning that job on SHALL leave the report verb
  advertised all the same.
- **AC-01-4-18** · Rev: 1 · Proof: plugin/test/cli/doctor/job.test.mjs "a job reopens no verb the credential or the project has closed"
  WHERE a verb a job offers is one this credential may not spend or this project has closed, turning
  that job on SHALL leave it unadvertised.
- **AC-01-4-19** · Rev: 1 · Proof: plugin/test/cli/doctor/off.test.mjs "an off verb and a form through one reach the tracker with nothing, while a hidden verb still does"
  WHERE this machine has turned a verb off, typing that verb SHALL refuse it and SHALL run nothing.
- **AC-01-4-20** · Rev: 1 · Proof: plugin/test/cli/doctor/off.test.mjs "the refusal names the verb, the state and the one command that clears it"
  WHERE this machine has turned a verb off, the refusal SHALL name the verb, the state it is in and
  the command that offers it again, and SHALL volunteer nothing past them.
- **AC-01-4-21** · Rev: 1 · Proof: plugin/test/cli/doctor/off.test.mjs "an off verb and a form through one reach the tracker with nothing, while a hidden verb still does"
  WHERE a word this CLI performs through a verb this machine has turned off is typed, the CLI SHALL
  refuse it before the verb behind it runs.
- **AC-01-4-22** · Rev: 1 · Proof: plugin/test/cli/doctor/off.test.mjs "an off verb and a form through one reach the tracker with nothing, while a hidden verb still does"
  WHERE this machine has hidden a verb one at a time, typing that verb SHALL run it.
- **AC-01-4-23** · Rev: 1 · Proof: plugin/test/cli/doctor/job.test.mjs "one call replaces what this machine withholds with every verb the job does not offer"
  WHEN the developer turns on a job the project declares THEN the CLI SHALL turn every verb outside
  that job off rather than merely unlisted.
- **AC-01-4-24** · Rev: 1 · Proof: plugin/test/cli/doctor/off.test.mjs "a bare list of names an earlier release wrote reads as hidden throughout"
  WHERE this machine's withholding is the bare list of names an earlier release wrote, every verb in
  it SHALL be hidden rather than turned off.
- **AC-01-4-25** · Rev: 1 · Proof: plugin/test/cli/doctor/off.test.mjs "the report names every verb under the state it is in"
  WHERE this machine withholds any verb, the resolution report SHALL name every verb of this CLI
  under the state that verb is in on this machine.
- **AC-01-4-26** · Rev: 1 · Proof: plugin/test/tools/services/tool-config.test.mjs "a tool this machine saved nothing for is in no usage line and no row"
  WHERE this machine holds none of the local configuration a tool needs, the usage list SHALL
  advertise neither that tool's verb nor a row for it.
- **AC-01-4-27** · Rev: 1 · Proof: plugin/test/tools/services/tool-config.test.mjs "the verb typed still runs and refuses in its own words"
  WHERE this machine holds none of that configuration, typing that verb SHALL run it and SHALL leave
  its own refusal unchanged.
- **AC-01-4-28** · Rev: 1 · Proof: plugin/test/tools/services/tool-config.test.mjs "doctor names each unconfigured tool with the one thing that configures it"
  WHERE this machine holds none of that configuration, the resolution report SHALL name that tool
  with the one command or file that configures it.
- **AC-01-4-29** · Rev: 1 · Proof: plugin/test/tools/services/tool-config.test.mjs "a reference wholly about an unconfigured tool is unlisted, and named directly names what configures it"
  WHERE a served text is marked for a tool this machine holds no configuration for, that text SHALL
  not be served and SHALL not be listed.
- **AC-01-4-30** · Rev: 1 · Proof: plugin/test/cli/doctor/skills.test.mjs "one call withholds every skill the job does not name, beside the verbs it does not name"
  WHEN the developer turns on a job the project declares THEN the CLI SHALL withhold every method
  this copy ships that the job does not name, in the call that withholds its verbs, and SHALL hold
  them in a key of their own.
- **AC-01-4-31** · Rev: 1 · Proof: plugin/test/cli/doctor/skills.test.mjs "a job declaring no skills leaves every shipped skill offered"
  WHERE a declared job names no method, turning it on SHALL leave every method this copy ships
  offered.
- **AC-01-4-32** · Rev: 1 · Proof: plugin/test/cli/doctor/skills.test.mjs "turning off whatever job is on leaves no skill withheld"
  WHEN the developer turns off whatever job is on THEN the CLI SHALL withhold no method at all.
- **AC-01-4-33** · Rev: 1 · Proof: plugin/test/cli/doctor/skills.test.mjs "a job naming a skill this copy does not ship is refused before anything is written"
  IF a declared job names a method this copy does not ship THEN the CLI SHALL refuse to turn that job
  on and SHALL write neither the verbs it withholds nor the methods.
- **AC-01-4-34** · Rev: 1 · Proof: plugin/test/cli/doctor/skills.test.mjs "a withheld skill is unlisted, refused by name, and its phase part is served all the same"
  WHERE this machine withholds a method, the listing of this product's own guides SHALL leave it out
  and asking for it by name SHALL be refused in a line naming the method, the state it is in and the
  command that offers it again.
- **AC-01-4-35** · Rev: 1 · Proof: plugin/test/cli/doctor/skills.test.mjs "a withheld skill is unlisted, refused by name, and its phase part is served all the same"
  WHERE this machine withholds a method a verb that acts prints part of, that verb SHALL go on
  printing it.
- **AC-01-4-36** · Rev: 1 · Proof: plugin/test/cli/doctor/skills.test.mjs "the report names every shipped skill under its state, and which withheld one it offers nowhere"
  WHERE this machine withholds any method, the resolution report SHALL name every method this copy
  ships under the state it is in, and SHALL name each withheld one whose only surface here is that
  report as withheld from nothing else.
- **AC-01-4-37** · Rev: 1 · Proof: plugin/test/cli/doctor/skills.test.mjs "a job declaring no skills leaves every shipped skill offered"
  IF this machine withholds no method THEN the resolution report SHALL say nothing about methods.
- **AC-01-4-38** · Rev: 1 · Proof: plugin/test/cli/doctor/skills.test.mjs "a shipped skill every declared job leaves out is reported as offered to nobody"
  WHERE every declared job names methods and a method this copy ships is named by none of them, the
  resolution report SHALL name that method as one no job offers.
- **AC-01-4-39** · Rev: 1 · Proof: plugin/test/tools/services/skill-stubs.test.mjs "a machine that saved nothing for a tool is given a description naming it nowhere"
  WHERE this machine holds none of the local configuration a tool needs, the stub the session host
  loads SHALL name that tool nowhere in its description.
- **AC-01-4-40** · Rev: 1 · Proof: plugin/test/tools/services/skill-stubs.test.mjs "a tool that is configured keeps every word of its own while another's go"
  WHERE this machine holds the local configuration one tool needs and not another's, that stub SHALL
  keep every word of the configured tool's own material.
- **AC-01-4-41** · Rev: 1 · Proof: plugin/test/tools/services/skill-stubs.test.mjs "a machine that configured everything is given the file this copy ships"
  WHERE this machine holds the local configuration every tool needs, that stub SHALL be the file this
  copy ships.
- **AC-01-4-42** · Rev: 1 · Proof: plugin/test/tools/services/skill-stubs.test.mjs "a tool configured after its words went has them back at the next start"
  WHEN a tool is configured after its words were dropped THEN the next session start SHALL put those
  words back.
- **AC-01-4-43** · Rev: 1 · Proof: plugin/test/tools/services/skill-stubs.test.mjs "a copy inside a checkout that ships this plugin is not written, record or no record"
  IF the copy a stub sits in is inside a checkout that ships this product THEN nothing SHALL be
  written there.
- **AC-01-4-44** · Rev: 1 · Proof: plugin/test/tools/services/skill-stubs.test.mjs "a copy the install record does not name is not written"
  IF the harness's install record names no copy a stub sits in THEN nothing SHALL be written there.
- **AC-01-4-45** · Rev: 1 · Proof: plugin/test/tools/services/skill-stubs.test.mjs "the session whose start wrote a stub is told the text it holds predates the write"
  WHEN a session start writes a stub THEN it SHALL say that the text that session holds is the text
  from before that write.
- **AC-01-4-46** · Rev: 1 · Proof: plugin/test/tools/services/skill-stubs.test.mjs "the report names a stub this machine took words out of, and says nothing where none went"
  WHERE a stub on disk is off the file this copy ships, the resolution report SHALL name it with the
  tool whose words are out.
- **AC-01-4-47** · Rev: 1 · Proof: plugin/test/tools/services/skill-stubs.test.mjs "the report names a stub this machine took words out of, and says nothing where none went"
  WHERE no stub on disk is off the file this copy ships, the resolution report SHALL say nothing
  about stubs.

### UC-01-5 — The project's keys, and the machine's own

Rev: 4 · Actors: developer, agent · Enforces: BR-07, BR-08

A project decides how this product behaves inside its checkout — what a run may report about the
product, which version of the method it runs, how its changes land — and it decides in its own
project file, because a decision held anywhere else is a plugin default wearing the project's name
(BR-07). The key listed below as the machine's is the machine's instead, because what it answers is
a fact about the box rather than about the checkout: whether a release here lands itself or stops
ready to land. How many runs are carried at once is the project's, because it bounds the work a
checkout takes on rather than what the box can hold. Each key is read from one place and reported
with its source (BR-08), and a project that declares no number of runs is one this says nothing
about.

Whose a key is and where that key is kept are two questions. The project's half is kept in this
machine's own record of that project rather than in the checkout, because a file every clone carries
cannot hold what is true of one box, cannot let one worktree differ from another, and makes setting
a key a commit somebody has to review. Which record a checkout resolves is worked out from its
repository's own root folder, so every linked worktree of one checkout reads one file and nothing has
to be read to find what is to be read — the tracker slug is a value inside that record, and a lookup
keyed on it could not start. A checkout still carrying the committed file this replaces has that
file read by nothing: a second layer is the precedence rule this shape exists to remove, so it is
reported once with the one command that takes its contents over rather than quietly preferred or
quietly ignored.

- **AC-01-5-1** · Rev: 2 · Proof: plugin/test/tools/doctor.test.mjs "every key the project set is printed with this machine's record of it as its source"
  WHEN the resolution report is printed THEN the CLI SHALL list each project key with its value and
  the file it was read from.
- **AC-01-5-2** · Rev: 1 · Proof: plugin/test/tools/doctor.test.mjs "a key the project left out is printed at the plugin's default, with the default as its source"
  IF the project file does not set a key that has a product default THEN the CLI SHALL take that
  default and SHALL name the default as the source.
- **AC-01-5-3** · Rev: 1 · Proof: plugin/test/tools/doctor.test.mjs "the landing mode is the machine's: it is written to the user config and the project's file is untouched"
  WHEN the developer sets the landing mode through the report verb THEN the CLI SHALL write it to
  the account's configuration and to nothing of the project's.
- **AC-01-5-4** · Rev: 2 · Proof: plugin/test/tracker/project-config.test.mjs "the landing route comes off the release model and the auto-deploy flag, and a key overrides it"
  WHEN the project's release policy is read THEN the CLI SHALL derive the landing route from the
  release model the project declares and whether production deploys on its own, SHALL say `not
  stated` where the model is absent or is one the CLI does not recognise, and SHALL let the project
  file's own key override the derivation.
- **AC-01-5-5** · Rev: 1 · Proof: plugin/test/cli/doctor/project-block.test.mjs "a qa key in the checkout moves nothing the report prints"
  WHEN the project's release policy is read THEN the CLI SHALL print whether an independent judgement
  is asked for, read from the tracker's project record and from nowhere else.
- **AC-01-5-6** · Rev: 1 · Proof: plugin/test/tools/doctor.test.mjs "the mode the report prints is the mode last written, either way"
  WHEN the resolution report is printed THEN it SHALL print the landing mode the account's
  configuration holds.
- **AC-01-5-7** · Rev: 2 · Proof: plugin/test/tools/doctor.test.mjs "the number of parallel runs is the project's: it is read out of the project's record, with that file named as its source"
  WHEN the project declares how many runs it carries at once THEN the resolution report SHALL print
  that number, SHALL name the project's own file as where it was read, and SHALL neither read nor
  write that number in the account's configuration.
- **AC-01-5-8** · Rev: 2 · Proof: plugin/test/tools/doctor.test.mjs "a project that declares no number of runs is told the key is unset and what follows from that"
  IF the project declares no number of runs THEN the resolution report SHALL say the key is unset
  and SHALL say what follows for a wave and for a gate.
- **AC-01-5-13** · Rev: 1 · Proof: plugin/test/tools/doctor.test.mjs "a declared number is reported as the whole project's at once, not as one this session may take afresh"
  WHEN the project declares how many runs it carries at once THEN the resolution report SHALL say on
  that same line that the number is the whole project's at once whoever dispatched the runs, so that
  a session reading the value reads what bounds it and cannot supply a reading of its own.
- **AC-01-5-9** · Rev: 1 · Proof: plugin/test/cli/doctor/flow.test.mjs "one call sets the flow in the project's file and the judgement that flow asks for"
  WHEN the developer sets the project's flow through the report verb THEN the CLI SHALL write the
  flow into the project's own file and every project setting that flow asks for into the resource
  that holds it, and SHALL read each back off the resource it was written to before reporting it
  set.
- **AC-01-5-10** · Rev: 1 · Proof: plugin/test/cli/doctor/flow.test.mjs "a tracker that takes the key and keeps it not is refused, and the file goes back"
  IF either half of the configuration a flow asks for cannot be written THEN the CLI SHALL refuse
  naming the half that is out of reach, and SHALL leave the project on the flow it already had
  wherever it can be known that the other half did not land.
- **AC-01-5-11** · Rev: 1 · Proof: plugin/test/cli/doctor/flow.test.mjs "the default flow writes the file alone and says it asks for nothing further"
  WHERE a flow asks the project for nothing beyond the flow itself, the CLI SHALL write the project
  file's key alone and SHALL say that the flow asks for nothing further.
- **AC-01-5-12** · Rev: 1 · Proof: plugin/test/cli/doctor/flow.test.mjs "a read back that will not answer leaves the flow standing and names the setting unconfirmed"
  IF a setting a flow asks for is sent and the resource will not say what it now holds THEN the CLI
  SHALL refuse naming that setting unconfirmed beside the call that reads it, and SHALL leave the
  flow it wrote standing rather than putting back a state the unread half may contradict.
- **AC-01-5-14** · Rev: 1 · Proof: plugin/test/cli/doctor/project-block.test.mjs "a declared check is printed with the clock it runs under and where that clock was read"
  WHERE the project declares a command the reviewer may run, the resolution report SHALL print that
  command with the clock it runs under and the source that clock was read from, the two being one
  reading: a command a project declares and a clock it cannot see are a call spent for nothing.
- **AC-01-5-15** · Rev: 1 · Proof: plugin/test/cli/doctor/project-block.test.mjs "a check clock that is not a whole number above zero is named rather than taken"
  IF the project sets that clock to anything but a whole number of milliseconds above zero THEN the
  resolution report SHALL name the value it will not take beside the clock actually in force.
- **AC-01-5-16** · Rev: 1 · Proof: plugin/test/cli/doctor/project-block.test.mjs "a project declaring no check is one the report says nothing about"
  IF the project declares no such command THEN the resolution report SHALL print no line about it at
  all, the reviewer being given no such tool where nothing was declared.
- **AC-01-5-17** · Rev: 1 · Proof: plugin/test/cli/doctor/project-block.test.mjs "recorded stops of that same command name each one's own checkout, and a larger clock clears them"
  WHERE this machine's consult log records that same command stopped at or above the clock now in
  force, inside a window the report states, the resolution report SHALL say how many and name the
  newest one's own checkout by the time each record carries rather than by the order they were
  written, and SHALL count no record stopped under that clock, a record answering for the clock it
  was taken at.
- **AC-01-5-18** · Rev: 1 · Proof: plugin/test/cli/doctor/project-block.test.mjs "a check clock at or past the one a whole consult runs under is refused"
  IF that clock is at or past the one a whole consult runs under THEN the resolution report SHALL
  report it a fault, a check reaching such a clock costing the consult rather than coming back as a
  call that was stopped.

- **AC-01-5-19** · Rev: 1 · Proof: plugin/test/cli/doctor/adopt.test.mjs "each key the entry now holds is printed beside the file it was read back from"
  WHEN a project key is read THEN the CLI SHALL read it from this machine's own record of that
  project, kept outside every checkout, and SHALL name that file's own path as the source it
  reports.
- **AC-01-5-20** · Rev: 1 · Proof: plugin/test/cli/doctor/adopt.test.mjs "a worktree and the checkout it was cut from resolve one and the same record"
  WHERE a call is made inside a linked worktree the CLI SHALL resolve the same record the checkout
  that worktree was cut from resolves, a worktree being another checkout of one project rather than
  another project.
- **AC-01-5-21** · Rev: 1 · Proof: plugin/test/cli/doctor/adopt.test.mjs "two checkouts whose root folders differ resolve records of their own"
  WHERE two checkouts on one machine have differently named repository roots the CLI SHALL resolve a
  record of its own for each.
- **AC-01-5-22** · Rev: 1 · Proof: plugin/test/cli/doctor/adopt.test.mjs "a key the committed file carries moves no value the report prints"
  IF a checkout carries the committed project file this replaces THEN the CLI SHALL read no key out
  of it, that file being a second source rather than a fallback.
- **AC-01-5-23** · Rev: 1 · Proof: plugin/test/cli/doctor/adopt.test.mjs "a committed file standing unread is said once, with the command that takes it over"
  IF a checkout carries that file THEN the resolution report SHALL say so once per call, one fact
  about one file rather than one line per key it declares.
- **AC-01-5-24** · Rev: 1 · Proof: plugin/test/cli/doctor/adopt.test.mjs "a committed file standing unread is said once, with the command that takes it over"
  WHEN that row is printed THEN it SHALL name the command that takes the file's contents over, a
  report naming a stranded file and no route out being a finding nobody can act on.
- **AC-01-5-25** · Rev: 1 · Proof: plugin/test/cli/doctor/adopt.test.mjs "the committed file a checkout carries is adopted whole into this machine's record of it"
  WHEN the developer adopts that file THEN the CLI SHALL write its contents whole into this
  machine's record of that project.
- **AC-01-5-26** · Rev: 1 · Proof: plugin/test/cli/doctor/adopt.test.mjs "each key the entry now holds is printed beside the file it was read back from"
  WHEN an adoption lands THEN the CLI SHALL read the record back off the disk and SHALL print each
  key it now holds beside the path that answered, never off the text the call composed.
- **AC-01-5-27** · Rev: 1 · Proof: plugin/test/cli/doctor/adopt.test.mjs "adopting over a record this machine already holds is refused, and writes nothing"
  IF this machine already holds a record for that project THEN the CLI SHALL refuse the adoption and
  SHALL write nothing, a key set since holding there and nowhere else.
- **AC-01-5-28** · Rev: 1 · Proof: plugin/test/cli/doctor/adopt.test.mjs "the checkout's own committed file is left byte-identical, adoption being a copy"
  WHEN a file is adopted THEN the CLI SHALL leave the checkout's own copy byte-identical, taking a
  tracked file out of a repository being a commit and the person's own act.
- **AC-01-5-29** · Rev: 1 · Proof: plugin/test/cli/doctor/adopt.test.mjs "the entry is created by the first --set, a project that has set nothing having no file yet"
  WHEN a project key is written and this machine holds no record for that project THEN the CLI SHALL
  create one, a project that has decided nothing yet being the case the first write is for.
- **AC-01-5-30** · Rev: 1 · Proof: plugin/test/cli/doctor/adopt.test.mjs "a key this machine owns is refused as a project key by name, with the route that writes it"
  IF a key this machine owns outright is written as a project key THEN the CLI SHALL refuse naming
  that key, SHALL say which level holds it and the route that writes it, and SHALL write nothing.
- **AC-01-5-31** · Rev: 1 · Proof: plugin/test/cli/doctor/adopt.test.mjs "a call needing a project slug refuses naming the command that adopts, where one is standing there"
  IF a call needs a resolved project slug where no record is held and the committed file is still
  standing in the checkout THEN the CLI SHALL refuse naming the command that adopts it.
- **AC-01-5-32** · Rev: 1 · Proof: plugin/test/cli/doctor/adopt.test.mjs "a directory belonging to no checkout resolves no record, and --set says so rather than making one"
  IF the directory a call is made in belongs to no checkout THEN the CLI SHALL resolve no project
  record at all, a directory belonging to no repository having no project to be configured.
- **AC-01-5-33** · Rev: 1 · Proof: plugin/test/cli/doctor/adopt.test.mjs "the record a named directory resolves is that directory's own repository's, not this process's"
  WHEN a verb reads the project configuration of a directory it is not standing in THEN the CLI
  SHALL answer off that directory's own repository root rather than off the process's working
  directory.

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
