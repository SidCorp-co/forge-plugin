# SRS §8 — FR-06 — The second opinion

Rev: 1 · Actors: agent, reviewer · Enforces: BR-01, BR-16 · Source: plugin/guides/skills/forge/default/references/codex.md

← [Index](./README.md) · [§7 FR-05 Earned transitions](./fr-05-earned-transitions.md) · Next: [§9 FR-07 The gate harness](./fr-07-gate-harness.md)

## Purpose

*Why does this requirement exist?*

What a turn wrote is read by a model from another provider before it lands. Why that is worth its
tokens at all, and how a finding should be received, is
`plugin/guides/skills/forge/default/references/codex.md`; what this requirement adds is that the reading has to
happen and has to be answered, because a reminder is context and an agent can ignore one — and one
did, for an hour of gate changes.

A second opinion from the same model family is duplication wearing the clothes of confirmation
(C-09), which is why the review model is refused when it resolves to this model's own family.

## Actors

*Who acts here?*

- **The agent**, which states its intent, receives findings and disposes of each one.
- **The reviewer**, the other provider's model, which rules on what it was asked about.

## Use cases

*What is sent, what comes back, and what must happen before a commit?*

### UC-06-1 — Ask for a review of what this turn changed

Rev: 1 · Actors: agent · Enforces: BR-01, BR-16

The intent — what the author was trying to do — is the part the reviewer cannot see, and what is
sent alongside it is the codex reference's business. Which files are worth a second opinion is the
checkout's decision rather than the account's, and `README.md` says why that level.

- **AC-06-1-1** · Rev: 2 · Proof: plugin/test/codex/codex.test.mjs "the pattern comes from the checkout, else the account, else the default"
  WHEN a consult runs THEN the pattern deciding which paths are eligible for the turn's record SHALL
  be taken from the checkout, else the account, else the default, in that order.
- **AC-06-1-2** · Rev: 1 · Proof: plugin/test/codex/codex.test.mjs "a slot resolving to this model's own family is the echo case"
  IF the review model resolves to this model's own family THEN the CLI SHALL refuse the consult.
- **AC-06-1-3** · Rev: 1 · Proof: plugin/test/codex/codex.test.mjs "a path escapes the repo by neither dots nor a symlink"
  IF a named path leaves the checkout, by relative segments or by a symbolic link, THEN the CLI
  SHALL refuse to send it.
- **AC-06-1-4** · Rev: 2 · Proof: plugin/test/codex/codex-tools.test.mjs "a red check names the cases its own output named, above the tail"
  WHERE the checkout names a command the reviewer may run, the CLI SHALL run it once per consult,
  from that checkout, under an environment it composed, and SHALL report its exit status and the tail
  of its output; and WHERE that output announces itself as TAP it SHALL report the failing cases the
  output named, up to a bound it states.
- **AC-06-1-5** · Rev: 1 · Proof: plugin/test/codex/gateway/anchor.test.mjs "a diff consult reviews the tree's own change, tests and deletions included, and says what of the turn record it left out"
  WHEN a consult selects the files it reviews THEN the CLI SHALL take the paths the caller named
  where there are any, else the turn's record where the consult is a recheck holding one, else the
  checkout's own change against the base whatever that record holds, else the record; and it SHALL
  disclose each of those last three as the ground it selected on.
- **AC-06-1-6** · Rev: 2 · Proof: plugin/test/codex/gateway/anchor.test.mjs "a path that is not in the tree and has no diff reaches neither the reviewer nor the log, and leaves the turn record"
  IF a path is absent from the tree and has no diff against the base THEN the CLI SHALL send it to
  the reviewer in no form, SHALL leave it out of the file list it records, SHALL drop it from the
  turn's record, and SHALL name what it dropped; and it SHALL take that course whatever ground the
  review set was selected on, asking the tree's own head where the consult named no base.
- **AC-06-1-7** · Rev: 1 · Proof: plugin/test/codex/payload/bundle.test.mjs "a bodies pass over a set the cap cannot carry is refused, and costs the run nothing"
  IF a whole-body consult cannot carry every file of its set whole THEN the CLI SHALL refuse it
  before the reviewer is reached, and SHALL name the passes whose files together are every file of
  the set it can carry whole.
