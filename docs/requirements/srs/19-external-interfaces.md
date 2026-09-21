# SRS §19 — External interfaces

← [Index](./README.md) · [§18 Data](./18-data.md) · Next: [§20 Traceability](./traceability.md)

## What this product talks to

*Which boundaries does it cross, and what does each one owe?*

Every interface here is somebody else's, so each clause says what this product may assume about it
and what it does when the assumption fails.

### EI-01 — The tracker

Rev: 3 · Enforces: BR-02, BR-14 · Reached from: `plugin/src/tracker/rest.mjs`

Calls go over the tracker's REST API, with the credential as a bearer token and the project carried
as a path segment naming its identifier rather than as a header naming its slug. One capability may
compose more than one request, because the shape this product answers with is sometimes assembled
from routes the tracker keeps apart. The tracker owns its state machine, its fields and its data
fence; this product owns none of them. Its errors are the network's fault rather than the work's,
and are retried and never recorded (UC-02-5). Every capability this product has takes that API and
no second endpoint stands behind any of them, so one the declaration leaves without a route is
refused where it was asked for. Where such a route reads off the request what the tracker used to
read off a payload — the type of a file being uploaded — this product supplies that value and the
tracker keeps the verdict on it.

- **AC-19-1-1** · Rev: 2 · Proof: plugin/test/tracker/routes.test.mjs "no row of the table declares a transport, every one of them being a request"
  WHEN the CLI calls a tracker capability THEN it SHALL send the request its own declaration for
  that capability names, and SHALL refuse a capability its declaration leaves without one rather
  than reaching the tracker by another transport.
- **AC-19-1-2** · Rev: 2 · Proof: plugin/test/tracker/rest.test.mjs "the marker takes the one line terminator that is the wrapper's, and no other"
  WHEN a field arrives inside the tracker's data fence THEN the transport SHALL hand on the value
  with the whitespace its author wrote and without the fence or the line terminators it owned.

### EI-02 — The review provider

Rev: 1 · Enforces: BR-16 · Reached from: `plugin/src/codex/codex-api.mjs`

A model from another provider, reached over its own gateway. It is worth its tokens only because it
is a different family, so a slot resolving to this model's own family is refused (C-09). Every tool
call it makes is printed as it runs, and a path it asks for outside the checkout is refused.

- **AC-19-2-1** · Rev: 1 · Proof: plugin/test/codex/codex.test.mjs "the model slot resolves through the profile, not the flag"
  WHEN the review model is resolved THEN the resolution SHALL come from the profile rather than
  from a flag, and an own-family slot SHALL be refused.
- **AC-19-2-2** · Rev: 1 · Proof: plugin/test/codex/codex-tools.test.mjs "a path that is not there is answered with the nearest directory that is"
  IF the reviewer asks for a path outside the checkout THEN the CLI SHALL refuse and SHALL name what
  the checkout holds at its top.

### EI-03 — The host that runs the gates

Rev: 1 · Enforces: BR-01, BR-07

The session host hands each gate an event and reads back a decision. What the host offers is fixed:
one registration per event, no per-gate switch (C-06), and a copy of the plugin taken at install
time (C-01). How a gate's answer becomes that protocol is `docs/HOOKS.md`'s.

- **AC-19-3-1** · Rev: 1 · Proof: plugin/test/hooks/gate.test.mjs "after a call, every gate's block and context travel together"
  WHEN a gate decides THEN the runner SHALL express that decision in the host's own protocol.
- **AC-19-3-2** · Rev: 1 · Proof: plugin/test/hooks/gate-entry.test.mjs "an empty bin gets both"
  WHEN a session starts THEN the product SHALL put its binaries on the path from the copy that is
  running.
- **AC-19-3-3** · Rev: 1 · Proof: plugin/test/tools/roles.test.mjs "the qa role ships beside the other four, and doctor names it where the loaded copy predates it"
  WHEN the roles this copy ships are reported THEN the judging role SHALL resolve beside the others.
- **AC-19-3-4** · Rev: 2 · Proof: plugin/test/tools/roles.test.mjs "the judging method names the deployment identity as a citation and no refusal for its absence"
  WHEN the judging role's text is read THEN it SHALL name the deployment identity as what a verdict
  cites where the brief carries one, and SHALL say what a verdict is held to where the brief carries
  none, because a method naming a refusal no checker makes sends the role to set down work the
  product admits.
- **AC-19-3-5** · Rev: 1 · Proof: plugin/test/tools/roles.test.mjs "the ask for an artifact carries the route that produces it"
  WHEN the judging role's text asks for an artifact THEN it SHALL name the route that takes one from
  the equipment the role is granted, and SHALL name what stands where no route reaches the state a
  criterion is about.

### EI-04 — The project's linter

Rev: 1 · Enforces: BR-07

Reached through its own entry point, which resolves the workspace, the binary and the
configuration. Which copy of it answers is `README.md`'s; a project with neither is silence
(NFR-09).

- **AC-19-4-1** · Rev: 1 · Proof: plugin/test/gates/code-quality.test.mjs "a finding is refused in the delegate's protocol and written to the log like every other"
  WHEN a file is linted THEN the finding SHALL come from the project's own configuration, and the
  product SHALL add no rule of its own.

### EI-05 — The Vietnamese gateway

Rev: 2 · Enforces: BR-08, BR-11, BR-14

A streaming model call per segment, reached on a key this machine holds beside every other service's.
The file this gateway had of its own still answers for a key the machine's own configuration does not
set, so a box set up before that configuration held one keeps working, and the report says which of
the two answered. Placeholder accounting and segmentation are this product's; the prose is the
model's and is judged by a person (NFR-10).

