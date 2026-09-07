# SRS §4 — FR-02 — The tracker surface

Rev: 1 · Actors: agent, developer · Enforces: BR-01, BR-06, BR-14 · Source: docs/FORGE-CLI.md

← [Index](./README.md) · [§3 FR-01 Resolution](./fr-01-resolution.md) · Next: [§5 FR-03 The lease](./fr-03-the-lease.md)

## Purpose

*Why does this requirement exist?*

The backlog has to be readable and writable from a terminal with no client connected, in calls
narrow enough that reading an issue does not cost the turn. Every projection here exists because a
wider one was measured and found to be mostly bytes that said nothing.

## Actors

*Who acts here?*

- **The agent**, which reads before it writes and writes through the narrowest call that answers.
- **The developer**, who uses the same verbs by hand.

## Use cases

*What can be asked of the tracker, and what comes back?*

### UC-02-1 — Browse and read

Rev: 3 · Actors: agent, developer · Enforces: BR-14

A browse projection for many issues and a full read for the one about to be worked. The full read
answers with every column the record carries, so any field of it may be asked for by the name the
read prints it under and the column the tracker grows next is askable the day it appears. Absence
is meaningful: a field with nothing in it is left out rather than returned as an empty value that
says only that the field exists.

- **AC-02-1-1** · Rev: 2 · Proof: plugin/test/tracker/issues.test.mjs "a key on a backlog with no gaps costs one request, whatever page it would be on"
  WHEN a reference naming an issue by its key is resolved THEN the CLI SHALL ask the tracker for the
  one record that key names rather than reading the backlog to find it.
- **AC-02-1-2** · Rev: 1 · Proof: plugin/test/tracker/issues.test.mjs "a uuid is its own answer and asks for no list"
  WHEN the reference given is already an identifier the tracker stores THEN the CLI SHALL ask for no
  listing at all.
- **AC-02-1-3** · Rev: 1 · Proof: plugin/test/cli/commands.test.mjs "nothing else in the record is touched"
  WHEN a read returns an attachment THEN the CLI SHALL collapse it to the reference that fetches it
  and SHALL leave everything else in the record untouched.
- **AC-02-1-4** · Rev: 1 · Proof: plugin/test/tracker/issue/fields.test.mjs "a name only the body carries answers where it used to be refused"
  WHEN a field is asked for by the name the full read prints it under THEN the CLI SHALL answer with
  that field, and SHALL print no field the ask did not name beyond the identifiers the tracker
  returns unasked.
- **AC-02-1-5** · Rev: 1 · Status: retired (ISS-508)
  WHERE every name a read asks for is one the tracker declares it will project, the CLI SHALL ask
  the tracker for those names rather than for the whole body.
- **AC-02-1-6** · Rev: 2 · Proof: plugin/test/tracker/issue/fields.test.mjs "a name nothing carries is refused with the command that prints the names"
  IF a name is asked for that the record does not carry THEN the CLI SHALL refuse it and SHALL name
  the command that prints the names it does take.
- **AC-02-1-7** · Rev: 2 · Proof: plugin/test/tracker/issue/fields.test.mjs "a read naming fields skips the routes those fields are not on"
  WHEN a read names fields THEN the CLI SHALL read the issue exactly once and SHALL ask only for the
  parts of it those fields are served by.
- **AC-02-1-8** · Rev: 1 · Proof: none yet — ISS-681
  WHEN issues are read THEN one verb SHALL answer for many and for one, by whether a key is given.

### UC-02-2 — A read is never mistaken for complete

Rev: 1 · Actors: agent · Enforces: BR-02, BR-14

A list bound by the caller's own limit is indistinguishable from a complete one, so the answer
carries what was returned, the limit and whether more exists — and a report assembled from a
truncated read is refused rather than rendered.

- **AC-02-2-1** · Rev: 1 · Proof: none yet — ISS-17
  IF the record could not be read whole THEN the CLI SHALL refuse to judge anything on it and SHALL
  say which read was short.

### UC-02-3 — Write to an issue

Rev: 1 · Actors: agent · Enforces: BR-01, BR-06

A comment, a plan, an attachment and a filing are writes, and each is a write whichever route it
takes: the CLI's own verb, or the tracker's tool called directly. An attachment is uploaded rather
than encoded into the call, because bytes through a context window are paid for twice.

- **AC-02-3-1** · Rev: 1 · Proof: plugin/test/tracker/issue/read-first.test.mjs "every verb that writes the record names its issue, and the read verbs name none"
  WHEN a comment, a plan or an attachment is written THEN the gates SHALL treat it as a write, and
  a transition asked for through the tracker's own tool SHALL be treated as one too.