- **AC-06-1-8** · Rev: 1 · Proof: plugin/test/codex/payload/bundle.test.mjs "a file longer than one file may be is named apart, with the diff that is the most of it"
  WHERE a file of the set is longer than one file may be sent as, the refusal SHALL name that file
  apart from the passes, beside the consult that sends its change instead.
- **AC-06-1-9** · Rev: 1 · Proof: plugin/test/codex/log/reviewed-head.test.mjs "one run's passes at one clean head are together the read the review was earned by"
  WHERE one run took several whole-body consults at one recorded head with no working-tree change
  under any of them, those consults SHALL answer together as the read a review of that set is
  earned by.
- **AC-06-1-10** · Rev: 1 · Proof: plugin/test/codex/codex-state.test.mjs "a consult holds a path whose staged copy is not the copy it was sent"
  IF a path a consult sent is one whose bytes a commit would carry are not the bytes that went up
  THEN the CLI SHALL keep that path in the turn's record, SHALL name it, and SHALL name the command
  that clears it; and it SHALL keep every path it sent wherever the index cannot be read, a clear
  decided on the copy on disk alone having answered for bytes no reviewer was shown.
- **AC-06-1-11** · Rev: 1 · Proof: plugin/test/codex/codex.test.mjs "an outside path sends bodies where no mode was named, and a named mode stands"
  WHERE the set a consult settled on holds a path no checkout of this repository contains, the CLI
  SHALL send every file of that consult whole where neither the command nor the configuration named
  a send mode, SHALL leave a named mode standing and say that it stands, and SHALL name on every
  consult the mode it is sending under.
- **AC-06-1-12** · Rev: 1 · Proof: plugin/test/codex/codex.test.mjs "the check's clock is the project's own where it names one, and the product's default otherwise"
  WHEN the checkout names a command the reviewer may run THEN the clock that command runs under SHALL
  be the project's own where it declares one as a whole number of milliseconds above zero, and the
  product's default otherwise, resolved once so that no reader of it supplies a second default.
- **AC-06-1-13** · Rev: 1 · Proof: plugin/test/codex/codex-tools.test.mjs "a check stopped at its clock names the clock, where it was read, and the key that moves it"
  IF that command is stopped at its clock THEN what comes back SHALL name the clock it was stopped
  at, where that clock was read from, and the key that moves it, so that the run which paid for the
  stopped call learns from it what to change.
- **AC-06-1-14** · Rev: 1 · Proof: plugin/test/codex/gateway/check-state.test.mjs "a review that declined the offered check says so where the run reads what the round cost"
  WHEN a consult ends THEN the CLI SHALL record on that consult's own log row which of five states
  the check the checkout declared left the round in — run, stopped at its clock, unable to start,
  offered and not taken, or never offered — SHALL record beside it the command that check was,
  wherever the checkout declared one, and SHALL say that state to the caller in the same place it
  says what the round cost, so that a review given by inspection alone is told apart from one that
  executed the suite without either being read for an absence.

### UC-06-2 — List the documents a turn changed, once, at the end

Rev: 1 · Actors: agent · Enforces: BR-01

The reading is offered once at the end of a turn rather than at each write, for the reason
`plugin/hooks/how/codex-turn.md` gives, and a document whose content the last consult already read
is not offered again however recently it was touched.

- **AC-06-2-1** · Rev: 1 · Proof: plugin/test/gates/codex/codex-turn.test.mjs "a later turn is told even though the list from an earlier one is still pending"
  WHEN the first document of a turn is written THEN the CLI SHALL ask once, and SHALL record the
  rest of that turn's documents without asking again.
- **AC-06-2-2** · Rev: 3 · Proof: plugin/test/codex/codex-record.test.mjs "a write at the bytes read is recorded where the index holds another copy, and cleared where it does not"
  IF the most recent consult shown a document read it at the content the tree holds now THEN the CLI
  SHALL hold no record of that document as unread, whether it was named, touched, or already recorded
  from a write since taken back — unless a change to it is staged whose staged copy is apart from the
  tree's, which is a reading still owed on the bytes a commit would land, asked of a path no record
  held as of one a record already did, and taken as owed wherever either of those cannot be read.