- **AC-19-5-1** · Rev: 1 · Proof: plugin/test/vi/vi-gateway.test.mjs "a key reaches the results only where its translation carries the source's placeholders and no others"
  WHEN a batch is sent THEN the result SHALL be accepted only if every placeholder is accounted
  for.
- **AC-19-5-2** · Rev: 1 · Proof: plugin/test/resolve/machine/stores.test.mjs "the plugin's own configuration answers before the file a tool owns, key by key"
  WHERE a key of this gateway is held in both the machine's own configuration and the file this
  gateway owns, the product SHALL take the machine's own and SHALL name the file it took it from.

### EI-06 — The zone and record service

Rev: 1 · Enforces: BR-08 · Reached from: `plugin/src/tools/services/cloudflare.mjs`

Zones, records and cache purges on the developer's own credential, from the same account
configuration as everything else — one source, so nothing about which credential answered is a
precedence rule.

- **AC-19-6-1** · Rev: 1 · Proof: plugin/test/tools/services/cloudflare.test.mjs "an environment pair is not an account"
  WHEN a zone or record call is made THEN the credential SHALL come from the account's own
  configuration.
- **AC-19-6-2** · Rev: 1 · Proof: plugin/test/tools/services/cloudflare.test.mjs "an endpoint that never answers is refused inside the deadline, naming the request and the key"
  WHEN a zone or record call is made THEN it SHALL run under the deadline the same configuration
  states for every client of this product, and one that runs out SHALL be refused naming the
  request, the seconds it was given and the key that raises them.

### EI-10 — The deployment platform

Rev: 1 · Enforces: BR-08, BR-14 · Reached from: `plugin/src/tools/services/coolify/client.mjs`, `plugin/src/tools/services/coolify/config.mjs`

An instance of somebody else's deployment platform, on the developer's own credential, reached
through the operation index that platform's own specification generates. Which operations this
product will call is a set it declares, and which resources a call may name is a project this
checkout pins and not an argument: there is no unscoped call, and an operation the index ties to no
resource of that project is not offered. What the platform answers with is its own, so a status it
reports is read as that platform means it rather than as it spells it.

- **AC-19-10-1** · Rev: 1 · Proof: plugin/test/tools/services/coolify/request.test.mjs "a uuid outside the pin is refused, and its own action path is never asked for"
  IF a call names a resource outside the pinned project THEN the CLI SHALL refuse it while the
  target is being resolved, and SHALL send nothing to that resource's own route.
- **AC-19-10-2** · Rev: 1 · Proof: plugin/test/tools/services/coolify/request.test.mjs "with nothing pinned every route-index command refuses and says what to write"
  WHERE no project is pinned the CLI SHALL refuse every call that reaches this boundary, and SHALL
  name what pins one.
- **AC-19-10-3** · Rev: 1 · Proof: plugin/test/tools/services/coolify/surface.test.mjs "deploy is the one served operation with a selector nothing ties to the pin"
  WHEN an operation is offered THEN either its resource-naming arguments SHALL be ones the index
  ties to the pinned project, or its answer SHALL be a listing the pin cuts down, and an argument
  with neither SHALL be refused.
- **AC-19-10-4** · Rev: 1 · Proof: plugin/test/tools/services/coolify/request.test.mjs "the token reaches neither stream on a refusal, nor under --dry-run"
  WHERE text this boundary produced is printed the CLI SHALL strike the credential out of it first.
- **AC-19-10-5** · Rev: 1 · Proof: plugin/test/tools/services/coolify/shape.test.mjs "the phantom health half goes and every other half stays"
  WHEN a state this platform reports is shown THEN the CLI SHALL drop the half that reads unhealthy
  for want of a healthcheck, and SHALL keep every other half whole.
- **AC-19-10-6** · Rev: 1 · Proof: plugin/test/tools/services/coolify/request.test.mjs "an environment listing is masked by default and plain under --reveal"
  WHEN a record carrying a secret is shown THEN the CLI SHALL mask that value unless the caller
  asked for it as it stands.
- **AC-19-10-7** · Rev: 1 · Proof: plugin/test/tools/services/coolify/deadline.test.mjs "an instance that never answers is refused inside the deadline, naming the request and the key"
  WHEN a call reaches this platform THEN it SHALL be bounded by the deadline the account
  configuration states, and SHALL be refused past it naming the operation, the seconds it had and
  the key a caller raises.

### EI-07 — The version-control host

Rev: 1 · Enforces: BR-02

Branches, commits and pushes are the developer's own tooling, not this product's. It reads the tree
to decide what a call wrote and what a commit would land, and it writes nothing to a remote of its
own accord. What the repository knows is written onto the issue at the step that knew it, and never
read back at judging time.

- **AC-19-7-1** · Rev: 1 · Proof: plugin/test/gates/codex/codex-second.test.mjs "a commit is judged by the tree it names, not the shell's"
  WHEN a commit is judged THEN the tree judged SHALL be the one the command names rather than the
  shell's.

### EI-08 — The session host's record of a run

Rev: 1 · Enforces: BR-08

The same host keeps a line-delimited record of what each subagent it ran did, in a scratch directory
of its own naming. The shape is the host's and may move under this product; the directory is worked
out from the project's own path rather than held anywhere, so there is nothing to keep in step with
it. Reading is all this product does there.

- **AC-19-8-1** · Rev: 1 · Proof: plugin/test/stats/runs.test.mjs "nothing a caller writes is opened"
  WHEN a profile is asked for THEN the CLI SHALL work the directory out from the project directory
  given, and SHALL refuse a location arriving any other way.