- **AC-02-3-2** · Rev: 1 · Proof: plugin/test/tracker/issue/read-first.test.mjs "the tracker's own tool is judged by its action, with its arguments already parsed"
  WHEN the tracker's own tool is called THEN the CLI SHALL judge the call by the action it names
  rather than by the tool's name.
- **AC-02-3-3** · Rev: 1 · Proof: none yet — ISS-681
  WHEN a field or a status is written with no entry check read THEN the CLI SHALL say so in its
  reply and SHALL leave a correction on the record naming what was set and why.
- **AC-02-3-4** · Rev: 1 · Proof: none yet — ISS-681
  WHEN an edge between two issues is written or removed THEN the CLI SHALL do it through the issue's
  own dependency route, and the ranking SHALL read the edge it wrote.

### UC-02-4 — Everything the tracker returns is untrusted input

Rev: 2 · Actors: agent · Enforces: BR-02

What the tracker returns arrives inside its own data fence (EI-01), and the transport takes that
fence off before anything else here reads: a body cannot instruct whatever parses it, and no reader
below the transport can mistake a fence line for a value, never having met one.

- **AC-02-4-1** · Rev: 2 · Proof: plugin/test/tracker/rpc.test.mjs "a marker is off each decoded string value, whichever path the payload came back on"
  WHEN a fenced field is read THEN the transport SHALL take the fence off before any other module
  reads the field, and no reader SHALL treat what the fence held as an instruction.

### UC-02-5 — A transient failure is retried and never recorded

Rev: 1 · Actors: agent · Enforces: BR-02

A tracker answering with an error is the network's fault rather than the work's. It is retried
under a policy, and nothing about it reaches the issue: a run that has to stop says so once, in a
comment, and moves no status.

- **AC-02-5-1** · Rev: 1 · Proof: none yet — ISS-253
  IF a response status is in the retry table THEN the CLI SHALL retry to the limit, and one that is
  not SHALL cost exactly one request.

### UC-02-6 — Every capability has a verb, and a verb says what it takes

Rev: 3 · Actors: agent, developer · Enforces: BR-01, BR-14

Every capability of the tracker a run can need is reached through a verb, and no raw route stands
beside the verbs: a surface an agent drives is one where a wrong form gets the verb's own answer, and
a raw route is where a wrong form gets no answer at all. What a verb takes is asked of the verb. The
user's decision of 2026-09-07 reversed the earlier reading, under which anything unwrapped stayed
reachable up to a declared edge; the cost accepted is that a capability the tracker adds later needs
a release of this product before a run can use it.

- **AC-02-6-1** · Rev: 1 · Proof: plugin/test/cli/cli-help.test.mjs "every verb says what to type"
  WHEN a verb is asked what it takes THEN it SHALL answer on its own, and asking SHALL never be
  read as a failure or as the verb's argument.
- **AC-02-6-2** · Rev: 1 · Status: retired (ISS-681)
  IF a call carries an argument the CLI's declaration for that capability does not put on the
  request THEN the CLI SHALL send nothing at all and SHALL name that argument.
- **AC-02-6-3** · Rev: 1 · Proof: none yet — ISS-681
  WHEN the surface is listed THEN no verb SHALL offer a capability by its raw name and payload.

### UC-02-7 — Which issue to work next, ranked off the record

Rev: 1 · Actors: agent, developer · Enforces: BR-01, BR-07, BR-09

The order the backlog is worked in is arithmetic over the metadata the tracker already carries,
computed at the moment it is asked for and stored nowhere. One table of weights answers for it, a
project overrides a weight without editing the code, and the answer accounts for itself: what each
issue scored, what left it out, and what one landing would free.

- **AC-02-7-1** · Rev: 1 · Proof: plugin/test/rank/next.test.mjs "the rank prints the eligible issues and writes nothing at all"
  WHEN the backlog is ranked THEN the CLI SHALL change nothing the tracker holds.
- **AC-02-7-2** · Rev: 1 · Proof: plugin/test/rank/eligible.test.mjs "a live lease drops the issue and the sentence names the session and its expiry"
  WHEN an issue is kept out of the ranking THEN the CLI SHALL name what kept it out, and SHALL name
  the run holding it where a claim is what did.
- **AC-02-7-3** · Rev: 1 · Proof: plugin/test/rank/score.test.mjs "every weight in the table moves the order on its own"
  WHERE two issues differ in one weighted field alone, the CLI SHALL order them by that field.