- **AC-06-2-3** · Rev: 1 · Proof: plugin/test/gates/codex/codex-turn.test.mjs "giving up on the lock leaves a note, and the note is not counted as a refusal"
  WHILE a turn is in progress the CLI SHALL never stop it for an unread document.

### UC-06-3 — A commit waits for the reading and for the verdict, where the project asks it to

Rev: 3 · Actors: agent · Enforces: BR-01

Before a commit, two things are asked for: that documents recorded and never consulted on are read,
and that the last consult which made findings heard a disposition of each. A finding nobody ruled on
is an open finding. Which doors ask at all is the project's, in one list read by every door, and the
commit is the one that list holds when nobody has written it — so a project that has not decided is
asked exactly what it was asked before there was a list. Nothing between commits is asked anything: a
gate deciding per write reviewed fragments, and the trigger it decided on could not be read at all.

- **AC-06-3-10** · Rev: 1 · Proof: plugin/test/gates/codex/codex-owed.test.mjs "a door the project did not name holds nothing, and the key absent holds only the commit"
  WHERE the project has not said which doors ask, the CLI SHALL ask at the commit and at no other,
  which is what it asked before the saying was possible.
- **AC-06-3-11** · Rev: 1 · Proof: plugin/test/gates/codex/codex-owed.test.mjs "the commit door is the same key, so a project naming only the gate is not asked twice"
  WHERE the project says which doors ask and the commit is not among them, the CLI SHALL let a commit
  through without asking, whatever that record holds.

- **AC-06-3-1** · Rev: 3 · Proof: plugin/test/gates/codex/codex-second.test.mjs "a commit waits for the documents it stages, and not for one left dirty beside them"
  WHEN a commit stages a document recorded as unread THEN the gate SHALL refuse the commit and SHALL
  name the files it wants read; and it SHALL count as unread neither a document the commit carries at
  bytes a consult was shown nor one absent from the tree that the tree's own head reports no change
  of — a copy staged before the working file was put back being neither.
- **AC-06-3-2** · Rev: 1 · Proof: plugin/test/gates/codex/codex-second.test.mjs "a commit waits for a verdict on the last consult that made findings"
  IF the last consult made findings and heard no disposition THEN the gate SHALL refuse the commit
  and SHALL name the command that records one.
- **AC-06-3-3** · Rev: 1 · Proof: plugin/test/gates/codex/codex-second.test.mjs "a commit is judged by the tree it names, not the shell's"
  WHEN a commit names another tree THEN the gate SHALL judge it by that tree rather than by the
  shell's.
- **AC-06-3-4** · Rev: 1 · Status: retired (ISS-360)
  WHEN work is deleted rather than written THEN the gate SHALL treat the deletion as work in the
  tree, a whole directory included.
- **AC-06-3-5** · Rev: 1 · Proof: plugin/test/codex/codex-state.test.mjs "the record's own listing keeps a file written back to the read bytes apart from what a commit is asked for"
  WHERE the turn's record holds a file whose current bytes a consult was shown, the CLI SHALL list it
  apart from the files a commit is still asked for, a reader told only that a file is recorded having
  no way to tell a write nobody has read from one there is nothing left to read.
- **AC-06-3-6** · Rev: 1 · Proof: plugin/test/codex/codex-state.test.mjs "a recorded path the tree no longer holds leaves the record when the listing reads it"
  WHERE the turn's record holds a path absent from the tree that the tree's own head reports no
  change of, the CLI SHALL take it out of the record as it lists what a commit is asked for, rather
  than name it as a write awaiting a reading that nothing can stage and no consult can reach.
- **AC-06-3-7** · Rev: 1 · Proof: plugin/test/gates/codex/codex-second.test.mjs "a record under one configuration home and a gate reading another are each named by the surface that answered"
  WHEN the gate refuses a commit THEN it SHALL name the configuration directory whose turn record and
  consult log it read, a caller with no way to tell a consult this gate cannot see from one nobody
  has made having no route out of the refusal at all.