- **AC-19-8-2** · Rev: 1 · Proof: plugin/test/stats/runs.test.mjs "a window is read off the run's own clock, not the file's"
  WHEN a run is judged against a window THEN the CLI SHALL take the run's own last moment rather
  than the moment the file was last touched.
- **AC-19-8-3** · Rev: 1 · Proof: plugin/test/stats/runs.test.mjs "every row of a fixture run is what the transcript adds up to"
  WHERE a call in that record was never answered the CLI SHALL report it as unanswered and SHALL
  add nothing to any waiting time on its account.
- **AC-19-8-4** · Rev: 2 · Proof: plugin/test/stats/eval.test.mjs "fewer than two full windows is said as a shortfall, and judged not a comparison"
  WHEN two windows of runs are compared and no stored reading is named THEN the CLI SHALL take the
  last fifty runs and the fifty before them by each run's own last record, adjacent and
  non-overlapping, and SHALL say how many the earlier window is short of rather than compare against
  a window it does not hold.
- **AC-19-8-5** · Rev: 2 · Proof: plugin/test/stats/marks/marks.test.mjs "the ship's mark is one line at a multiple of the window, read off the corpus, and silent otherwise"
  WHEN a release lands and the project's run count is a positive multiple of the window THEN the
  release step SHALL end on one line naming the comparison to run, SHALL read the crossing off the
  corpus alone, and SHALL write that comparison's figures as one record for the mark once and never
  again.

- **AC-19-8-6** · Rev: 2 · Proof: plugin/test/stats/phases.test.mjs "a consult before the plan write is the plan's, and the review opens on the one after the build"
  WHEN a run's calls are cut into phases THEN the CLI SHALL open the review phase only on a
  whole-set consult taken after the build has begun, and SHALL count in the phase the run was
  already in both a consult taken before that and a consult sent only what a commit stages.
- **AC-19-8-28** · Rev: 1 · Proof: plugin/test/stats/phases.test.mjs "the tail after the landing is the shipping phase's, and the cleanup or a learning write opens the last one"
  WHEN a run's calls are cut into phases THEN the CLI SHALL count the wait for the release, the
  reading of what now runs and the closing of the work in the phase the landing opened, SHALL open
  the phase after it only on the call that ends the run's workspace or on a write of what the run
  learned, and SHALL name each phase for the work the method defines at that number.
- **AC-19-8-7** · Rev: 1 · Proof: plugin/test/stats/runs.test.mjs "the edits line names each route with its calls and characters, and the ships line counts passes, resumes and rejected pushes"
  WHEN a profile is printed THEN the CLI SHALL name each route a run wrote files through with its
  calls per run and the characters a call carried, and SHALL count the passes a landing took, the
  passes resumed and the runs whose push was rejected, each read off the call's own record.
- **AC-19-8-8** · Rev: 1 · Proof: plugin/test/stats/runs.test.mjs "the refusals listing is what this plugin refused, keyed on the line that names the rule"
  WHEN the refusals a window met are listed THEN the CLI SHALL count only a body carrying a line in
  one of this plugin's own refusal shapes, SHALL key the row on the line that names the rule rather
  than on the body's first line, and SHALL count every other non-zero exit on a line of its own
  broken down by the call's class.
- **AC-19-8-9** · Rev: 1 · Proof: plugin/test/stats/marks/marks.test.mjs "a stored reading is the before window, and the screen says where the windows overlap"
  WHERE a stored reading is named as the before window the CLI SHALL compare the current window with
  the recent window that reading holds, through the reader the sliding comparison uses, and SHALL say
  that the two overlap where they do.
- **AC-19-8-10** · Rev: 1 · Proof: plugin/test/stats/corpus/guide-parts.test.mjs "guide parts are a table of their own — calls, runs, runs that read again — and the class table keeps one row"
  WHEN a profile is printed THEN the CLI SHALL list each guide part the window's runs read with its
  calls, the runs that read it and the runs that read it more than once, read off the call's own
  words by the reading the class uses, and SHALL keep the class table's one row for the verb.
- **AC-19-8-27** · Rev: 1 · Proof: plugin/test/stats/runs.test.mjs "one class per shape of work, whatever way it was typed"
  WHEN a call in that record is classed THEN the CLI SHALL NOT read as the place a command
  begins an operator the shell spent as a character of a word — one inside a single-quoted
  span, inside a comment or behind a backslash — and SHALL go on reading one inside the body
  a shell runner is handed.
- **AC-19-8-17** · Rev: 1 · Proof: plugin/test/stats/outcomes.test.mjs "a run is joined to every issue its own claim output granted, and to none a refusal or a quoted line names"
  WHEN a run's work is joined to the issues it owned THEN the CLI SHALL read every ownership its own
  claim calls printed, by either name a claim may print it under, SHALL take the reference only where
  it is the printed line's own subject, and SHALL count a run whose ownership it cannot establish
  apart rather than as a run that owned nothing.
- **AC-19-8-18** · Rev: 1 · Proof: plugin/test/stats/outcomes.test.mjs "each outcome figure prints over its own population, and an empty population is unavailable rather than zero"
  WHEN two windows of runs are compared THEN the CLI SHALL print beside every figure of cost a count
  of what became of the work, each over the population it was counted across, and SHALL report a
  figure whose population is empty as unavailable rather than as none found.