- **AC-02-7-4** · Rev: 1 · Status: retired (ISS-681)
  IF the tracker reports no size for an issue THEN the CLI SHALL take the size the body declares
  instead, and SHALL report which of the two it read.
- **AC-02-7-5** · Rev: 1 · Proof: plugin/test/rank/next.test.mjs "a blocker prints the wave it frees, a two-deep chain as a chain"
  WHEN one issue holds up others THEN the CLI SHALL weigh it by every issue waiting behind it rather
  than by those waiting directly, and SHALL print what the landing would free.
- **AC-02-7-6** · Rev: 1 · Proof: plugin/test/rank/weights.test.mjs "a weight the table does not hold is refused, not dropped"
  IF a project sets a weight the table does not carry THEN the CLI SHALL refuse the ranking and
  SHALL name the weights it does carry.
- **AC-02-7-7** · Rev: 1 · Proof: none yet — ISS-681
  WHEN the dependency graph is printed THEN the CLI SHALL read the edges the ranking reads, and a
  claim found only in an issue's prose SHALL be listed apart as one the tracker does not hold.

### UC-02-9 — A verb's flags are its usage row's, and a wrong form gets the verb's own answer

Rev: 1 · Actors: agent · Enforces: BR-01, BR-09, BR-14

Every verb reads its flags through one parser, and the parser knows the verb's row, so a flag the
row does not name is refused in one place with one sentence, before any credential is spent. Help is
the row, a line per flag and a sentence to choose the verb by; anything longer has a home elsewhere
and is one more copy to drift (BR-09). An agent's wrong form varies by agent, so a form the surface
does not list is not pointed at the right one, which spends a turn, but handled behind the parser:
where the form names one act and that act's own check passes, the act is performed and the reply
says which verb ran; where it does not, the reply is that verb's own refusal. No such form appears
in help, and every one that fires is counted, because a form that fires often is a defect in the
method text and not a feature to keep.

- **AC-02-9-1** · Rev: 1 · Proof: none yet — ISS-681
  IF a verb is given a flag its usage row does not name THEN the CLI SHALL refuse before any call is
  made, naming the flag and the set the verb takes.
- **AC-02-9-2** · Rev: 1 · Proof: none yet — ISS-681
  IF a flag the verb takes is given no value THEN the CLI SHALL name that flag, and SHALL not read
  the word after it as an unknown flag.
- **AC-02-9-3** · Rev: 1 · Proof: none yet — ISS-681
  WHEN a verb's help is printed THEN it SHALL hold the usage row, one line per flag and one sentence
  to choose the verb by, and SHALL fit under the size the suite states.
- **AC-02-9-4** · Rev: 1 · Proof: none yet — ISS-681
  IF a status of the flow is typed as a verb and the record earns that status as the next one THEN
  the CLI SHALL move the issue to it and SHALL print the line the advance verb prints, naming the
  verb it ran as.
- **AC-02-9-5** · Rev: 1 · Proof: none yet — ISS-681
  IF a status of the flow is typed as a verb and the record does not earn it THEN the CLI SHALL
  print what is owed with the advance line, and SHALL move nothing.
- **AC-02-9-6** · Rev: 1 · Proof: none yet — ISS-681
  WHEN the usage list or a verb's help is printed THEN no form the handler reads SHALL appear in it.
- **AC-02-9-7** · Rev: 1 · Proof: none yet — ISS-681
  WHEN a run's statistics are printed THEN each form the handler read SHALL be listed with how often
  it fired.
- **AC-02-9-8** · Rev: 1 · Proof: none yet — ISS-681
  WHEN the merged mark or its undo is asked for THEN one verb SHALL be the only route to each, and no
  other form of the surface SHALL reach either.
- **AC-02-9-9** · Rev: 1 · Proof: none yet — ISS-681
  IF the consult verb is given a dash where it takes a path THEN it SHALL refuse in one line saying
  that its intent is read from standard input.
- **AC-02-9-10** · Rev: 1 · Proof: none yet — ISS-681
  IF a word is neither a verb nor a form the handler reads THEN the CLI SHALL answer as it answers an
  unknown verb.
- **AC-02-9-11** · Rev: 1 · Proof: none yet — ISS-681
  WHEN the usage list is printed THEN it SHALL group the verbs by what they act on, each group under
  a heading of its own.
- **AC-02-9-12** · Rev: 1 · Proof: none yet — ISS-681
  WHERE a flag names a field of the tracker, it SHALL carry the tracker's own name for that field and
  SHALL take the tracker's own values, and the CLI SHALL keep no second vocabulary for them.