- **AC-06-3-8** · Rev: 1 · Proof: plugin/test/codex/codex-state.test.mjs "the listing names the configuration directory it read, with files to list and with none"
  WHEN the CLI lists what a commit is asked for THEN it SHALL name the configuration directory it
  read the turn record from, including where it holds nothing to list, so that an empty answer and a
  refusal about the same file cannot both be read as facts about one record.
- **AC-06-3-9** · Rev: 1 · Proof: plugin/test/gates/codex/codex-second.test.mjs "a staged copy apart from the disk is refused with a route no consult can take"
  WHERE a document the refusal names is staged at a copy that is not the one on disk, the refusal
  SHALL name staging that document as the route out and SHALL name no consult for it, every consult
  reading the copy on disk and none being able to reach the copy the index holds.
- **AC-06-3-12** · Rev: 1 · Proof: plugin/test/codex/codex-state.test.mjs "a recorded path carrying no diff and nothing staged is settled, and one that differs is not"
  WHERE the turn's record holds a path the tree still has, tracked, carrying no change against the
  tree's own head and nothing of it staged, the CLI SHALL take it out of the record as it lists what
  is asked for, a consult over it being handed no bytes and so unable to clear it by the route the
  refusal names; and it SHALL settle no path on a probe that failed to answer.

### UC-06-4 — What the built-in advisor said travels into the consult

Rev: 1 · Actors: agent · Status: retired (ISS-360)

Retired because the first reviewer is server-side: nothing fires when it speaks, its reply is
encrypted the moment the turn moves on, and the only readings left to a gate were a guess at whether
it spoke and a search for one word in a command. What it said now reaches the second reviewer, and
the record, by the author's hand or not at all.

- **AC-06-4-1** · Rev: 1 · Status: retired (ISS-360)
  IF the advisor has spoken this turn and its advice is unspent THEN the gate SHALL ask once for that
  advice to be carried into the consult's intent, and SHALL then let the write through.
- **AC-06-4-2** · Rev: 1 · Status: retired (ISS-360)
  IF no advisor spoke before a consult THEN the gate SHALL ask nothing, since the order of the two
  is the author's.
- **AC-06-4-3** · Rev: 1 · Status: retired (ISS-360)
  WHEN the phrase appears only inside data — a document body, a quoted argument, a program's own
  string — THEN the gate SHALL not read it as a consult.

### UC-06-5 — Every finding is disposed of by identifier

Rev: 1 · Actors: agent · Enforces: BR-01, BR-03

Each finding is accepted or rejected with a reason, by the identifier the review gave it, and the
disposition is replayed into the next consult. Rejecting a finding with a reason is a legitimate
outcome; leaving it unruled makes "resolved or still open" a guess.

- **AC-06-5-1** · Rev: 1 · Proof: plugin/test/codex/log/replies.test.mjs "a verdict names findings by id, and a name the reply never gave is refused"
  WHEN a disposition is recorded THEN it SHALL be stored against the identifier the review gave, and
  SHALL travel into the next consult.
- **AC-06-5-2** · Rev: 1 · Proof: plugin/test/codex/codex-log.test.mjs "a credential in a consult record is masked before the line is written"
  WHEN a credential appears in anything written to the log THEN it SHALL be masked before it is
  written down.
- **AC-06-5-3** · Rev: 1 · Proof: plugin/test/codex/log/identity.test.mjs "an entry says which run wrote it, and which source answered for the id"
  WHEN anything is written to the log THEN the entry SHALL name the run that wrote it beside the
  source that answered for that identity, because two entries written in one second are attributable
  only by what each of them says of itself.
- **AC-06-5-4** · Rev: 1 · Proof: plugin/test/codex/log/identity.test.mjs "an entry written where no run id resolves says so rather than carrying a blank"
  WHERE no identity resolves for the writing run the entry SHALL say that, rather than carry an empty
  one, because a blank every unattributed entry shares reads as one run having written them all.