- **AC-19-8-19** · Rev: 1 · Proof: plugin/test/stats/outcomes.test.mjs "an outcome after the run is counted inside one interval both windows share, and a run short of it is counted in neither figure"
  WHERE an outcome is observed after a run has ended the CLI SHALL count it only inside one interval
  both windows are measured over, SHALL leave out a run that has not itself completed that interval,
  and SHALL name that interval in what it prints.
- **AC-19-8-20** · Rev: 1 · Proof: plugin/test/stats/outcomes.test.mjs "the tracker reads of one eval share a request budget, and past it the outcome figures are unavailable while the cost figures print"
  WHILE the readings behind those counts are being taken the CLI SHALL spend no more than one stated
  number of requests for the whole comparison, SHALL count against it every attempt and every lookup
  a request makes, and SHALL go on printing every figure of cost where that number is reached.
- **AC-19-8-21** · Rev: 1 · Proof: plugin/test/stats/marks/marks.test.mjs "a release mark carries its version and head, resolves apart from a count mark at one corpus count, and names what the comparison since it is confounded by"
  WHEN a release lands THEN the release step SHALL hold a reading for that release carrying the
  version and the head it landed at, SHALL hold it under that version so that two releases landing at
  one count of runs are two readings, SHALL keep it apart from a reading held at a count of runs so
  that neither resolves the other, and a comparison read against it SHALL name what it is confounded
  by rather than presenting the difference as one change's.
- **AC-19-8-22** · Rev: 1 · Proof: plugin/test/stats/outcomes.test.mjs "park attribution is resolved over the corpus, so no window size can make an owner of a run the corpus refused"
  WHERE more than one of the runs that owned an issue could be credited with the same outcome the CLI
  SHALL decide the credit over the whole corpus before either window is cut, SHALL credit the outcome
  to no run where more than one is equally placed to claim it, and SHALL disclose it as unattributed.
- **AC-19-8-23** · Rev: 1 · Proof: plugin/test/stats/outcomes.test.mjs "a thread is read whole or not at all: every way a page falls short leaves its records unreachable"
  IF a reading the counts stand on came back without the tracker calling it complete THEN the CLI
  SHALL treat it as a reading it could not take, and SHALL NOT count what it did receive as a
  population it read and found no outcome in.
- **AC-19-8-24** · Rev: 1 · Proof: plugin/test/stats/eval.test.mjs "each outcome figure discloses both windows' coverage, and says which window every reason is about"
  WHEN two windows print a count each THEN the CLI SHALL print for each window what it could not
  read and why, and SHALL say of every such reason which of the two windows it is about.
- **AC-19-8-25** · Rev: 1 · Proof: plugin/test/stats/eval.test.mjs "the tracker read of a named checkout is scoped to the project that checkout declares, not the shell's"
  WHERE the runs read are a named checkout's the CLI SHALL scope its tracker read to the project
  that checkout declares rather than to the one the working directory resolves to, and SHALL leave
  the working directory's scope standing where the named checkout declares none.
- **AC-19-8-26** · Rev: 1 · Proof: plugin/test/stats/outcomes.test.mjs "two names for one issue are one issue: aliased owners compete for its park, and one run owning both is one pair"
  WHERE one issue answers to more than one name the CLI SHALL count it as one issue under every one
  of them, SHALL count one run that owned it under two names as one observation, and SHALL treat two
  runs that owned it under different names as two owners of the one issue.

- **AC-19-8-11** · Rev: 1 · Proof: none yet — ISS-673
  WHEN a profile is printed THEN the CLI SHALL list per wave the time from ready to landed, from
  landed to judged and in total, the batch size, the gate time and lock wait, the reviews and
  verdicts written twice, and the minutes and calls of every actor in the wave.
- **AC-19-8-12** · Rev: 2 · Proof: plugin/test/stats/corpus/guide-parts.test.mjs "the flow is the one that call was served, so a reading does not move when this copy's does"
  WHEN the guide parts are listed THEN each SHALL carry the flow it was rendered for.

- **AC-19-8-29** · Rev: 1 · Proof: plugin/test/stats/eval/angles.test.mjs "--angles names which angles to read, in the order asked, and refuses a name the set does not hold"
  WHEN angles are asked for by name THEN the CLI SHALL read only names the shipped set holds, SHALL
  refuse a name outside it with the whole set, and SHALL refuse a name given twice rather than
  reading it once.
- **AC-19-8-30** · Rev: 1 · Proof: plugin/test/stats/eval/angles.test.mjs "each angle takes its figure and counts its own population off one profile"
  WHEN an angle is read over a window THEN the CLI SHALL count it over the population that angle's
  own entry names rather than over the window's runs, and SHALL carry no figure for it where that
  population is empty.
- **AC-19-8-31** · Rev: 1 · Proof: plugin/test/stats/eval/angles.test.mjs "a shift no further than the floor's p95 is not distinguishable from this corpus's own adjacent windows"
  WHEN a shift between two windows is judged THEN the CLI SHALL judge it against the floor of shifts
  held for that angle rather than against no movement at all, and SHALL report a shift no further
  than that floor's tail percentile as not distinguishable from it rather than as a move.
- **AC-19-8-32** · Rev: 1 · Proof: plugin/test/stats/eval/angles.test.mjs "a floor under the positions a p95 needs withholds the verdict and says how many it had"
  IF fewer adjacent positions of this corpus yielded a shift than a percentile in the tail needs THEN
  the CLI SHALL withhold the verdict for that angle and SHALL say how many positions it had and at
  which two sizes.
- **AC-19-8-33** · Rev: 1 · Proof: plugin/test/stats/eval/angles.test.mjs "a held reading's side is recomputed from this corpus, and its stored profile answers for nothing"
  WHERE a stored reading is the window before this one the CLI SHALL recompute that window's figure
  from the runs this corpus still holds of the span it covers, SHALL take no figure from the stored
  profile however well its fields match, and SHALL say how many of the recorded runs it found.