- **AC-02-9-13** · Rev: 1 · Proof: none yet — ISS-681
  WHEN the project's configuration is asked for THEN the verb that answers SHALL be named for
  configuration and not for the project.
- **AC-02-9-14** · Rev: 1 · Proof: none yet — ISS-681
  IF a form the handler reads names a read THEN the CLI SHALL perform that read, since a read has no
  entry check to fail.

### UC-02-10 — The projects, at the plugin's own scope

Rev: 1 · Actors: developer, agent · Enforces: BR-01, BR-08, BR-15

Every other verb acts inside the project the checkout names, so the one verb that acts on projects
themselves is the plugin's only global one: it lists them, makes one, reads one, changes one and
archives one, each through the tracker's own route. Deleting a project is the one act here with
nothing behind it, so it is not offered and the refusal names archiving (BR-15). What a project
decides about itself — its pipeline, its facts — is written by the configuration verb, inside the
project's scope, and each key is reported with its source (BR-08).

- **AC-02-10-1** · Rev: 1 · Proof: none yet — ISS-681
  WHEN projects are asked for THEN one verb SHALL list them, create one, read one, update one and
  archive one, each through the tracker's own route for that act.
- **AC-02-10-2** · Rev: 1 · Proof: none yet — ISS-681
  IF a project's deletion is asked for THEN the CLI SHALL refuse it and SHALL name archiving as the
  route.
- **AC-02-10-3** · Rev: 1 · Proof: none yet — ISS-681
  WHEN a key of the project's own configuration is written THEN the configuration verb SHALL write
  it through the route of the resource that key belongs to, the pipeline configuration or the
  project facts, and SHALL name the key it set.
- **AC-02-10-4** · Rev: 1 · Proof: none yet — ISS-681
  WHEN a verb other than the projects verb reaches a resource the tracker keeps per project THEN it
  SHALL act in the project the checkout's settings name, resolved behind the verb, and SHALL take no
  project as an argument; a verb reaching no such resource SHALL need no project.

### UC-02-8 — The method arrives with the verb that acts, rendered and versioned

Rev: 1 · Actors: agent · Enforces: BR-07, BR-09

A method served as a static file is read by the agent choosing which part to read, and a part
chosen can be the wrong one, one the issue's tier does not owe, or one read too early to be held when
needed; a static part also cannot say what this project, this band and this status make true. The
verbs that perform the acts know all three. So a part is rendered at the call from one source text
per part (BR-09), for the project's keys and the version it pins (BR-07), and the verb that acts
carries the part for its act.

- **AC-02-8-1** · Rev: 1 · Proof: none yet — ISS-673
  WHEN a part of the method is served THEN the CLI SHALL render it for the project's keys, the issue's
  band and status and the version the project pins, removing marked lines and adding none.
- **AC-02-8-2** · Rev: 1 · Proof: none yet — ISS-673
  IF the project pins a version this copy does not ship THEN the CLI SHALL refuse in one line naming
  the versions it ships.
- **AC-02-8-3** · Rev: 1 · Proof: none yet — ISS-673
  WHEN a part is served THEN its last line SHALL name the version it was read from.
- **AC-02-8-4** · Rev: 1 · Proof: none yet — ISS-673
  WHEN the method's index is cut for one issue THEN it SHALL list only the phases that issue's band,
  status and project keys leave it owing.
- **AC-02-8-5** · Rev: 1 · Proof: none yet — ISS-673
  WHEN a verb first acts on an issue in a session THEN its reply SHALL carry the phase part for that
  act, identical to what the guide verb prints for it, and a later act of the same kind in that
  session SHALL carry none.
- **AC-02-8-6** · Rev: 1 · Proof: none yet — ISS-673
  WHEN a refusal is written THEN it SHALL end with the filing line only where the project's key
  allows that channel.
- **AC-02-8-7** · Rev: 1 · Proof: none yet — ISS-673
  WHEN one issue's whole context is re-minted THEN it SHALL carry the index cut for that issue
  beside the record and the brief.

## Business rules enforced

*Which rules of the BRD does this requirement carry out?*

| Rule | How this requirement carries it |
|---|---|
| BR-01 | every refusal names the missing argument or the call that answers |
| BR-06 | the CLI's verb and the tracker's own tool are judged alike |
| BR-14 | a flag, a trailing argument or a duplicate number is used or refused, never dropped |
| BR-02 | a truncated read is not a record, and a transient error is not an event |
| BR-07 | the ranking weighs the trees an issue names and infers no layout from a checkout |
| BR-09 | one weight table, printed by the help that scores from it |