- **AC-06-5-5** · Rev: 1 · Proof: plugin/test/codex/log/masking.test.mjs "an entry stored before the write-side mask is masked on the way into the next consult"
  WHEN a stored exchange is replayed into a request THEN every string it carries SHALL be masked
  before that request leaves the machine, because the exchange may have been written before the mask
  the write takes and nothing rewrites what is already stored.
- **AC-06-5-6** · Rev: 1 · Proof: plugin/test/codex/log/replies.test.mjs "a recheck leaves the author's ruling and its reason standing, and says what it newly found anyway"
  WHERE a re-verification rules on a finding the author has already disposed of by identifier, the
  stored disposition SHALL stay as the author wrote it, reason included, because the reviewer's word
  is what a re-verification carries and the disposition is the author's alone.
- **AC-06-5-7** · Rev: 1 · Proof: plugin/test/codex/log/replies.test.mjs "a recheck leaves the author's ruling and its reason standing, and says what it newly found anyway"
  WHEN a re-verification rules against a disposition it may not move THEN it SHALL record what it
  ruled on each such finding beside the disposition, and SHALL say so in the caller's own output
  naming the command that settles it, because a collision reachable only by reading the log
  afterwards is one nobody reads.
- **AC-06-5-8** · Rev: 1 · Proof: plugin/test/codex/log/recheck.test.mjs "a set that excluded the judged consult's findings says so and names what reaches them"
  WHERE the file set a re-verification resolved to excludes a finding of the review it answers, the
  CLI SHALL name that review, the identifier it gave that finding and the file the finding is
  anchored on, rather than report that the review found nothing; where the re-verification goes ahead
  regardless it SHALL do so for each excluded finding no disposition names, because the gate that
  refuses a commit filters findings by no file set and the two surfaces would otherwise disagree over
  whether the finding exists, while one already disposed of holds no gate and naming it mid-round
  says nothing a caller can act on.
- **AC-06-5-9** · Rev: 1 · Proof: plugin/test/codex/log/recheck.test.mjs "a set that excluded the judged consult's findings says so and names what reaches them"
  WHEN the CLI names the command that reaches such a finding THEN the file set that command carries
  SHALL resolve back to the review the finding was made by, and WHERE no such set does the CLI SHALL
  name the form that records the disposition directly instead, because a command that runs and
  verifies a different review is worse than no route at all.

### UC-06-6 — Compare the log's last hundred consults with the hundred before them

Rev: 1 · Actors: agent · Enforces: BR-16

Nothing a reviewer answers is diffable, so an upgrade to the harness shows up only as a shift in what
the reviews cost and in how much of them was kept. The log holds both, and this comparison is what
turns them into a judgement rather than an impression. How the windows are sized, why a crossing
writes a reading and what pinning one is for is `docs/cli/stats-the-mark.md`. That reading shares a
store with the run corpus's, whose own side of it is EI-08, and this use case is the consult side
alone.

- **AC-06-6-1** · Rev: 1 · Proof: plugin/test/codex/codex-plan.test.mjs "the eval is the last hundred against the hundred before, scored on the whole log's verdicts"
  WHEN the log holds two full windows THEN the CLI SHALL compare the hundred most recently answered
  consults with the hundred answered before them, and SHALL score both on every disposition the log
  holds rather than on those falling inside a window.
- **AC-06-6-2** · Rev: 1 · Proof: plugin/test/codex/codex-plan.test.mjs "what separates the windows is counted per value, not merely listed"
  WHEN two windows of consults are compared THEN the CLI SHALL say what separates them as a count of
  consults on each side for every value of the slot asked for, the model behind it, the prompt
  version and the reasoning effort.
- **AC-06-6-3** · Rev: 1 · Proof: plugin/test/codex/codex-plan.test.mjs "the eval writes nothing and refuses a window nobody can act on"
  WHEN the comparison is asked for, on the screen or as one object, THEN the CLI SHALL leave the log
  exactly as it found it.
- **AC-06-6-4** · Rev: 1 · Proof: plugin/test/codex/codex-log.test.mjs "the consult that takes the log onto a hundred-mark names the eval; the one before it says nothing"
  WHEN a consult's own record brings the log to a positive multiple of a hundred answered consults
  THEN that consult SHALL end on one line naming the comparison to run, counted from where that
  record sits among the answered consults rather than from anything holding the last crossing.