- **AC-19-8-34** · Rev: 1 · Proof: plugin/test/stats/eval/angles.test.mjs "a mark holds the keys it held before an angle existed, and its write spends no floor"
  WHERE a reading is held for a mark the CLI SHALL store no angle in it, keeping a verdict, a floor
  and the statement that goes beside the verdicts out of every line it writes.
- **AC-19-8-35** · Rev: 1 · Proof: plugin/test/stats/eval/angles.test.mjs "a reading where every angle improved says what it does not measure, on the screen and in --json"
  WHEN the angle verdicts are printed THEN the CLI SHALL state beside them what none of the angles it
  holds measures, on the screen and in the machine form alike, and SHALL state it however few angles
  the call asked for.

- **AC-19-8-36** · Rev: 1 · Proof: plugin/test/stats/corpus/help-reads.test.mjs "a verb's help reads are a table of their own, counted only where that verb serves help, with the class table unchanged"
  WHEN a profile is printed THEN the CLI SHALL list each verb whose help the window's runs read with
  those reads, the runs that read it and the runs that read it more than once, SHALL count a read
  only where the help word stands whole in the verb's own slot or in the slot after its subject, on a
  call this reading classed as one made to it, and SHALL say what share of the calls made to it those
  reads were.
- **AC-19-8-40** · Rev: 1 · Proof: plugin/test/stats/eval/diagnose.test.mjs "a finding cites a run of the set and a call inside it, and one that cites neither is left out and counted"
  WHEN a diagnostic reading over runs the caller named is printed THEN the CLI SHALL report only a
  finding naming one of those runs and a call inside it, SHALL leave out one whose citation names
  neither, and SHALL say how many it left out.
- **AC-19-8-41** · Rev: 1 · Proof: plugin/test/stats/eval/diagnose.test.mjs "the reading says it is not comparable and votes on nothing, and carries no disposition, shift or floor"
  WHEN a diagnostic reading is printed THEN the CLI SHALL state that it is not comparable with
  another reading of its kind and votes on no verdict, and SHALL carry no disposition, no shift and
  no floor of its own.
- **AC-19-8-42** · Rev: 1 · Proof: plugin/test/stats/eval/diagnose.test.mjs "a reply closing on its count and naming nothing found nothing, and one closing on no count is unread"
  IF the answer a diagnostic reading was given does not close on the line its contract asks for THEN
  the CLI SHALL say that answer was unread, and SHALL report a reading that found nothing only where
  that line is there and names none.
- **AC-19-8-43** · Rev: 1 · Proof: plugin/test/stats/eval/diagnose.test.mjs "the runs are the caller's by one of three anchors, and two anchors are refused with both named"
  WHEN the runs a diagnostic reading is taken over are named THEN the CLI SHALL take them by one of a
  count, a window or a list of keys, SHALL refuse a call naming more than one of the three with every
  one it named, and SHALL say which of those runs it read and which of the names it could not.
- **AC-19-8-44** · Rev: 1 · Proof: plugin/test/stats/models.test.mjs "an unreadable --since names stats models in its own refusal, not another subject's"
  WHEN a stats subject reads its own --since window through a parser more than one subject shares
  THEN the CLI SHALL refuse an unreadable one by naming the verb the caller typed rather than
  another subject sharing that parser.

- **AC-19-8-50** · Rev: 1 · Proof: plugin/test/stats/runs.test.mjs "compactions and the runs that met one are two counts, because a run that compacted three times is one run that ran out of room"
  WHEN a profile is printed THEN the CLI SHALL count every compaction the window's runs met and,
  apart from that count, how many of those runs met at least one, so that one run losing its history
  more than once is one run and not several.
- **AC-19-8-51** · Rev: 1 · Proof: plugin/test/stats/runs.test.mjs "an api error is counted apart from a non-zero exit this plugin refused"
  WHEN a profile is printed THEN the CLI SHALL count a request that came back as an API error apart
  from a non-zero exit this plugin refused, the two being different failures the same pass already
  tells apart.
- **AC-19-8-52** · Rev: 1 · Proof: plugin/test/stats/runs.test.mjs "compactions and api errors print as unavailable rather than as a nought where the window holds no run"
  WHERE the window holds no run the CLI SHALL hold the compaction count and the API error count as
  unavailable rather than as a nought found, in the profile and in `--json` alike — the prose screen
  prints no row at all for such a window, the same as every other figure on it.
- **AC-19-8-80** · Rev: 1 · Proof: plugin/test/stats/runs.test.mjs "human prompts and the runs that carried one are two counts, off the reader the stop-check gate uses"
  WHEN a profile is printed THEN the CLI SHALL count, off the same reader the stop-check gate uses
  for a real human turn rather than a second test of what one is, every human-typed turn the
  window's runs carried and, apart from that count, how many of those runs carried at least one.
- **AC-19-8-81** · Rev: 1 · Proof: plugin/test/stats/runs.test.mjs "a run a human prompt showed up inside is named by the issue it claimed, or its own session where it claimed none"
  WHEN a profile is printed THEN the CLI SHALL name each run a human-typed turn showed up inside, by
  the issue it claimed or, where it claimed none, its own session, rather than folding those runs
  into a share.
- **AC-19-8-82** · Rev: 1 · Proof: plugin/test/stats/runs.test.mjs "human prompts print as unavailable rather than as a nought where the window holds no run"
  WHERE the window holds no run the CLI SHALL hold the human-prompt count, the count of runs that
  carried one and the named list of them as unavailable rather than as a nought found, in the
  profile and in `--json` alike.
- **AC-19-8-115** · Rev: 1 · Proof: plugin/test/run/release/run-note.test.mjs "a version step run from a subdirectory names the path it joined, not just the value it read"
  WHEN a release's version step reads a manifest that carries no version THEN it SHALL refuse and
  name the path it joined to read that manifest, not the value alone.
- **AC-19-8-116** · Rev: 1 · Proof: plugin/test/run/release/run-released-version.test.mjs "a ship resumed with --from 7 from a subdirectory refuses a version it cannot read, rather than pushing an untagged release to the remote and saying nothing"
  WHEN a release's push step cannot read the version it is about to publish THEN it SHALL refuse and
  name the path it read, before the branch is pushed, rather than pushing first and reporting a
  release with nothing to publish afterward.
- **AC-19-8-117** · Rev: 1 · Proof: plugin/test/run/release/run-released-version.test.mjs "a release's last step refuses a version it cannot read from a subdirectory, even where the remote already carries the real tag"
  WHEN a release's last step cannot read the version it is to state as published THEN it SHALL
  refuse and name the path it read, and SHALL NOT claim that none was published, since a failed
  local read cannot tell a published release from an unpublished one.
- **AC-19-8-118** · Rev: 1 · Proof: plugin/test/run/release/run-released-version.test.mjs "a ship resumed with --from 7 from a subdirectory refuses a version it cannot read, rather than pushing an untagged release to the remote and saying nothing"
  WHERE a release is resumed past its version step from a tree binding that cannot read the
  manifest, it SHALL NOT report that release as complete, and SHALL leave the remote without that
  release's branch or a tag for it.
- **AC-19-8-119** · Rev: 1 · Proof: plugin/test/run/workspace/start.test.mjs "start prints a ship command that resolves from the worktree it just made, not the checkout"
  WHEN a worktree is cut THEN the command printed for shipping from it SHALL resolve from that
  worktree rather than carrying the checkout's own prefix.

- **AC-19-8-120** · Rev: 1 · Proof: plugin/test/stats/phases.test.mjs "phase 7 opens on the act the contract asks that project for, and the verification record is one of them"
  WHEN a run's calls are cut into phases THEN the CLI SHALL open the shipping phase on any of the
  three acts a landing may be — a command the project declares, the checkpoint that leaves a landing
  for another actor, or the record that verifies the change where it now runs — and SHALL leave every
  call before that landing in the phase the run was already in.
- **AC-19-8-121** · Rev: 1 · Proof: plugin/test/stats/corpus/release.test.mjs "the phase-7 act is the release model's answer, one case per model"
  WHERE the release this project declared reaches production without a command anybody types the CLI
  SHALL count the wait on that deploy and the read of what it reports serving under a class of their
  own, SHALL read which act that phase asks for off the release model the tracker already holds
  rather than off anything a project declares a second time, and SHALL name no such class where that
  model says nothing is released.
- **AC-19-8-122** · Rev: 1 · Proof: plugin/test/stats/eval/latency.test.mjs "an act that moved crosses the deploy row and the rows it displaces"
  WHEN two readings are compared row by row THEN the CLI SHALL carry on each the act that release
  model asked of it, and SHALL take no pair of means over the class that act decides or over the
  classes it takes calls from where the two readings name different acts.

- **AC-19-8-83** · Rev: 1 · Proof: plugin/test/stats/eval/change.test.mjs "1. the isolated population is the runs that began at or after this install and ended before the next"
  WHEN one change is judged THEN the CLI SHALL report the count of runs that began at or after that
  change's copy was installed and ended before the next copy was installed.
- **AC-19-8-84** · Rev: 1 · Proof: plugin/test/stats/eval/change.test.mjs "2. a population with no later installation is said to be open-ended"
  WHERE no copy was installed after the one carrying the change the CLI SHALL say that the population
  is open-ended rather than bounding it at an endpoint no installation stands at.
- **AC-19-8-85** · Rev: 1 · Proof: plugin/test/stats/eval/change.test.mjs "3. every later change installed inside the wider population's span is named"
  WHEN one change is judged THEN the CLI SHALL name every later change installed inside the span of
  the wider population it read.
- **AC-19-8-86** · Rev: 1 · Proof: plugin/test/stats/eval/change.test.mjs "4. a movement is associated with the whole set the population was exposed to"
  WHEN a movement is reported for one change THEN the CLI SHALL associate it with the whole set of
  changes the population that moved was exposed to.
- **AC-19-8-87** · Rev: 1 · Proof: plugin/test/stats/eval/change.test.mjs "5. the size of the set a movement is associated with is stated"
  WHEN a movement is associated with a set of changes THEN the CLI SHALL state how many changes that
  set holds.
- **AC-19-8-88** · Rev: 1 · Proof: plugin/test/stats/eval/change.test.mjs "6. a change whose release carried more than one key names the other keys it carried"
  WHERE the release that carried the change named more than one issue the CLI SHALL name the other
  keys it carried.
- **AC-19-8-89** · Rev: 1 · Proof: plugin/test/stats/eval/change.test.mjs "7. no movement is associated with a single change where the population ran more than one"
  WHERE the population that moved was exposed to more than one change the CLI SHALL associate the
  movement with none of those changes singly.
- **AC-19-8-90** · Rev: 1 · Proof: plugin/test/stats/eval/change.test.mjs "8. each installation moment says whether it is a birth time or a substituted modification time"
  WHEN one change is judged THEN the CLI SHALL say of each installation moment its populations' bounds
  rest on whether that moment is the copy directory's birth time or its substituted modification time.