- **AC-06-6-5** · Rev: 1 · Proof: plugin/test/codex/codex-log.test.mjs "the consult that takes the log onto a hundred-mark names the eval; the one before it says nothing"
  WHEN that line is printed THEN the CLI SHALL take the comparison from the log as it stood when the
  record landed, SHALL attempt to append it as the reading for that mark unless that mark is held
  already, and SHALL end the same line with what became of it.
- **AC-06-6-6** · Rev: 1 · Proof: plugin/test/codex/codex-plan.test.mjs "a stored consult reading is the before window, scored as it was at the mark, on every checkout"
  WHERE a held reading is named as the earlier window the CLI SHALL put that reading's later window
  in the sliding one's place, scored as it stood at the mark rather than rescored by anything
  recorded since.
- **AC-06-6-7** · Rev: 1 · Proof: plugin/test/codex/codex-plan.test.mjs "a short window says its real size, and a log too young says it has no window before"
  WHERE the log does not reach two full windows the CLI SHALL compare as far back as it reaches and
  SHALL say how far short of a window it fell, rather than compare against consults the log does not
  hold.

### UC-06-7 — A call the project names waits for the same reading the commit waits for

Rev: 1 · Actors: agent · Enforces: BR-01

What a commit is held for is knowable the moment a document is written, and the call that costs the
most stands between that moment and the commit. Asked there in the commit's own words it is one
reading and not two, so a run that meets it reaches the commit with nothing left to answer;
`plugin/hooks/how/codex-owed.md` carries the figures and the trade.

- **AC-06-7-1** · Rev: 1 · Proof: plugin/test/gates/codex/codex-owed.test.mjs "a gate the project named waits for the documents it would judge, and says what reads them"
  WHEN a call the project named would judge a document no consult has read THEN the CLI SHALL refuse
  that call and SHALL name the documents, the consult that reads them, the route that discards them
  unread, and the switch that stands the rule down.
- **AC-06-7-2** · Rev: 1 · Proof: plugin/test/gates/codex/codex-owed.test.mjs "a consult read and ruled before the gate clears the gate and the commit alike"
  WHERE one reading satisfies a call the project named, the CLI SHALL let the commit after it through
  without asking again, both doors reading one record through one reader.
- **AC-06-7-3** · Rev: 1 · Proof: plugin/test/gates/codex/codex-owed.test.mjs "a value the key does not take is refused with the key named, and nothing is guessed"
  IF the project lists a door this does not serve THEN the CLI SHALL refuse and SHALL name the key and
  what it takes, rather than fall back on a value nobody typed.
- **AC-06-7-4** · Rev: 1 · Proof: plugin/test/gates/codex/codex-owed.test.mjs "a finding nobody ruled on holds the gate, with the disposition that closes it"
  IF the last consult made findings nobody has ruled on THEN the CLI SHALL refuse the named call and
  SHALL name the disposition that closes them.
- **AC-06-7-5** · Rev: 1 · Proof: plugin/test/gates/codex/codex-owed.test.mjs "the tree is where the cd in the same command left the shell, and every tree the line gates in"
  WHEN the call moves the shell before it runs THEN the CLI SHALL read the list, the commands and the
  record of every tree the call would judge in, rather than of the one it was made from.
- **AC-06-7-6** · Rev: 1 · Proof: plugin/test/gates/codex/codex-owed.test.mjs "a call whose tree cannot be read is refused where this project asks at that door, and nowhere else"
  WHERE the call moves the shell somewhere no reading can name, the CLI SHALL refuse it and SHALL ask
  for that destination to be spelled out, rather than judge it by the tree the call was made from.

## Business rules enforced

*Which rules of the BRD does this requirement carry out?*

| Rule | How this requirement carries it |
|---|---|
| BR-01 | every refusal names the consult or the disposition that clears it |
| BR-16 | what comes back from a model is read and ruled on, because nothing about it is diffable |
| BR-03 | a disposition is recorded rather than remembered, and a rejection carries its reason |