- **AC-19-8-91** · Rev: 1 · Proof: plugin/test/stats/eval/change.test.mjs "9. a comparison whose bound rests on a modification time is ineligible"
  IF an installation moment a population's bounds rest on is a substituted modification time THEN the
  CLI SHALL hold that comparison ineligible to carry the association.
- **AC-19-8-92** · Rev: 1 · Proof: plugin/test/stats/eval/change.test.mjs "10. undetermined is the answer where no comparison is eligible"
  WHERE no comparison of a change is eligible to carry the association the CLI SHALL answer that the
  association is undetermined.
- **AC-19-8-93** · Rev: 1 · Proof: plugin/test/stats/eval/change.test.mjs "11. each comparison held ineligible says why it was"
  WHERE a comparison is held ineligible to carry the association the CLI SHALL say why it was.
- **AC-19-8-94** · Rev: 1 · Proof: plugin/test/stats/eval/change.test.mjs "12. undetermined is a verdict of its own and carries no shift standing in for it"
  WHEN the association is undetermined THEN the CLI SHALL report it as a verdict of its own rather
  than as a nought, a nil shift or an absent field.
- **AC-19-8-95** · Rev: 1 · Proof: plugin/test/stats/eval/change.test.mjs "13. nothing moved is answered only where an angle returned a verdict and none moved"
  WHEN the CLI answers that nothing moved THEN it SHALL do so only where the deciding comparison
  returned at least one angle verdict and none of the angles that returned one moved past its own
  reference.
- **AC-19-8-96** · Rev: 1 · Proof: plugin/test/stats/eval/change.test.mjs "14. the no-movement answer is worded as no movement past the reference"
  WHEN the CLI answers that nothing moved THEN it SHALL word that answer as no movement past this
  corpus's own reference rather than as no effect.
- **AC-19-8-97** · Rev: 1 · Proof: plugin/test/stats/eval/change.test.mjs "15. the reading states that no comparison it makes supplies a counterfactual"
  WHEN one change is judged THEN the CLI SHALL state that no comparison it makes supplies a
  counterfactual, so that nothing in the reading establishes that a change caused a movement.
- **AC-19-8-98** · Rev: 1 · Proof: plugin/test/stats/eval/change.test.mjs "16. a covariate past its reference p95 holds the comparison ineligible"
  IF a covariate's mix distance between a comparison's two populations is past that covariate's
  reference p95 THEN the CLI SHALL hold that comparison ineligible to carry the association.
- **AC-19-8-99** · Rev: 1 · Proof: plugin/test/stats/eval/change.test.mjs "17. the covariate that held a comparison ineligible is named"
  WHERE a covariate's mix distance held a comparison ineligible the CLI SHALL name that covariate.
- **AC-19-8-100** · Rev: 1 · Proof: plugin/test/stats/eval/change.test.mjs "18. the mix reference is over this corpus's adjacent positions at the two sizes, an absent value counting as nought"
  WHEN a mix distance is judged THEN the CLI SHALL measure its reference over the adjacent positions of
  this corpus at the two population sizes actually being compared, a value absent from one side
  counting as nought on that side.
- **AC-19-8-101** · Rev: 1 · Proof: plugin/test/stats/eval/change.test.mjs "19. a mix reference over fewer positions than the minimum holds the comparison ineligible"
  IF fewer adjacent positions than the minimum yielded a mix distance THEN the CLI SHALL hold that
  comparison ineligible to carry the association.
- **AC-19-8-102** · Rev: 1 · Proof: plugin/test/stats/eval/change.test.mjs "20. a mix reference under the minimum says the count of positions that yielded a distance"
  WHERE a mix reference was built over fewer positions than the minimum the CLI SHALL say how many
  yielded a distance.
- **AC-19-8-103** · Rev: 1 · Proof: plugin/test/stats/eval/claims.test.mjs "21. a claim naming an angle outside the shipped set, or naming no direction, is refused"
  IF a claim names an angle outside the shipped set, or names no direction, THEN the CLI SHALL refuse
  that claim.
- **AC-19-8-104** · Rev: 1 · Proof: plugin/test/stats/eval/claims.test.mjs "22. a claim refused for what it named is refused with what it may name instead"
  WHERE a claim is refused for what it named the CLI SHALL name what it may name instead.
- **AC-19-8-105** · Rev: 1 · Proof: plugin/test/stats/eval/claims.test.mjs "23. a claim is refused where a release reading held for this project already names that issue"
  IF a release reading held for this project already names the issue a claim is about THEN the CLI
  SHALL refuse that claim.
- **AC-19-8-106** · Rev: 1 · Proof: plugin/test/stats/eval/claims.test.mjs "24. a claim the store could not place records that landing could not be established"
  WHERE no held release reading names a claim's issue the CLI SHALL record on that claim that the
  write could not establish whether the change had landed.
- **AC-19-8-107** · Rev: 1 · Proof: plugin/test/stats/eval/claims.test.mjs "25. the reading prints when the claim was written and when the change's copy was installed"
  WHEN a claim is read back THEN the CLI SHALL print when it was written and when that change's copy
  was installed.
- **AC-19-8-108** · Rev: 1 · Proof: plugin/test/stats/eval/claims.test.mjs "26. a claim written at or after that install counts as no prediction"
  WHERE a claim was written at or after the moment that change's copy was installed the CLI SHALL
  count it no prediction.
- **AC-19-8-109** · Rev: 1 · Proof: plugin/test/stats/eval/claims.test.mjs "27. a kept claim is stated to be a prediction that held and no evidence the harness improved"
  WHERE a claim was kept the CLI SHALL state beside it that a kept claim is a prediction that held and
  is no evidence that the harness improved.
- **AC-19-8-110** · Rev: 1 · Proof: plugin/test/stats/eval/change.test.mjs "28. the reading states what none of its figures measures, a phase duration among them"
  WHEN one change is judged THEN the CLI SHALL state what none of its figures measures, including that
  a phase duration is how the work was spent and not whether the result was good.
- **AC-19-8-111** · Rev: 1 · Proof: plugin/test/stats/eval/claims.test.mjs "29. a comparison since a release says which runs its recent side is taken from"
  WHEN a comparison is taken since a release THEN the CLI SHALL say which runs its recent side is taken
  from.
- **AC-19-8-112** · Rev: 1 · Proof: plugin/test/stats/eval/claims.test.mjs "30. an issue key is resolved to the copy that carried it through the release readings held"
  WHEN a change is named by an issue key THEN the CLI SHALL resolve it to the copy that carried it
  through the release readings held for this project.
- **AC-19-8-113** · Rev: 1 · Proof: plugin/test/stats/eval/change.test.mjs "31. an issue key no held release reading names is refused rather than judged over some other population"
  IF no held release reading names the issue key a change was asked for by THEN the CLI SHALL refuse
  the call rather than judge it over a population chosen by default.
- **AC-19-8-114** · Rev: 1 · Proof: plugin/test/stats/eval/change.test.mjs "32. the key that could not be resolved is named in the refusal that reports it"
  WHERE an issue key could not be resolved to a copy the CLI SHALL name that key in the refusal that
  reports it.

### EI-09 — The chat backend

Rev: 1 · Enforces: BR-08, BR-14 · Reached from: `plugin/src/tools/services/chatgpt.mjs`

One turn crosses this boundary per invocation and never a second. The endpoint and the key are this
plugin's own, kept in the configuration directory the tracker's token lives in and written there by
the diagnostic verb, so neither is read off another tool's profile. A local attachment goes to an
upload route of the same backend first and only its address travels with the turn. What comes back
is somebody else's text, and a gateway that echoes a request back may put the key in it, so the key
is struck out of external text before any of it is printed. Why a spent turn hands the decision to a
person instead of asking again is `docs/cli/chatgpt.md`'s.

- **AC-19-9-1** · Rev: 1 · Proof: plugin/test/tools/services/chatgpt/chatgpt.test.mjs "one turn is a tools/call of chatgpt at the configured endpoint, under the configured key"
  WHEN a turn is sent THEN the CLI SHALL send it to the endpoint the configuration names, under the
  key it names, and SHALL send no second turn for that invocation.
- **AC-19-9-2** · Rev: 1 · Proof: plugin/test/tools/services/chatgpt/chatgpt.test.mjs "no endpoint or key: the refusal names the doctor flag for each, and sends nothing"
  IF either the endpoint or the key is unconfigured THEN the CLI SHALL refuse before anything is
  sent and SHALL name what sets each.
- **AC-19-9-3** · Rev: 1 · Proof: plugin/test/tools/services/chatgpt/chatgpt.test.mjs "a key echoed back through the conversation id is struck out of the failure too"
  WHERE text the far side wrote is printed the CLI SHALL strike the configured key out of it first.
- **AC-19-9-4** · Rev: 1 · Proof: plugin/test/tools/services/chatgpt/chatgpt.test.mjs "the upload goes to the origin beside the chatgpt endpoint, never the tracker's"
  WHEN a local attachment is sent THEN the CLI SHALL upload it to the same backend the turn is
  addressed to, and SHALL send the turn only the address that upload answered with.
- **AC-19-9-5** · Rev: 1 · Proof: plugin/test/tools/services/chatgpt/chatgpt-detach.test.mjs "a wait past the cap returns without the answer, names the turn and prints what collects it"
  WHERE the wait in force is longer than one call may hold open, the CLI SHALL send the turn from a
  process that outlives the invocation, SHALL return before the answer exists, and SHALL print both
  the identifier of that turn and the command that reads it back.
- **AC-19-9-6** · Rev: 1 · Proof: plugin/test/tools/services/chatgpt/chatgpt-detach.test.mjs "the answer a detached turn came back with is collected, twice, and then is not pending"
  WHEN a turn sent that way is collected THEN the CLI SHALL print the outcome that turn settled with
  and SHALL cross this boundary no further to do it.
- **AC-19-9-7** · Rev: 1 · Proof: plugin/test/tools/services/chatgpt/chatgpt-image.test.mjs "a call that names no ratio is refused, and nothing is sent"
  IF a turn asking for a picture states no framing or no aspect ratio THEN the CLI SHALL refuse it
  before anything crosses this boundary, and SHALL name both of them.
- **AC-19-9-8** · Rev: 1 · Proof: plugin/test/tools/services/chatgpt/chatgpt-image.test.mjs "the framing opens the prompt, the caller's words sit in the middle and the shape closes it, in one turn"
  WHEN a turn asking for a picture is sent THEN the CLI SHALL carry the saved framing and the stated
  aspect ratio inside the prompt it sends, the ratio as the last line of it.
- **AC-19-9-9** · Rev: 1 · Proof: plugin/test/tools/services/chatgpt/chatgpt-detach.test.mjs "a detached picture is spawned under the action that asked for it, and collects as one"
  WHERE a turn is sent from a process that outlives the invocation the CLI SHALL invoke that process
  under the action the caller asked for.
