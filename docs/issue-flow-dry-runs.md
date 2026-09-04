# The issue flow, run by run

What each dry run under [`issue-flow-contract.md`](issue-flow-contract.md) found, in order. Every
rule a run produced is in the contract; every defect is on a tracker issue; this file keeps only the
account of how each was learned, so a rule's parenthetical "the ninth dry run" resolves somewhere. An
agent working an issue reads the contract and the record, not this.

## First dry run — ISS-1

The defect this contract's own commit gate showed three times in an afternoon was worked under the
flow above, on the tracker as it is, with every payload shaped by hand.

- Eight transitions, each a raw call, and none refused anything: the record held every payload
  because the agent chose to write it. That is the gap the verb closes, and it is the size it looked.
- The payloads with no shape to copy were the confirmation, the decision record, the baseline and the
  per-criterion verdict table. Each was invented at the keyboard, and a second run would invent them
  differently. They are the writes to type first.
- The correction rule fit. The version bump the ship path needs was not in the plan; a correction
  comment before the edit cost one paragraph.
- A criterion that said "the suite passes" had to be judged against the baseline, because one
  failure outside the issue predated it. The criterion should say so: no failure the baseline lacked.
- Codex's one finding was rejected by id with a reason, into the consult log, which the tracker
  never sees. The verdict belongs on the issue as a typed write, so the report reads it from the
  record like everything else, and the log stays what it is: the reviewer's own memory.
- The release note field is an object with a section, and the first write as a string was refused.
  The schema says so, and `forge advance --owed` should quote it before the write rather than after.
- About twenty tracker calls for one small fix. Under the cycle it is eight advances plus the
  payload writes, and nothing else to remember.

## Implementing the verb on the tracker as it is

What the run showed about the record `advance` will read, so the first implementation is not
surprised by it.

- The tracker's own state machine accepted every step, `closed` included. The checks live in the
  CLI and the pre-hook, and nowhere else; nothing on the server refuses. The reach of the guarantee
  is stated under "Every route this plugin sees is the same route".
- The issue has a session field and nothing that writes conditionally on it. The lease needs a
  compare-and-set on that field for the claim and for every write the lease covers, which is the
  tracker's to add.
- The merged mark exists: `mark_merged` stamps the time and writes an audit comment, and its target
  is a label. It has no commit field, so until one exists the commit lives in the mark's note in a
  fixed shape, and `developed` reads it from there.
- Closing stamps the merged mark when it is empty, so a status meaning that no code landed must
  never be `closed`. That is why a disposition lands in `dropped`, which nothing stamps, and why the
  contract needs no second write to undo a mark.
- The release note field is an object of section, user-facing text and technical text. A
  withholding is the `Skip` section with the reason as its text.
- Plan and criteria are plain text fields. A criterion is a line that opens with its number and a
  dot, which is what a verdict names and what the conjunction warning reads.
- Attachments are returned by the full issue read and by nothing narrower, so an evidence reference
  is checked against that read.
- The first write to an issue is refused until this session has been shown that issue's comments, and
  a verb reading the record to decide is not the session being shown it: the refusal carries the
  bodies and the same command is sent again. Only a route that prints them counts as showing them.
- Under the fixed turn hook, a document is recorded by content: reading, touching or naming a file the
  last consult already read at this content records nothing, verified live after the release. A
  verdict follows the same rule, judged by the hash of the criteria text and the commit, not by time.
- An edit and a consult in one shell command run before the hook records the edit, so the consult
  finds nothing. The verb has no such gap: it reads the record when it runs.

## Second dry run — ISS-2

ISS-2 built the typed writes, and its own run was the first to use them: the plan correction, the
eleven verdicts and the release verification went through `forge record`, and the report assembled
itself from them. The confirmation, the decision record, the baseline and the criteria were still
shaped by hand, because the verb did not exist when they were written.

- Eleven verdicts in one loop, each quoting its criterion and citing the same two references, and
  `report` answered "every criterion has a verdict" without anyone counting. That is the check
  `advance` will run for `tested`, already written.
- The evidence check refused a reference to an attachment that was not yet on the issue. The
  invariant it enforces is narrow: what a verdict cites exists before the verdict is recorded,
  whether that is an attachment, a URL or a commit. The report's "owed" line is the checklist.
- Codex found six defects across three rounds, all of one family: an input read and silently dropped
  — a flag from the other form, a trailing argument, a duplicate number, a field written and not read
  back, a verb offered while one of its two tools was gated. The rule for every typed write, and for
  the verb: every input is used or refused, never ignored.
- The tracker fences every field and body it returns in untrusted-data markers. Anything that reads
  the record parses through the fence; `advance` will read the same record and needs the same
  reader.
- A recheck consult in the same shell command as the edit found nothing to consult on, for the third
  time. The consult should fall back to the files changed on disk when nothing is pending; that is a
  plugin defect to file, not a habit to keep.
- The criteria kind, with its conjunction warning, has not run live: ISS-2's criteria were written
  before it existed. The next issue writes its criteria through the verb and is the first test.
- Codex reviewed the code before every commit in both runs, and neither run had a payload for it:
  the review lived in the consult log the tracker never sees. A review record at the boundary into
  `developed` closes that, and it is the write a person's review lands in too.
- About nine tracker calls by hand this run against about twenty in ISS-1. The eight transitions
  are still raw calls, and they are ISS-3.

## Third dry run — ISS-10

ISS-10 added the review record the second run had shown missing, and its own run was the first
where every payload but the plan went through `forge record`: confirmation, decision record,
criteria, baseline, review, six verdicts, verification, release note.

- The criteria kind ran live for the first time. Its conjunction warning fired on two criteria,
  both an "or" listing the values a flag accepts. The author read the warning and kept them: the
  rule is a warning because a lexical check cannot tell two claims from one sentence, and this run
  showed exactly that.
- The first review record was refused: an accepted finding had a reason after it, and the grammar
  codex had just tightened allows none. The refusal was right by the grammar and wrong by the wish
  to note why a finding was accepted. The grammar stands for now; a reason on an accepted finding is
  a decision for the verb's next reader, not a silent loosening.
- Codex's review of the review kind was one finding, and it was about the grammar of findings. The
  record that finding landed in is the first review record on the tracker.
- Nine transitions and one mark by raw call, as before. Everything else was typed. ISS-3 is what is
  left.

## Fourth dry run — ISS-3

ISS-3 built `forge advance`, and was the first issue delegated whole to a second agent working
from this document alone. Five transitions were raw calls because the verb did not exist yet; the
verb made the last four, and refused three times first: at `developed` until a review record named
the merged commit, at `tested` with one line per criterion lacking a verdict, at `closed` naming
`reopen` as a person's word. Twenty-six raw transitions across three runs had refused nothing.

- The drop was real. There was no way to rehearse a park, so the agent ran one to see what it did,
  and a drop before `developed` is legal. The way back was a raw transition and a plain comment,
  which the report never shows, so the assembled record still ends in a drop. Two rules came out of
  it, above: `--owed` covers every move, and a park is lifted on the record.
- The report lied by omission. Four corrections were written and one was reported, because the
  assembly kept the latest of every kind and only verdicts were keyed per instance.
- The review record offered *approved* or *changes requested*, both codex findings had been
  rejected with reasons, and `developed` accepts only the first. The passable value was written.
- Three of one confirmation's *where* values read back as four: the separator between repeated
  values can occur inside one.
- The baseline was a blindfold. The check suite stops at its first failure, the tree has carried a
  known one since the second run, and every later gate had been unrun for three commits; one was
  failing. A baseline that reads *one known failure* is a baseline for nothing after it.
- The read-first gate matched the three older writing verbs and neither of the two that write the
  record now, so the sentence in this document that said the verb satisfies it on the way was
  untrue until the gate was told. ISS-15.
- A test-only addition after `closed` had no route: the resume path shipped without a case, the
  gap was found after every criterion had passed, and the fix went out with a correction record
  because nothing else fit.
- Delegation worked as the contract meant it to: the agent read this document and the record and
  nothing else, and where it stalled the document was thin, not the agent. Each place is now a
  rule above or an issue: ISS-11 to ISS-17.

## Fifth dry run — ISS-4

ISS-4 built the lease and was the second issue delegated whole. Seven of eight transitions were
`forge advance`; every payload was typed. The one raw transition was forced by a wrong refusal: a
*relates* edge to an open issue was counted as a blocker, filed as ISS-19 and now a rule above.

- The first build renewed a lapsed lease for its own holder, and a live test caught the dead run
  writing a payload half an hour after it should have stopped. The lease bullet now says stale is
  stale for the holder too, and a reclaim is a handoff.
- Four typed records were deleted and reposted, two written by a session the fixed build would have
  refused, one mangled by shell backticks inside a value, one saying eight findings where there were
  nine. The report shows none of it. The rule above forbids the deletion and asks for a correction;
  the verb does not enforce it yet.
- Four codex rounds each numbered from F1, and the review record carries F1 to F9 that no consult
  said. ISS-34.
- The read-first gate denied a subagent every write after the subagent had read, and passed a write
  on a read from hours earlier; the route out was the issue's uuid, which is the gate bypassed.
  ISS-33.
- The crash park could not carry the claim history as evidence, so the history went into the reason
  on one line. ISS-35.
- A test left its fixture in a real field: ISS-4's session field still holds a synthetic holder from
  the live reclaim test. Harmless on a closed issue, and exactly the kind of write the rule about
  the live config directory exists for.
- One gate list was widened rather than the code changed: the environment-flag test gained the two
  variables a run's identity comes from. Stated plainly in the run and in the file, because a rule
  that names an incomplete list is the checker being wrong, which the repository's own rule allows.

## Sixth dry run — ISS-32

ISS-32 wrote this plugin's own requirements tree, the first spec the spec verbs (ISS-26 and after) will be
built against, and was the first run to die and resume: the API usage limit killed the agent mid
codex loop, the lease lapsed, and the same agent resumed on the same tree.

- The crash cost one reclaim and one correction. Plan, criteria, baseline and review were on the
  issue and the branch was pushed, so the record was the checkpoint the contract says it is. The one
  piece of run state it did not hold was which codex round the run was in; a fresh agent would have
  re-run the consult. The lease's `next` line (ISS-22) is where that belongs.
- Every transition was the verb's. One refusal could not have been anticipated from any document:
  the plan's two flag lines have an exact wording the verb reads, and only the refusal states it.
  `--owed` should quote the lines before the write; the typed plan (ISS-20) makes them fields.
- The read-first gate read `FR-05`, `UC-05` and `AC-05` as issue keys and denied the plan write, and
  the denied compound command lost the plan file it was writing. ISS-36, which collides with ISS-28's
  citation form the moment criteria join the gated verbs.
- Thirteen codex rounds each numbered from F1; one finding was rejected and the record does not show
  it. ISS-34's strongest evidence yet.
- `--diff` narrowed codex to the uncommitted delta and its truth pass answered *not verified* three
  times. Rule above: the earning recheck runs on the whole set.
- A rebase refreshed every file's mtime, and a consult that merely named three documents recorded
  one as changed. ISS-39, with its mirror ISS-37 and the five-file cap ISS-38.
- Nineteen verdicts took longer than the tool timeout, and five were written without a reason before
  the author noticed the flag is optional. ISS-41 for the batch, the reason rule into ISS-21.
- The first baseline measured nine gates; the base it landed on had ten. The table row said a fresh
  baseline was owed and only the author's memory enforced it. ISS-40.
- A stand-in checker for the tree's nineteen rules found 28 findings on the first pass and none at
  the merged commit; it lives in `/tmp` and is ISS-27's first fixture in all but name. Two numbers it
  measured are recorded beside the rules: the duplication scorer strips table rows, which is where a
  restated rule sits in a spec, and its threshold for documents is wrong for a spec by a factor of two.

## Seventh dry run — ISS-26

ISS-26 built the spec reader and was the first run whose shell died: the temp directory this
repository's own tests had been filling for weeks hit its quota, and every command answered exit
code 1 with no output. The run stopped before its earning recheck and wrote its round-by-round
review to the one mount that still took writes.

- The record was enough, again: the tree was staged, master had not moved, and the resumed run
  reclaimed, wrote a correction and picked up at the recheck. Two rounds and an hour lost, nothing
  rebuilt. What made it cheap was luck, a file written outside the repository; the rule above turns
  the luck into a mechanism.
- The run that died could not say so. It could not park, could not correct, could not release the
  lease. The correction was written by the next run, an hour later, because a person relayed it.
- The review looked like no review for an hour, because the record has approved or nothing. Rule
  above: *pending* with its round. A partial disposition came up twice in one issue, on a finding
  accepted in one half and on two verdicts that pass with a qualification.
- The read-first gate denied a subagent's write two calls after the subagent's read (ISS-33), and
  then denied the uuid route too, because the file being attached was named `ISS-26-…` and a token in
  a path reads as an issue key (ISS-36). Renaming the file cleared it. The two defects compose, and
  neither refusal hints at the other.
- The tests leak their temp directories: 89 prefixes, two runs of the suite left 6198 directories,
  one test file 3234 of them. ISS-42.
- `forge record <kind> -h` answers with a missing-field refusal, so a kind's flags are discoverable
  only from the one-line table. ISS-45. The release note's 500-character cap is the tracker's and is
  documented nowhere; three trims. ISS-46.
- Five codex rounds; the earning recheck ran on all eight files and found nothing. The reviewer
  read the bulk this time because the rule from the sixth run said it must.

## Eighth dry run — ISS-22 and ISS-44

One agent worked the lease's `next` line and holder identity, then the worklog and `forge resume`,
two issues in sequence with its context intact. Every payload was typed and every transition but
one was the verb's.

- The one raw transition was ISS-19 again: a *relates* edge to an open issue counted as a blocker
  at `in_progress`, the second run to pay for it. The tracker sends `gatesDispatch` on every edge
  and the check ignores it; the fix is one filter. ISS-19 moves to the front of the queue.
- `forge resume` on its own issue, judged by its author: one screen, a stranger could continue,
  and four things missing. It headlines three record kinds and never says twenty more payloads
  exist or where they print; the latest correction hides the earlier ones; `touched` was empty
  because the capture ran after the merge; the `next` line was rightly cleared at `closed`. The
  first two are ISS-47, the third is the rule above.
- Both review records say `F1 accepted` for reviews of four and nine rounds, six and seventeen
  findings, one rejected and re-accepted, one re-raised. A correction beside each is the only
  honest record of the escalation; ISS-34 owes the grammar and until it lands the correction is the
  route, said here so no run has to discover it.
- A decision whose text began with the literal `--next` was refused as a flag with no value. The
  parser is right; the constraint belongs in the verb's help (ISS-45).
- A refused `--fields` name offers no route out, three times in a row. ISS-48.
- The agent's own fixtures removed their temp directories and proved it; the rest of the suite left
  244 in the same run. ISS-42 stands.
- The read-first gate now credits `forge resume` as a read of the first page of comments, and says
  when more exist. A gate satisfied by a partial read is a seam; ISS-17's cursor is what closes it.

## Ninth dry run — ISS-49

One agent turned on the directory-width check and moved most of `plugin/src`, `plugin/test` and
`plugin/hooks` into responsibility-named subdirectories: no behaviour change, eighty renames, four
commits, 3.32.1. Every payload was typed and every transition was the verb's.

- The contract had no shape for "the same code, elsewhere". The agent invented identity evidence —
  the export surface diffed, the test count held, history reaching each file — and it is now the
  rule above.
- Four of eleven criteria were properties a program can decide; three became checks in the tree and
  one stayed prose because nothing resolves a `Proof:` path in the spec (ISS-53). The rule above says
  a decidable criterion ships as a check.
- Six consults, all clean, and the recheck verb was unreachable: it refuses when no finding was
  logged. The earning read was two whole-file passes named as such in a correction, which the rule
  above now allows; ISS-51 owes the verb.
- The evidence file was attached twice under one name after a section was appended, and ten verdicts
  cite the name. ISS-55; the rule above says an amendment takes a new name.
- `git add -A docs/` passed the bash guard and staged the untracked file the brief had forbidden;
  the agent caught it in the commit's file list and amended. ISS-50.
- The read-first gate refused `forge plan` twice after the comments had been listed, because a
  subagent's read is invisible (ISS-33); the same gate never looked at `record`, `advance` or
  `claim`, which write the record now (ISS-57, blocked by ISS-33).
- The brief handed the agent the claim's `--pushed` flag with a head after it, and the flag takes no
  value; the CLI was right. A brief is a document too, and a form in it that the verb refuses costs a round.
- The agent's correction record said the rechecks ran on whole files when the consult sent diffs and
  the reviewer read the files itself; the agent posted a comment correcting its own record. Honest,
  and the second time a correction has needed a correction.
- Moving a file one level deeper broke four modules that each count `..` to the plugin root (ISS-52).
  The gate's out-of-scope crash and its split output streams are ISS-54; a
  round lost to `git_diff` with no path is ISS-56.

## Tenth dry run — ISS-19 and ISS-43

One agent fixed the edge-kind filter (3.32.2) and built the reopen: a finding and a triage as typed
records, the fall routed by the triage's outcome, the person's look owed before `released` when the
outcome is user-facing (3.33.0). Twenty-three criteria, twenty-three verdicts, two `--owed`
refusals and both right; seventeen consult rounds on the second issue.

- The reopen could not be rehearsed: a finding needs a person's words, and quoting words nobody
  said is a false record. Proven by tests and a probe against the installed copy instead. The rule
  above says so, and the flow table now has the `reopen` row the reader was missing.
- Three new rules read the record's order — a correction since the triage, a verdict later than it —
  and the contract had named presence, recency and commit as the only checks. Order is the fourth,
  above. The stamp a repeating kind carries is a rule too.
- The read-first gate refused three writes after the reads it named had run, once after the exact
  command it printed. The mechanism is now confirmed on ISS-33: the gate reads the parent
  session's transcript and a delegated run writes its own, and the uuid form steps around the gate
  because it carries no key. ISS-57 takes both.
- A rejected finding, refuted by the reviewer's own verify pass, had nowhere to live but a
  correction beside an approved review; seventeen rounds read as one line. ISS-34's grammar owes
  both, said there.
- The shape reader judges every payload against today's shapes whatever contract number its tag
  carries; the first bump would re-judge years of records. A tripwire in the tests forbids the
  bump until the reader is versioned. ISS-60.
- FR-05 has no clause for the edge kind, names two plan lines where there are now three, and no
  use case for the reopen. The spec catches up through an issue, not the run that built it. ISS-61.
- `--owed` on a reopen with nothing decided names the landing status as next; the owed list is
  right. A message defect, folded into ISS-45 with the other refusals that say more than they know.
- No verb releases a lease, so a closed issue reads as held for the rest of its window. On ISS-7.
- A criteria renumber has no checker: six criteria were repointed and a gap found by reading.
  Open; a verdict quotes the text it judged, and nothing yet compares the quote to the field.
- The brief said "files under 500 lines" and the checker counts code lines; the agent read the
  prose as a rule the repository states. It is the brief's sentence, not the repository's, and the
  brief now names the checker's measure.

## Eleventh dry run — ISS-57 with ISS-33

One agent rebuilt the read-first gate so it does the read itself, resolving two issues on one branch
(3.34.0): a write verb lists the issue's comments, an empty list passes with one line, comments this
session has not been shown come back inside the refusal, and what was shown is remembered on disk
per session and issue. Twenty-two verdicts, no `advance` refusal, six gate denials each cleared by
re-sending the same command.

- A delegated agent's shell carries the parent session's id: measured from the hook log and the
  state file, and it is the one fact that makes the disk state work for both. The transcript scan
  is gone and a test keeps it gone.
- The batch had no identity on the record: every shared payload was typed twice with the same
  commit and evidence, and a divergence between the twins would have been noticed by nobody.
  ISS-64.
- Recording a finding on an issue nobody is working meant taking its lease and leaving a next
  line that is a lie; the parent did the same four times folding the tenth run. ISS-63.
- The merged mark's audit comment is a comment the tracker wrote, so the next write to that issue
  is refused once with it; a comment created through an MCP client directly is not credited either.
  Both are now said in the mechanics, so the first refusal reads as the rule and not a bug.
- The tracker's token expired mid-run. The agent told the credential apart from the transport, sent
  the live token nowhere but the tracker, probed with a fake one under a temporary config, stopped,
  and resumed the same write once the person replaced it. Meanwhile two verbs answered from local
  state and read as live; on ISS-45 with the other messages that say more than they know.
- ISS-15 was already met by this change and was dropped as already fixed through its confirmation,
  not closed; the one case its wording would have caught that the new gate does not is a client
  with no hook installed, which no plugin-side check reaches.
- FR-10 now describes a gate that no longer exists; the catch-up is on ISS-61 with the FR-05 one.
- A flag no verb takes is kept silently with its value, so a misspelt flag lands a payload missing
  its field. ISS-62.
- Across eleven runs the hook log holds about 450 gate denials and 374 tool refusals inside
  consults. Most protect something; a class of them names a next command the CLI already knew —
  renew the holder's own lapsed lease, credit the mark's comment, attach the evidence a verdict
  names, default a tool's path — and costs a round for nothing. ISS-65 owes those and a check that
  every refusal names a route the CLI has.
- Whether a session runs the checkout or a cache copy is disputed by the evidence: the marketplace
  record says the install location is the checkout, the install record names a cache path per
  version. The agent's gate fired live from the checkout because the CLI half of it runs from the
  binary on PATH. Until measured from inside a fresh session, a hook change still owes a restart.

## Twelfth dry run — ISS-59

One agent built the filing lint (3.35.1) on every route a filing arrives by, including the payload
`forge call` reads from a file or stdin where a hook watching the command line sees nothing; what it
refuses and the three routes a small change takes are the how page's. Twenty verdicts, three reviews for three heads, thirteen consults with eleven
findings folded and two rejected on the record, no `advance` refusal past the first per status.

- The gate did not get an eleventh file: both hook directories held ten, so the shape check went
  into the read-first gate, where a filing refused owes no comment delivery, and its second argument
  into a topic page because the how pages are capped. A width limit shaped the design and the
  design is better for it.
- The mark is a line in the description and not a label or the complexity field, ruled out on
  evidence: the tracker creates no label it was not given and this projection cannot read the enum
  back. The undo is on the record; the day the tracker owns a size, the line goes.
- Forty-seven of seventy open issues would fail the shape they were filed without. Nothing
  re-lints them; a filing is judged once, at the filing, and the record of an issue written under an
  older rule is judged by the payloads it earns.
- The release at 3.35.0 was a no-op: the cache is keyed by version and the version was already
  installed, so the probe cited the old code. The bump is its own commit and says why.
- Three worklog captures after the fast-forward recorded base equal to head and no touched set,
  silently, as the eighth run had. The capture now owes a line (above, and ISS-65).
- The verdict loop typed one commit and one evidence name twenty times; the merged mark already
  holds both. ISS-65.
- The gate's cost went from zero tracker calls to up to four serial ones in this change, and one run
  in sixteen outlived its registered budget on a rate limit, passing unlinted with the reason on a
  stream the session does not show. The failure rule is now written above; ISS-36 owes the budget.
- `forge new --into` writes a comment through a verb the read-first table does not list, so a
  finding posted that way took no lease and was read by no gate. ISS-36.
- A `-h` on a record kind answered with a refusal for a missing field: ISS-45, live again.
- The contract's own payloads have the failure the filing lint fixes: a confirmation with no
  finding or a criterion nobody can decide is accepted whole and judged only at the transition.
  ISS-73 gives `forge record` the same reader.
- A token expired four times in one run and the run had nowhere to put what it learned while the
  tracker refused; it went to a file and was folded back after. The feedback folder is that place
  for other agents; for this one the file was right.
- A verification on a deployed host with no credential on record was reported from another
  project the same day: eight rendered-state criteria unjudgeable, routing evidence standing in.
  ISS-72 asks for the credential where the deploy path is discovered, or names the fallback.

## Thirteenth dry run — ISS-66

One agent gave `forge guide` a disposition of its own (3.35.2): a table in code names, per guide
slug, the rules the contract replaced and what replaced them; the list withholds those, the slug
answers from the table, `--tracker` returns the tracker's text as the tracker's, and two guides pass
through under a first line withdrawing the half that is not this plugin's. Twenty verdicts, three
`advance` refusals all correct, one read-first denial on the mark's own audit comment, seven
findings posted on other issues through `--into`, none on this one's lease. No hook file changed.

- Contradiction is meaning: `forge doctor` reports the two halves a program can decide — a table row
  the tracker no longer serves is a finding, a served slug the table never saw is a note dated to the
  review — and judges no guide's fit. The replacement paths are checked by the suite, where this
  repository's documents are on disk to resolve against; the installed copy ships `plugin/` alone.
- A guide that is simply not this plugin's has an empty replacement and a line that says so; codex
  raised it as a superseded row with nothing after it, and refuted itself on recheck. The rule was
  the issue's own.
- A stray `--skip` note in a tidy-up command replaced the earned release note of a closed issue, and
  three corrections written read back as one. Nothing warned. ISS-74 for the refusal and the
  side-by-side; ISS-11 for the count, which already asked.
- The agent wrote a review naming a finding id no consult had raised, and corrected it. ISS-73's
  reader would have refused the write.
- Two routes for a finding on someone else's issue carried opposite rules; the contract now names
  `--into` as the finding-only route and the lease as the mover's. ISS-63 keeps the refusal.
- "Verified against the installed copy" was true in a narrow sense: the `forge` on PATH is the
  checkout, so the agent invoked the cache copy by absolute path and said so. The verdict rule above
  now asks for the path. ISS-71.
- A recheck recorded *accepted* over the author's rejection; on ISS-34. Three `--fields` names the
  help offers were refused live; on ISS-45. Six decisions read back as seven; on ISS-14.
- Every entry check refused with the exact command that clears it, and every refusal cleared on the
  next write. Thirteen runs in, that half of the contract has stopped producing findings.

## Fourteenth dry run — ISS-67

One agent made a typed record survive a project whose prose language rewrites every comment
(3.35.4): a payload travels as a fenced block keyed by flag with a tag outside it, the reader keys on
the flags and still reads the bullet form older builds wrote, a record it cannot read is named as
rewritten in one item, and a record verb in such a project says at the write that the stored copy
will be rewritten. Six verdicts, five review rounds, nine transitions with no wrong refusal; the
pre-fix behaviour reproduced live at the base commit on a real rewritten body. This was the first run
driven through the issue-flow skill rather than a brief, and the first with a section on where the
skill fell short.

- The skill never said a status is earned by a payload. Its Phase 1 named the claim and no other flow
  verb, its Phase 5 asked for a prose QA comment where the contract wants one typed verdict per
  criterion, its verification reference took a baseline from a gate that stops at its first failure,
  and its clarify reference would have parked this very issue as a wire-format change. Thirteen runs
  under briefs had hidden all four; the agent fixed each on the branch. What the staged ladder is when
  a terminal is the caller is larger than a sentence: ISS-76.
- Master moved under the agent when the parent released the feedback rule from a worktree. The
  rebase dropped the agent's identical version bump as already upstream and nothing went red; the
  agent caught it in the log. The rule above; the finding on ISS-71.
- The CLI's own write boundary was the rewriter: the plan's three declarations and every field label
  went through it, so `approved` could never be earned in such a project and every read-back
  mismatched. Both folded as adjacent blockers, with the write reporting the copy it actually sent.
- The tracker caps a release note's technical half at five hundred characters and says so with no
  route; on ISS-46. `--fields status` is refused on the one field every verb prints; on ISS-45. A
  recheck after a rebase finds no consult to recheck and names no route; on ISS-51.
- The read-first gate refused the first write once with the bodies inside, as designed, and the
  skill says nothing about it, so a fresh agent reads the rule as a failure. One sentence in Phase 1,
  shipped with this fold.
- The installed skill text changed and the running session kept the old wording: the agent saw its
  own edit absent from the skill body it was re-shown. A skill edit is not a hook edit and owes no
  restart, but it reaches only sessions that load the skill after it.

## Fifteenth dry run — ISS-65

One agent removed the rounds the CLI used to charge the agent (3.35.7): a payload write by a lapsed
lease's own holder renews the lease and says so, the merged mark's audit comment is credited by the
write that caused it, a verdict's evidence is uploaded and cited in one call, `record` and `advance`
read the record themselves, and a check in the tree fails when a refusal names a route the CLI does
not have. Twenty-three verdicts, a refusal rate measured from the hook log before and after, and the
first run cut twice by a provider incident and resumed from the record each time.

- The issue's own verdict loop crossed the tracker's two-hundred-comment page. Past it `advance`, both
  record defaults and the evidence upload refused, each correctly and none naming the others, and the
  last three statuses moved by hand. The route is now written above; ISS-17 closes the seam. A
  thoroughly worked issue outgrows its own flow, and nothing warned before the page was full.
- The recheck loop had no terminator: eleven whole-set rounds, the last arguing whether a valid URL
  may be rejected by `fetch`. The rule above ends it; ISS-77 owns the harness that made it so.
- The refusal rate is a floor: two gates answering one attempt inside a second count once. ISS-75
  owes the attempt id.
- Three verdicts cited a section of an attachment that stopped one section short; the section lived in
  a later copy. The agent found its own defect re-reading the record and re-sent the three with the
  cause. ISS-73's reader gets the line.
- A release commit at 3.35.6 was never installed; 3.35.7 is. Two bumps for one change, the first
  unproven, which the version-mark rule above already names.
- Two compactions under a provider incident lost the early refusal text; `advance --owed` recovered
  the state and nothing recovered the record of how it was reached. The hook log holds every refusal,
  which the report could have read; ISS-75's payload is where that belongs.
- Routing a finding to another issue cost a lease each time and overwrote four issues' next lines,
  ISS-70's among them. The finding-only route is `--into`; the skill now says so, and ISS-63 still
  owes the refusal that names it.
- The known check failure that agents were told to step around for a week was an untracked scratch
  file in the parent's care. It is out of the tree, and `npm run check` is expected to run to its end
  for the first time since the ninth run.
- The hook log's own view, `forge hooks --rounds`: the session that ran this work sat at one point one
  six refusals per refused write, against six point five for a session on the MCP route with twelve
  refusals of one tool. The five changes were sized against that row.

## Sixteenth dry run — ISS-78

One agent moved the contract into the plugin (3.35.9): the file lives under `plugin/guides/`, the
`docs/` path is a pointer, `forge guide contract` prints a table of parts with a size and a command
each, `forge guide contract <status>` prints one part off disk with no tracker call, every replacement
route in the guide table names that verb instead of a checkout path, `forge advance --owed` ends with
the line naming the part for the status it would enter, and `forge doctor` reports a copy whose
contract file is missing, unnumbered or from another build. Twelve criteria, eight of them checks;
the second agent to run in a worktree, alongside ISS-70.

- The contract states its own number on its second line and the build reads it: two `CONTRACT = 1`
  constants had been living in two modules, and the fold gave the number one home.
- Codex caught a heading pattern that contradicted its own comment and a version range that would
  have passed an older file silently once the number moved; both folded, each with a test that fails
  without it.
- `closed` and `dropped` share one part, `released` earns a hundred and ninety characters, and the
  mechanics are seventeen thousand behind one address. Served by stage, the shape of the headings is
  the shape of the read; the mechanics now carry subheadings, and the terminal pair stays one part
  because the reopen table is the same for both.
- The skill cited the contract nowhere, which is the whole reason a brief had carried it; Phase 1
  now sets the read-at-the-stage discipline, and Phases 2 to 4 get their citations with this fold.
  `references/plan.md` never named the plan's machine lines the contract requires.
- A `git pull` that rewrote a file to the same bytes cost its verdict, and `--drop` then called the
  file unconsulted; on ISS-70 as a distinct finding, which content rather than whose file.
- `forge doctor` called a cache copy running and installed on the version alone while its skill text
  was three paragraphs older than master's at the same version; on ISS-71.
- No verb releases a lease, so a closed issue keeps a live holder for thirty minutes; the gate
  delivered the tenth run's identical finding inside the refusal of the duplicate, which is the gate
  doing its job. ISS-7.
- The learning gate held a command whose only mention of a skill was a `grep` of it before a redirect
  elsewhere, and the deny lost twelve unrelated appends. Written to the feedback folder before the
  workaround, under the skill's own rule; ISS-81.
- The brief said to probe a worktree's copy with `node …/bin/forge`, and the wrapper is a shell
  script. The brief was wrong and is fixed.
- The running session's skill copy stayed at the prior version while the agent edited the file, so
  the spine it was served differed from the one it wrote. A skill edit reaches only sessions that
  load it after.

## Seventeenth dry run — ISS-70

One agent scoped the codex-second gate to what a commit stages (3.35.10): the demand is the
record's documents intersected with the staged set, in the tree the commit names, whether by
`git -C`, an inherited `cd` or the shell's cwd; `forge codex pending` prints the same demand through
the same function; the refusal names the root, the staged paths, the consult line as it can be sent,
the unread discard and the escape that actually reaches a hook. Nine criteria, seven whole-set
rounds, no `advance` refusal, and the first run alongside another agent from start to finish. A hook
file changed, so the session owed a restart before the next agent.

- The gate denied the agent's own first probe in a scratch repository, judged against the parent
  checkout's pending documents: the defect firing on the person fixing it, and the run's best
  evidence. The one shape that still misfired after per-root keying was a `cd` into the worktree
  followed by the commit in the same call, which is exactly what a shell whose cwd resets between
  calls produces.
- Measured on a shared checkout with five hundred and twenty recorded files and two staged: the
  refusal names two. The commit half is closed; the write branch still walks the whole tree and past
  five hundred paths answers with the present moment, which no consult can beat. ISS-82.
- The agent typed a sha from memory into the merged mark and read the real one afterwards; a second
  mark corrects the first, and the released verdict cites the real hash. A sha is read, never typed:
  the rule is now written.
- A probe pointed at a path that did not exist printed no decision for eight cases and read exactly
  like a gate standing down. The verdict rule now says a probe that cannot find its subject fails.
- The Skill tool served this run the skill copy pinned at the parent session's start, three releases
  behind the tree: none of the fourteenth run's fixes were in the text the agent read. Every run
  since the skill-first change ran on the old skill. A skill change owes a restart before the next
  agent as a hook change does, and a dry run names the skill copy it ran. On ISS-79.
- `--recheck` overwrote recorded verdicts twice, once replacing a reasoned rejection with accepted;
  the review grammar has nowhere to name the consult a finding came from. ISS-34.
- The escape the refusal offers says "for the session" while `forge hooks --off` writes to the
  account config and covers every project and every parallel agent, with no `--on` named. ISS-45.
- A second release note replaced one the status already stood on, at `tested`. ISS-74. The
  installed copy has no `plugin/` inside it: the versioned cache directory is the plugin. ISS-71.
- No route existed for a defect found in what was just shipped once the issue is closed; the agent
  chose the nearest open issue and a note on the closed one saying where. The contract now says so.
- The skill's cleanup and evidence rules pulled opposite ways with nothing saying which artefacts
  outlive the run, and Phase 5 read the criteria back without asking whether a criterion was true: the
  agent's ninth criterion carried the error its code then shipped. Both get a sentence with this fold.
- Folding this run, the parent's own write of this section was refused by the new gate: the heredoc
  quoted a commit command as prose, and the gate read the command string whole. On ISS-82.

## Eighteenth dry run — ISS-79

One agent moved what a brief carried into the repository, the CLI and the record (3.35.13 to
3.35.15): `tools/run.mjs start` cuts the worktree and names the wrapper a probe must invoke, `ship`
runs the nine release steps and stops at the first failure with the step that resumes it, two record
kinds `routed` and `gap` carry a finding sent elsewhere and a place the method fell short, the report
closes with the run's own worklog, and the worklog names the plugin copy the record was typed under.
Fourteen verdicts, 29 records, the script proving itself on the issue's own three releases; the brief
template is now a launch line and a table saying where each removed paragraph went. Ran in parallel
with ISS-77 from start to finish.

- Four of the brief's six CLI gotchas no longer reproduced and were still being obeyed three releases
  later. A brief is not a second copy of the method; it is a stale one.
- The page is cut by response size, not by count: 29 long comments came back truncated, the verdict
  verb refused with a count it never measured, the report read the most recent 29 and said the first
  200, and `advance` refused `--owed` with everything else. The record report is missing the run's
  Confirmation and Decision records, which are past the page: the fold-from-the-record design has
  the ceiling ISS-17 owns, and hit it on the first run to rely on it.
- A plan refusal read a bolded label as a missing line, and said missing when it meant unparsed. The
  rule above; on ISS-45.
- A fabricated sha of thirty-nine hex digits passed the commit validator and sat in a review record
  until the agent read it back; corrected with a second record. The check goes to ISS-73's reader.
- Three lines of the brief cannot move: which other agents are running and which paths they hold,
  the recheck escape until ISS-51 closes, and the one rule that is about neither the repository nor
  the tool. Two things the launch line still cannot carry: whether a restart is owed, which lives in
  prose, and the older half of its own record, which lives past the page.
- The agent's shell died mid-routing and four writes went unmade; the cause was the machine's `/tmp`
  over quota, which killed the parent's shell too an hour later. The agent's own new test leaks
  temporary directories. ISS-42.
- Five gaps typed as `gap` records: the spine never says where a branch lives or how a change
  reaches the copy the next session loads; the learning test has no moment for a gap met mid-run;
  Phase 5 has no shape for evidence that a refusal fired correctly; nothing tells a run which paths a
  concurrent run holds; which kinds owe evidence lived in a check and is now a field.

## Nineteenth dry run — ISS-77

One agent made the codex harness read its own log (3.35.16): a budget the payload earns, with a
call more per clipped part and one fewer for a bodies pass; a review whose reply says it could not
check is retried up to a ceiling before it is shown; a recheck sent the earlier findings, the diff
since the head they were made against and the reviewer's own prior reply, asked to answer the list
and stop, with a New finding allowed only beside a clause naming why the earlier round could not
have seen it; effort by round and size; a versioned system prompt logged with its digest;
`forge codex stats` over a window and `forge codex replay` for the rows git can rebuild byte for
byte. Fifteen verdicts, eight defects in its own change found by codex and folded, and a table of
before and after that names its own counter-result. Ran in parallel with ISS-79 throughout.

- Rechecks raising a New finding went from a hundred and one of two hundred to none of three;
  replies that could not check from forty-three in a hundred to one of six. Six rows settle no rate;
  they settle that each mechanism fires.
- The counter-result: the recheck clause went into the system prompt, so a pass and a recheck send
  two system texts and the provider's prefix cache diverges at the front of the request. Two of
  three rechecks read nothing from cache. Filed as ISS-83 rather than patched under a released
  version; the remedy is the clause in the turn below a prefix both kinds share.
- `cache_creation_input_tokens` is zero in every one of five hundred and three prior rows: the
  explicit cache control has never been honoured by this gateway, and what reads is automatic prefix
  caching, whose front is the tool list.
- Three defects were visible only to a whole-change pass after two file-scoped rechecks had cleared
  the same bytes, and one of them broke the statistic the issue exists for. The contract's rule that
  the earning review runs on the whole set is the rule; the run shows what it costs to skip.
- The log keeps each sent file's digest and never its bytes, so the issue's "last thirty consults'
  inputs" is unreachable: two of thirty rebuild. Replay refuses a row it cannot rebuild and says why,
  rather than replaying approximately.
- The plan was refused for want of `Screen change` and `Schema coupling` lines, and the contract part
  the plan reference sends a reader to did not name them. The literals are now in the `approved`
  part; the reference was pointing at a promise.
- A review over three consults has three findings called F1 and the record has nowhere to say which
  consult; four dispositions went to a comment. ISS-34 owes the grammar, and ISS-73 got the note.
- The agent's shell died with the parent's when `/tmp` ran out of quota, and the run's one red check
  was that outage, not a gate. Two record artefacts name stale numbers taken before a rebase and a
  bump, disclosed in the report; the verdicts and the mark name the released commit.

## Twentieth dry run — ISS-71

One agent made the link on PATH a dispatcher (3.35.18): reached through the symlink, `forge` and
`vi-natural` run the checkout when the working directory is inside one that ships a plugin of their
name and the newest installed copy everywhere else; a wrapper invoked by its own path runs its own
copy; a throw escaping the checkout copy's load names the copy that ran and where the installed one
is; `forge doctor` says which copy a call from here would run and why. Eleven verdicts, the first
run launched from the one-line template with no brief, and the first folded from `forge record
report` alone. The run ended in a park, not a release: the plan declared a user-facing outcome, the
change is machine-wide, and the contract sends such a change to a person before `released`.

- The fold from the record works and has the ceiling the eighteenth run named: the report opened
  with "more than 200 comments match", on an issue with far fewer, cut by response size. The agent
  wrote the same finding to the feedback folder; ISS-17 already carries it.
- The first release through `tools/run.mjs ship` left two things behind: a commit subject naming a
  version the script did not take, because the note was written before the number was computed, and
  the worktree and branch, because the script has no removal step and the launch line no longer
  says to remove them. ISS-88.
- A reviewer's finding widened the touched set: the vi-natural entry's main-module guard compared a
  URL by string concatenation, so a path with a space or a hash ran nothing and exited zero. Older
  than this change, fixed here with a criterion the reviewer sharpened.
- A review over three consult rounds cannot be typed on the record, since every consult numbers
  from one and an acceptance carries no reason; the agent typed round one and posted the rest.
  ISS-34, again, now a `gap` record rather than a paragraph in a report.
- `advance --park screen-review` could not carry the tracker's `waitingKind`, and the park cost the
  rounds ISS-68 already describes.
- The agent posted a correction onto ISS-80 through the finding-only route: the attach refusal did
  not abort the whole batch, the first file had already landed, so a retry re-attaches a name.

## Twenty-first dry run — ISS-82

One agent bounded the write half of the codex-second gate and taught the tree reader to read git's
options the way git does (3.35.20): in a tree past the walk cap the gate asks about what the record
names and nothing else, so a checkout carrying five hundred and twenty dirty paths passes a write when
the record is empty and refuses it naming only the recorded file when that file is newer than the last
consult; a repeated `-C` composes, an absolute hop replaces what preceded it, a relative work tree is
read from where the chain left the command; a call closing in two trees names the one it judged and
says the other went unchecked. Thirteen verdicts probed against the installed copy, no `advance`
refusal, three issues filed on the way and one gap typed. A hook file changed; the session owed a
restart before the next agent. Folded from the record.

- `git stash` is one stack for every worktree of a repository. Two agents each stashed and popped
  and traded their work; the recovered patch went to the holder issue, then turned out to be
  superseded because the work had reached master on its own. `CLAUDE.md` asks for the red case and
  left how to produce it to the agent, and two agents reached for the same stack. The contract now
  says: a second tree at the base, or the file checked out from the base and restored after, never a
  stash.
- bash-guard judges a destructive git command against the event's directory and does not read a
  `cd` earlier in the call, so a worktree's command is judged by the wrong tree. ISS-86.
- The commit refusal offers a consult command naming six files, and a consult clears only what it was
  given, so a record over six costs one consult per six. ISS-91, raised by codex against the change.
- A shell metacharacter inside a quoted argument opens a command position, so a call writing about a
  commit is judged as making one; twice in this run, and the parent met it two runs earlier. ISS-93.
- Two release commits in the same hour carry subjects naming the wrong version, one per run through
  the ship script; ISS-88 is the fix and both stand on master unrewritten.

## Twenty-second dry run — ISS-85

One agent made a withheld guide not there at all (3.35.21): the list carries the contract and the
guides the table holds no row for, closes on the last of them with no count, and a held slug answers
exactly as an unknown one, without asking the tracker for it; a near-miss typo of a held slug is offered
no held slug; no help form and no refusal names the maintainer's flag; `docs/FORGE-CLI.md` states once
that doctor is the only surface allowed to name what a copy or credential cannot use. Fourteen verdicts,
ten cases red against the pre-change source, doctor's findings byte-identical before and after. The user
amended the issue mid-run and the agent took it as a correction before the plan. Parked at `tested` for
a person to read the wording; the parent read it and answered on the user's standing word. Folded from
the record.

- The tracker renamed a guide between two runs, and doctor said so at once: a table row the tracker
  no longer serves and a served slug nobody has read. ISS-89 owes the row; until then the renamed
  guide, half of it the runner's, is listed as one the plugin stands behind.
- The maintainer's route to a hidden guide's own text moved off the verb and has no home yet; doctor
  is ISS-71's file and the finding went there.
- Two release commits from two runs in one hour carry each other's version in their subjects, a
  concurrent ship taking the lower number between the note and the push; ISS-88, again.
- The park for a person's reading, on a change whose wording the person had dictated, cost a round
  and a hand transition past the page; ISS-90 is where a project says it does not want the park.
- Three feedback notes, each already carried by an open issue (ISS-17, ISS-68, ISS-88): the notes
  confirm and add nothing, which is what a folder read daily should mostly find.

## Twenty-third dry run — ISS-90

One agent made the park before `released` the project's answer (3.35.22): the flow reads the tracker's
project config — the staging branch, the production branch and whether production deploys go without
being asked — where it reads the plan's declarations, and only where the plan declares one; a release
onto staging, or on a project that deploys its own production branch, does not park; the verification
carries one derived line saying which, in a field no flag can supply; where the policy cannot be read
the park stands; doctor prints the three beside their sources and reports a production deploy set
beside a branch held as null. This project's config now says automatic production deploy, set on the
tracker as part of the change, and the run's own release is the proof: a plan declaring a user-facing
outcome earned `released` with no person's comment. Thirteen verdicts against the installed copy,
codex approved at the first round with one finding rejected on the code, no restart owed. Folded from
the record.

- The user's two amendments arrived before the plan and were taken as the plan: nothing new in
  `.forge.json`, the tracker's own columns read instead, and `baseBranch` called the staging branch
  everywhere but in the one reader that fetches it.
- A criterion written before the review named a fallback the code cannot have — a refused call exits
  rather than returning — and the codex round was what found it. The method had a step for correcting
  criteria against the issue and none for re-reading them against what the review taught; corrected
  in the open with a correction record and judged as corrected. The contract now says the verdicts
  wait for that re-read.
- `npm run check` was red on master from the parent's own fold of the twenty-first run, restating the
  rules file at 0.30; the agent ran the ten later gates by hand, all green, and filed ISS-94. Fixed
  in this fold, and the rule ISS-94 states stands: whoever writes a dry-run section runs the gate
  before releasing it.
- `record note` announces two tracker calls and spends both before the tracker's own 500-character
  limit refuses, with no limit in the verb's help; routed to ISS-73, which owns reading a payload's
  shape where it is typed.

## Twenty-fourth dry run — ISS-87

One agent made the CLI document an index (3.35.24): one heading, one paragraph, one table of
twenty-four rows, each naming a decision and the topic file under `docs/cli/` that holds it, every
word of the twenty-two sections moved unaltered but for five retargeted cross-references, and a
check holding the shape — block order, a resolving link per row, one row per topic, a cap on every
document under `docs/` outside the requirements tree and this journal. Twelve verdicts, the check
watched red on eight shapes and a near miss either side of both exemptions. Codex accepted four
findings at one round. The parent's rule that a `docs/` path in a source comment resolves now has a
checker, which found one dead path on its first run and it was an example in a code span. Folded from
the record.

- The issue named a cap the tree it described could not meet: `docs/HOOKS.md` stays one file and is
  over it. The agent measured, chose the round number above the largest file kept whole, and
  recorded the deviation before the plan rather than after the refusal.
- The one-home check read `docs/` flat, so the split would have moved sixty-seven thousand
  characters out of its reach with nothing failing; it walks now, excluding the requirements tree
  whose own rules say why.
- Another developer pushed to master mid-batch: the tracker dropped the field that said whether a
  comment's author claimed to be a model, and the park's answer now reads whether the writing token
  is a device's. An agent on a person's token can answer a park, which the commit names as the price.
  The commit's comment was three lines over density, and lint is the gate's first step, so every
  branch cut from it was red before any other gate ran; the agent ran the ten remaining gates by
  hand and filed ISS-96. Fixed in this fold. A push to master that skips the gate costs every lane
  the suite by hand, the same lesson as ISS-94 from the other direction.
- Two agents were told which files the other holds; the collision they could not avoid — the CLI
  document both write — was one line per file, because the first to land retargeted the other's
  citations and said so.

## Twenty-fifth dry run — ISS-92

One agent made `forge project` the project's own answer (3.35.25): the id and its source, the
staging branch, the production branch, whether production deploys on its own, and the staging deploy
the tracker holds — its hosts under labels derived from the field paths, never the tracker's own
column names, the notes on what a test account reaches, and whether test sign-in details exist, printed
only under `--credentials`. One guard at the write boundary refuses any comment, record or upload whose
payload carries a credential the project holds, naming the field, before a slot is minted; a payload
the deploy could not be read against goes through, since a refusal with no route out is worse. A
check keeps the tracker's column names out of printed strings tree-wide, and doctor reports the deploy
by count. Twenty-nine verdicts, codex approved, the gate green whole after the rebase carried ISS-96's
fix. A skill reference changed, so the session owed a restart. Folded from the record.

- Twenty-eight verdicts cite a commit the rebase left on no branch; the agent proved on the thread
  that the rebased head differs from it only by another lane's two files and did not repost them,
  because the thread was already past the page. A verdict that cites a commit should survive a rebase
  that changes nothing of its own: the record wants the tree hash or the rebased head written once.
- `forge advance` refused the last transition at thirty-three comments and blamed two hundred: the
  tracker answered thirty-three of a requested two hundred and still set `hasMore`, so the refusal was
  right and its sentence wrong by six, and it taught the wrong lesson — trim the record. The raw
  transition it hands out skips every entry check and leaves the lease's next line stale. ISS-17
  owns the cursor; the sentence and the stale line went there as a finding.
- Two comment citations of the CLI document, written before ISS-87's index landed under the run,
  were missed at the rebase and left open rather than reshipped: a commit on top would have
  invalidated the verification that earned `released`. Fixed in this fold.
- The release-note record was written before the deploy rather than after; the status still moved
  last, so nothing that filters on status saw a note before a release.
- A benign query string makes a URL land in the withheld bucket, so *test credentials: present* can
  fire on a project holding none; the fail-safe direction, measured and left.

## Twenty-sixth dry run — ISS-99, the first review run

One agent read the batch from 3.35.17 to 3.35.26 as one change (3.35.27): forty-four files under the
source, hook and bin paths across seven runs, the full diff plus the modules around it for their call
sites, in three sweeps — reuse, changed signatures against every caller tree-wide, selectors a later
run made unreachable. Four output-neutral fixes in one reviewed commit: a marketplace read folded from
two places into one helper, three exports nothing imported made private, a header re-derivation
collapsed, a doc comment moved back above its function. Fifteen verdicts, the help and guide surfaces
captured byte-identical before and after, no test touched and the totals equal on both sides. Three
findings filed rather than fixed, each naming the run that left it; two more considered and not filed,
with the reason in the plan. This is the run the user asked for on 2026-09-04: not every issue, but
by a rule, and ISS-95 is the rule. Folded from the record.

- The review found what no run's own criteria could: `gitTreeOf` lost the rank its own doc comment
  states — a directory flag outranks a git-dir flag — so a commit carrying both passes the codex gate
  ungated and the destructive-command guard skips its dirty-tree refusals. ISS-82's run wrote the
  comment and the code in one commit. ISS-100, a correctness regression and the next dispatch.
- The checkers declare the same markdown primitives five times over across two directories; ISS-87's
  run added one copy of each. ISS-101. Doctor prints a miss it cannot count into its exit code; ISS-92's
  run wrote both halves of that function. ISS-102.
- The reviewer's own comment came back out when the extraction lowered the file's comment allowance:
  the source was fixed, not the gate, and the record says so.
- `forge advance` refused the last transition on forty comments and said two hundred: the tracker cut
  the page by response size and said so in a field the CLI does not read. ISS-17, with the field named.
- The review's release note is a withholding with its reason: neutrality was the point, and the
  findings carry their own notes when they ship.

## Twenty-seventh dry run — ISS-95

One agent made the ship step say when a batch owes a reading (3.35.28): the last step counts what
landed under the source, hook and bin paths since a git ref the review run alone moves, and speaks up
at three releases or five hundred changed lines, naming the span; a `review` verb prints the range the
next reading covers, and its `--done` is the mark's only writer, forward-only and compare-and-swap so
two review worktrees cannot clobber each other. The first mark was planted at the head the twenty-sixth
run's verification names, checked on history, leaving the count live at two releases so the third
fires. No restart owed, read by the step rather than assumed. The advisor caught one gap after the
ship — the bootstrap plant skips the ancestry test — and it is ISS-104. Folded from the record.

- The rule the user asked for on 2026-09-04 is now the repository's: a skipped reading is not
  forgotten, the count keeps growing and the next release asks again. The brief that carried it for
  one day is gone.
- The mark lives only in this clone: nothing pushes `refs/forge/reviewed`, so a fresh clone starts
  with no mark and the first ship there plants one at its own head, forgetting what this clone has
  read. Routed to ISS-104 with the gap it already holds.
- The same past-the-page refusal, worded for the wrong cap, was hit for the third time today and
  written up a third time; ISS-17 has all three, and the note was archived unread past its title.

## Twenty-eighth dry run — ISS-100

One agent restored the rank the hook harness reads a git command's tree by (3.35.29): a directory
flag outranks what a git-dir flag implies, as git reads it and as the doc comment already said; a
command naming only a git dir now answers no tree, and both gates resolve that against the event's own
directory as they already did. Eight verdicts, three cases watched red against the unfixed body, both
gates probed from the installed copy's entries. Codex found one thing the fix missed: the path normaliser
stripped a root hop to the empty string, which is falsy, so a hop to the root still lost the rank; fixed,
a criterion added by correction. A hook file moved, so the session owed a restart. Folded from the record.

- The reporter's trigger was narrower than the defect: an absolute git dir ending in `.git` regressed
  too, because taking its parent never returns to the directory the other flag named. The agent
  widened the row and chose the gate case by what discriminates — only a wrong tree that is a real,
  clean repository proves anything, since the dirty check answers true on any error.
- A test's title stated the rule the code had stopped keeping, one file over from the defect; the
  assertions were right and the title was wrong, and the correction record names it rather than
  leaving a reader to notice.
- The ship step's first count fired on its third release: three releases, thirty-six lines. The rule
  as first set counts releases or lines, so three one-line fixes owe a reading as much as one large
  batch does; whether that is the threshold wanted is the user's to say.

## Twenty-ninth dry run — ISS-98

One agent gave an issue a kind (3.35.29 to 3.35.32): bug, enhancement and feature, the set derived by
measuring the backlog's own body shapes — ninety headed bodies read in one pass; each kind names the
sections a description must carry and the ones nice to have; a required section missing is refused with
the section and the kind named, before any tracker call; a nice-to-have one missing is said in a line and
filed anyway; a filing naming no kind is read as a feature and told so; a kind outside the set is refused
with the set; the flow's size word maps onto the tracker's column in one writer; no tracker column name
is printed and the tracker is unchanged. Eighteen verdicts against the installed copy, codex approved
after four diff rounds and a whole-file round. Three fix releases followed the first: a kind read by
presence rather than truth so an empty one is refused, and the same said on both filing routes. No
restart owed. Folded from the record.

- The measurement was reachable from the tracker in one pass and the one structural refusal the run
  met — the ten-file directory limit — printed its own remedy: the first run since the twelfth to
  record no gap in the method.
- The gate's own document for a refused filing still states one kind's shape as universal; ISS-106.
  A body of two size-mark lines and nothing else files with no text, because the mark is stripped
  once; ISS-107. A figure in the verb's topic counted headings by occurrence beside figures that count
  issues; ISS-110. A probe filed a live issue by accident and was dropped with the reason; ISS-109.
- The parent's own rule paragraph for ISS-108, pushed without the gate, restated the rules file at
  0.30 and turned master red for the second time in one day from the same hand; the agent proved it
  was not its change, ran the eight later gates by hand and posted the finding on ISS-108. The
  ISS-94 lesson holds for a topic file as much as for this journal.
- The past-the-page misread was met a fourth time, in a second verb: the verdict's evidence
  attachment. ISS-17, with the verb named; one reader for both.

## Thirtieth dry run — ISS-111, the second review run

One agent read the six releases since the first mark as one change (3.35.33) and moved the mark to
the head it shipped, so the ship step's count restarts there. One fix commit: the how file an agent
reads after the filing gate refuses it still promised that an outcome, a rule and an out-of-scope file
silently — false for two of the three kinds since the twenty-ninth run — and it was a second copy of the
shape, so it went rather than growing to three; two exports nothing imported went module-local, five
commits after the first review had removed three others from the same module. Help and refusal text
byte-identical before and after; the how-file ceiling caught the first version of the paragraph and the
prose was tightened rather than the ceiling. Four issues filed, each naming the runs that left it. A
hook document moved, so the restart already owed stood. Folded from the record.

- The ship step's own printed route names a value the CLI refuses: `--size` takes one word and
  *feature* is a kind. The checker that holds that rule walks two directories, and even in scope it
  reads flag names where the usage line spells the value one token on. ISS-118, the one to read first.
- A dead export recurred inside one range because no gate refuses one; ISS-114. The article on the
  kind line is a literal beside a helper that already picks it; ISS-115, which the parent had filed
  the same hour as ISS-113 from the other side — dropped as the duplicate. One filing's shape is read
  twice on both routes; ISS-116.
- The mark now covers the review's own two commits, which no cross-run reading will read; the
  script says so, on the ground that a review's commit has its own second review. A price stated,
  not a defect.
- Evidence upload refuses a `.json` file as an octet stream, naming neither the allowed set nor a
  route, and the failed call costs the verdict too. ISS-80, its third sighting. The note itself was
  written into the worktree's feedback folder and left with the worktree; the finding survived only
  because the hand-back named it.

## Thirty-first dry run — ISS-108

One agent made a retired name refused on every surface that could still read it (3.35.35): a registry
of retired names, each with the release it went in, held once in a checker that walks the plugin and
docs trees and matches a name where the CLI's own surface would use it — after the verb, as a code span
or quoted token, as a flag, as a tool name, as a file basename — never as a bare word, because the verbs
are ordinary English across the docs and a bare match was measured to fire on prose. The registry ships
empty, since nothing has ever been retired, and the case that proves the checker fires runs a fixture
entry naming a live verb through the real walk. Doctor gets no row until the first retirement has
something to print: a row with nothing to show is code nobody can watch fire. Codex: one finding closed
in the document, one fixed in the test, one rejected on measurement. No restart owed. Folded from the
record.

- An active requirements clause can go on prescribing a retired verb, because the checker exempts the
  requirements tree as history; the residual went to ISS-27, whose gate owns that tree.
- The run recorded no gap in the method: advance named each payload, the contract part named what each
  status reads, and the two refusals met printed the shape or the limit they wanted. The two rounds
  they cost — a flag typed on the wrong verb, a note written twice against a 500-character field —
  are ISS-62's and ISS-46's already.
- The run ended at `released` under the skill pinned before ISS-105 landed; the report from the new
  copy already said *owed: the close*, and the parent closed it through `forge advance`, which now
  reads the status alone for that step.

## Thirty-second dry run — ISS-83, dropped on measurement

One agent verified the issue before planning it and found the premise false, so nothing was built:
the gateway serves no cross-request cache read at all — thirty-three of thirty-three single-call
consults in six hundred answered rows read zero cache tokens, including three on the recorded identical
prompt digest — so every cache read in the log is inside one consult, and unifying the system prompt
would have bought the tool list's worth of tokens and no more, while trading away the property the
issue's own rule protected: zero new findings on twenty-one rechecks since ISS-77, against half of two
hundred before. The apparent cost was ISS-77 succeeding: rechecks became one-call, and a one-call round
reads no cache by construction. A confirmation with finding *premise-false*, two routed records, a park
of kind dropped, and open to confirmed to dropped; the measurement attached. No commit, no consult, no
ship. Folded from the record.

- The one record whose whole weight is its evidence is the one that cannot cite it: `record
  confirmation` takes no `--evidence`, and the file went on a comment instead. ISS-73.
- In a worktree the CLI names the worktree's own feedback folder, a gitignored directory the cleanup
  deletes — which is how the thirtieth run's note was lost; this run wrote to the checkout by hand.
  Filed as a bug: the folder resolves through the common git directory.
- `forge dep` needs a lease on the other issue, so the links to the two issues this run filed ride in
  the routed records rather than as graph edges.

## Thirty-third dry run — ISS-105

One agent made a run close what it released (3.35.34): the skill's release phase ends with the close;
`forge advance` from `released` to `closed` reads the status and nothing else, so the page the tracker
cuts cannot refuse it — a park or a drop from `released` still reads the page, since it judges evidence
the comments carry; the record report says *owed: the close* on a released issue, gated on the status
alone because gating it on a whole verification would go silent on the record that most needs telling;
the tail of the flow is one exported constant both the verb and the report read, pinned against the flow
table's order. The skill changed, so a restart was owed and the user chose to keep dispatching. Folded
from the record. The thirty-first run's close, the first through the new verb, is the proof.

- A fake tracker that throws answers nothing, so a test case hangs rather than failing; ISS-122.
- The page measurement again — thirty-six rows at the limit, cut by response size — and one more
  shape: a park from `released` has no route past the refusal. ISS-17, which now holds six sightings.

## Thirty-fourth dry run — ISS-116

One agent made a filing's shape read once (3.35.36): one read per filing, one helper both filing routes
call, the refuse-then-say pair existing once and the notice reachable off a synchronous, network-free
read. Eight verdicts; the load-bearing case counts body reads through a getter and pins two, and reading
three fails it, which was run and captured; every pre-existing case ran unedited and the before-and-after
list of case names differs by the one added. The gate ran whole twice, on the review tree and on the
released head after the rebase, as the verification reference now asks. A gate file moved, so the
restart owed stood. Folded from the record.

- The machine ran out of temp inodes mid-run — none free of a million, with six gigabytes of bytes
  free — and every tool call that wrote a file began failing. Measured cause: the test fixtures leak a
  directory per case, about five hundred and fifty per gate run from one helper that registers no
  cleanup, and the code-quality package's own suite two and a half thousand inodes more. The agent
  filed it, then dropped it because the feedback folder's README forbade the route; the parent reopened
  it on the user's rule of the same day that a plugin defect is tracked on the tracker (ISS-123), and
  swept sixty thousand leaked directories older than half an hour. ISS-125, dispatched at once: a gate
  that fills the disk it runs on stops every lane.
- The ship step's count fired again at three releases and a hundred and thirty lines; ISS-112 makes
  it volume alone.

## Thirty-fifth dry run — ISS-89

One agent re-keyed the guide table's row to the tracker's rename (3.35.37) and doctor's guide table
reads *ok*: the page had moved in both directions, so the row was re-keyed rather than dropped; its
decompose half had converged on the contract, retiring the old row's only replaced rule, and its new
closing section diverged — file at `draft` to save a runner slot, where the contract says `draft` is the
reporter's status and `advance` never enters it — so a row is still owed and the disposition stays
*partly*. Twenty-three verdicts at the merged commit, the run closed its own issue. Folded from the
record.

- A codex claim that a flag did not exist was wrong, and checking it found the entry's own claim about
  that flag false in the way that mattered: the flag writes a *relates* edge, so pointing an agent at it
  for an ordering edge hands them a grouping label. The entry now names the verb that writes an
  ordering edge and says what the flag is not.
- The suite's near-miss case tested a typo of the retired slug, which after the re-key fails outright
  because the echoed typo contains the new held slug; it had to move, and it now tests a typo of the
  live slug under a guard that each string still ranks against something held.
- ISS-103 asked for exactly this, filed three hours later; the run posted the finding there as the
  finder and left the disposition to a holder. The parent dropped it as the duplicate.
- Twenty-three criteria judged twice — once on the review tree, once at the merged commit the rebase
  forced — put the thread past the page, and the last three moves went by hand. ISS-17's seventh
  sighting; the record report reads the same thread fine, which is the discriminator.
- `record criteria` reads the *and* inside a hyphenated slug as a conjunction, a warning; ISS-73. The
  worktree feedback path, again; ISS-123 is running on the tracker route that replaces the folder.

## Thirty-sixth dry run — ISS-117

One agent gave this repository the gate sid-growth already had (3.35.38 to 3.35.40): `npm run check`
is one runner over twelve declared steps, scoped to the merge-base diff, widening when a changed path
belongs to no step or the diff touches the runner, skipping a step whose inputs hash to its last green
digest under the common git directory, `--full` to distrust it, and a gate step in the release script.
Measured: a docs-only edit runs three of twelve steps, a test-file edit six, an unchanged tree none in
no time; the full gate is green at the released head. Two fix releases followed a review of its own
work, each with a case watched failing without it: a flag counted uncommitted paths where the help said
it named them; a directory of document tests claimed by three filenames would have let a fourth skip on
a docs edit; and the step table was checked in one direction, so a script no step named was invisible —
a check that stops running on a tree that stays green — itself shadowed by a step labelled *test*. No
restart owed. Folded from the record.

- The rules file's verifying section changed with it, and the skill's verification reference, which
  said this morning that the whole gate runs twice, was relaxed the same day: that rule was measured
  against the unscoped gate, and a gate that reads the diff makes the count moot.
- The consult's `--base <branch>` diffs two-dot, so a base that moved under the branch showed the other
  side's commits as this branch's deletions and two findings were rejected by name that were artefacts;
  filed as a bug. `forge comment --body` leaks a filesystem errno for a flag; ISS-73.
- Four feedback notes from this run, two rescued from the worktree by looking before cleanup: the
  folder defect ISS-123 is replacing. ISS-124, the scratch-directory leak, was ISS-125 again; dropped.

## Thirty-seventh dry run — ISS-125

One agent made every test's scratch directory come from one helper (3.35.41): each room sits inside a
single root per test process, named for its pid, removed once at exit, and — since a kill runs no
handler — any root of an exited process is swept when the next room is asked for; a directory the
fixture never named is never touched. A hundred and eighteen lines across fifty-two files, the
code-quality package carrying its own copy because it travels alone. Three cases, each watched failing:
what a process leaves in a temp directory of its own, a planted root of a dead pid swept by the next
process, and the raw temp-directory call refused in any tracked test file. Measured with the temp
directory redirected: a suite that left twenty-nine directories leaves none, the package's hundred leave
none, a whole gate leaves nothing of ours. Codex raised five: three were the moved base read two-dot
(ISS-129, the same day), two were real — a killed process and a literal-only match — and became the pid
sweep and the identifier match. Closed by its run. Folded from the record.

- Measuring anything machine-global is unreadable while parallel agents run: the first post-fix count
  showed sixty-three new directories and read exactly like a fix that had not worked; they were two
  other worktrees on the old fixtures. The method: give the measured run its own temp directory and
  count inside it. The gap record landed after the close, so the journal is where it is read.
- Fourteen criteria judged against a merged commit that moved twice made forty-two verdict comments,
  which is what capped the page and sent the last three transitions by hand. The agent filed ISS-131
  for the CLI half — the refusal reads a payload cap as a count and routes to the one write nothing
  checks — beside ISS-17's tracker half; its edge to ISS-17 was refused for want of a lease.
- The ESLint rule that would ban the raw call at the source and a fixture kept for inspection behind a
  flag stay on ISS-42 and ISS-124 as finder's notes; the agent's own check case covers the suite.

## Thirty-eighth dry run — ISS-126

One agent put every stamp the hook harness writes into one per-user room under the temp root
(3.35.42), made on first write and swept before every write on a one-day bound from a read of that
directory, never a scan of the root. The stamp block moved out of the harness — which stood at four
hundred and eighty-six of five hundred code lines, so the addition broke two limits — into a module of
its own, re-exported so no gate's import moved, and the extraction was posted as a plan correction
before it was written. Seven cases with planted mtimes, one proving a write that cannot land still
reaps; a use case with three criteria in the requirements tree; both codex majors folded — reap before
the write, name the room per user. A hook file moved, so the restart already owed stood. Closed by its
run. Folded from the record.

- The change bounds what it writes and deliberately sweeps nothing it did not name, so the seven
  thousand seven hundred stamps already loose in the temp root — a count the first grep undercounted
  by half, matching one kind's name inside another's — went by the parent's hand, one command the
  hand-back gave, at the cost of one re-ask per live session.
- The seventh stamp kind is the vendored delegate's, which may not import the harness and is
  byte-compared against its source, so it still writes loose; the criteria were scoped on the record
  to what the harness writes rather than claiming otherwise. ISS-127.
- `forge issue <key>` refuses a key the browse projection lists: the unfiltered browse returns
  ninety-eight of a hundred and thirty at any limit, and a key reachable under a status filter is
  absent from the unfiltered page. ISS-132, with the guessed cause corrected by a measured comment.
- A relates edge was refused for want of a device (ISS-8, ISS-45), so the link between the two issues
  this run filed lives in their prose.

## Thirty-ninth dry run — ISS-123

One agent made a plugin defect an issue on the tracker from the moment it is met (3.35.44): `forge
feedback <file|@file|-> --title T` files a bug on this plugin's own project from any checkout — the
destination fixed in the CLI, the caller's slug recorded as a fact that decides nothing — and a title
matching an open feedback issue comments there instead, which the run proved by sending one title three
times. The local folder, its README, the gitignore entry, the help sentence, both skills' paragraphs and
the resolver's folder lookup went in the same commit under the retirement rule; the step table that named
the directory lost the name too. The issue was rewritten by the user before the plan — "no more local
file" — and taken as a correction. Two skill files moved, so the restart owed stood. Closed by its run.
Folded from the record.

- Fifty-seven already-routed notes in the checkout's archive turned from ignored to untracked when the
  gitignore line went, and would have blocked the next ship's clean-tree step; the agent moved them
  whole to a directory beside the checkouts rather than deleting them. They are history the journal
  already carries.
- The first defect filed with the new verb is about the verb family it joined: `forge record <kind>
  -h` answers a missing-flag refusal instead of usage, and one flag requires one of six words silently.
  ISS-128, which ISS-73 had as a finding since the morning.
- The parent's fold no longer reads a folder. Thirty-eight runs of notes went through one; from here a
  feedback issue is triaged on the tracker like any other and the journal cites it by key.

## Fortieth dry run — ISS-112

One agent made the ship step decide a reading by volume alone and file it (3.35.45): five hundred
changed lines under the source, hook and bin paths since the mark, the release count printed and
deciding nothing; the reading's issue generated — the commit pair, the size, the issues the range spans,
the reading rules, the ending that moves the mark — and filed through the repository's own CLI as a
feature kind, with the launch line printed; while an issue for the current mark is open the step names
it and files nothing; a tracker that does not answer files nothing and prints the route the next ship
retries. Proved live: the released copy filed ISS-135 for the real range — eighteen files, five hundred
and six lines, twelve issues spanned — and a second ship at the same mark filed nothing. ISS-118's one
line went with it. Fourteen cases in the script's file; a case runs the generated body through the
CLI's own shape reader and was watched failing on a renamed section. No restart owed. Closed by its run.
Folded from the record. The user's ask of the morning — "instead of an issue for the review run, can it
measure and decide by volume" — is the repository's, and nothing about a reading is typed.

- A filing carries no uniqueness on the tracker, so two ships crossing one mark could file twice;
  codex's finding, rejected here as the tracker's and filed as ISS-133.
- `forge attach` puts a second document under a name already on the issue, the very collision the
  evidence route refuses; it bit this run's own evidence. ISS-137.
- The ship step's first automatic filing spanned twelve releases because the mark had waited for this
  change; the review it filed runs as the fortieth run closes.

## Forty-first dry run — ISS-101

One agent gave the checkers' markdown primitives one home (3.35.46): the code-span strip, the table row
and separator, the link target, declared once and imported by every checker, with two copies beyond the
issue's inventory found and folded — a fourth span strip inside a structure check and a link-text pattern
declared twice byte for byte — and declared in the plan before the work. The three decisions the issue
demanded were measured: the unquoted form stays one alternation because two sequential passes are
provably not equivalent where a span and a quoted run interleave; the row margin admits a carriage return
because the plain form would have silently stopped one gate breaking a block at a table row on a CRLF
checkout in a repository this tree cannot see; the separator became whitespace-tolerant because the
strict copy refused a correct index with a message naming a missing header. Five probes watched the guards
fire, and one showed the corpus test could not tell the link-target change, so a pinning test was added
and the criterion corrected in the open. Codex found nothing. No restart owed. Closed by its run. Folded
from the record.

- Two copies remain and were named only in the closed plan, which would have reproduced the very
  condition the issue documented; ISS-138 carries them.
- The page refusal again, at forty-three comments with the tracker saying which cap bit; the correction
  went to ISS-17 rather than a duplicate, and a gap record says the last two transitions were by hand.
  ISS-131 is running on the CLI half.

## Forty-second dry run — ISS-102

One agent made every miss doctor prints reach its exit code and no note (3.35.48): the tally moved
into the one function that prints a line, the per-check threading went, so a level and the status
cannot disagree. The issue named three uncounted sites; the run found nine and judged each on its own —
a cloudflare credential, the codex key at two sites, a server-gated probe, an absent project slug and an
unset release branch are notes that still name their fix; the translation login is a miss only where the
project declares translation; a stale MCP file and a switch naming no hook stay misses and now fail the run, so
anything reading doctor's exit code sees one where it saw zero. Thirteen verdicts, ten of nineteen cases
red against the pre-change file, both halves verified from the installed copy. Codex's one major — the
document claimed the exit code was the count of misses — accepted and fixed before the commit. A skill
reference moved, so the restart owed stood. Closed by its run. Folded from the record.

- The ship step looks up a mark's review issue with an open-status filter, so the review issue leaving
  `open` between two ships made the same mark answer twice; the second filed a duplicate that only the
  tracker's own gate stopped, then reported the refusal as the tracker not answering and printed the
  refused filing as the route out. ISS-140, filed against the script another run held.

## Forty-third dry run — ISS-135, the third review run

One agent read the twelve releases from the second mark as one change (3.35.49) — the first reading the
ship step filed itself — and landed one commit that only simplifies: five places where a landing in the
range moved a shape and left part of the old one standing, among them a copy open-coding the two fields a
helper had been added to answer, a catch ending on a dead return, a guard computed and discarded on the
one path that read it, and a field no caller passes. Twelve verdicts. Codex found one real defect in the
review's own work — a dropped keyed dedupe that could route a note to a different document where two reads
disagree — fixed before the commit and refuted on recheck. No restart owed. Closed by its run. Folded
from the record.

- The mark was moved to the head the reading reached, not the head the run pushed: by ship time master
  had moved by a hundred and ninety-two lines from two parallel runs inside no reading's range, and a
  bare `--done` would have put them permanently behind the mark, silently — the hole the rule exists to
  close. The script's help said the other thing; ISS-146, and the next reading counts from where this one
  stopped.
- The release script's pull refuses a checkout holding another run's uncommitted file even for a no-op
  and names no route but the one this repository forbids; the agent fast-forwarded by hand and resumed
  from the next step. ISS-143. With ISS-104 and ISS-140 that makes four fix-size defects on one script,
  dispatched as one batch run under the user's same-place rule.
- Two findings were set down in the confirmation rather than filed: an empty retired-names registry
  proven by its own test passing an entry, and the closed-status skip of the comment page stated in the
  verb's usage as the intent.

## Forty-fourth dry run — ISS-131

One agent made a long issue passable again (3.35.51): `forge advance` judges the record on the page
the tracker returns instead of refusing every move on it, on the ground that the tracker's notice is true
— the cut keeps the most recent rows, so a page that earns a status cannot be a page hiding an
unearning — and the refusal that remains says what cut the page, the response-size cap and the count
returned, never a limit of two hundred the thread did not reach; the route it hands out is the tracker's
own escape plus the write that supplies the missing item, not a hand transition writing a status nothing
checked. One correction: the review record named the wrong head and was corrected to the judged one.
Codex: one consult, one recheck, nothing standing. Closed by its run. Folded from the record. Nine runs
had met this refusal today; the eight sightings on ISS-17 were re-read as its CLI half done, and its
cursor-shaped requirement is noted as stale.

- A resume reads the newest park of the matching kind, so a park already answered can transition an
  issue again; ISS-142. The issue-flow diagram carries a hand-copied rule table from the contract, and
  it is stale; ISS-148. `forge issue --fields` refuses two fields the same verb prints under `--full`;
  ISS-151. `forge record <kind> -h` was filed a second time and dropped as ISS-128's duplicate — the
  same-place fold (ISS-139) is what stops that.

## Forty-fifth dry run — ISS-130

One agent made a skill name only what resolves (3.35.52): the skill-paths check refuses any path a
skill's text names that does not resolve inside that skill's own directory, by real-path containment so
a climb or a symlink out is caught, with two remedies in the refusal — a project's path is the project's
to name, and this plugin's own has no name a skill can write, so state the method or the how route. The
two citations of scripts that shipped nowhere became the migration classification and the identifier
sweep stated as judgements. Six cases; an acceptance clause added; two skill-gate tests moved to a
directory of their own because the checks directory hit the folder limit. Three skill files moved, so
the restart owed stood. Closed by its run. Folded from the record.

- Two path defects outside the hold were left standing and are filed together as ISS-154: a script's header
  comment names a source path that does not resolve, and an acceptance clause cites a test file under
  the directory it left. Both pass today because the claims check matches on the basename alone.
- The evidence-upload MIME refusal was met again and went to ISS-80 as a comment — after the rename
  workaround rather than before it, which the rule asks the other way round; the run said so itself.

## Forty-sixth dry run — ISS-137 and ISS-136

One agent took the two same-place attach filings as one run. ISS-137 (3.35.53): the attach verb now
reads the issue's own attachment names and its comment page before the first upload, and a base name
already up — or given twice in one command — is refused with nothing sent, naming the document that is
there and the two ways past it. A comment page the tracker cut is said on stderr and the upload goes
ahead, because this verb only uploads and the comment list takes no cursor, so a refusal there would
be one nothing a caller could type would clear. Six cases, four failing with the guard reverted. Proved
live against an issue that carries one name twice. ISS-136 dropped: the line it quotes was removed two
releases before the one the report names — the reporting session was reading an older cache copy than
its own help claimed, and so was this run, whose skill text still pointed a plugin defect at the deleted
feedback folder. Two consults, no findings. Closed by its run; no restart owed. Folded from the record.

- Every criterion was judged twice: once at the branch head, once more at the landed head after the
  ship's rebase and version commit made the first hash disappear. The contract wants verdicts at the
  merged commit, and in this repository the ship is the merge — so the phases judge before the commit
  they must cite exists. Filed as ISS-156.
- Two findings outside the hold were routed as issues instead of taken: the retired-names registry has
  no kind for a retired directory (ISS-145), and the record route keeps its own copy of the sentence the
  attach verb now shares (ISS-155).
- A mid-run collision: the ship's rebase brought ISS-131's landing, which made the comment page size
  private; the run posted a correction before rewriting to the shared cut line, as the contract asks.

## Forty-seventh dry run — ISS-129

One agent made a named review base part where the branch parted (3.35.54): `--base <ref>` now anchors
the consult at the merge-base of that ref and the head, so a master that moved under the branch no
longer puts another run's commits into this run's review; the row records the resolved commit, a stderr
line names the parting point, and the nothing-differs refusal suggests a base that parts at the same
place. Four new cases. The live case was real on this repository: master had taken a journal commit under
the branch. One consult finding — three sites resolving the base separately could disagree on a ref
moving mid-consult — accepted and closed by one answer per checkout and ref, refuted on recheck. Closed
by its run; no restart owed. Folded from the record.

- The run declined the issue's literal three-dot form, having probed it: three dots make the head the
  other side and drop the working tree, so an edited uncommitted file vanishes from the review. The
  merge-base as one side keeps the tree as the other. Said in the confirmation, the plan, the criterion
  and the docs rather than taken silently — the correct route for an issue whose stated fix is wrong.
- All ten verdicts were re-posted verbatim after the ship's rebase, the same cost ISS-137's run paid;
  this run's data went to ISS-156 as a comment. Its first move was to file a duplicate (ISS-162), caught
  and dropped by the run itself — the same-place search at creation that ISS-139 asks for would have
  caught it before the filing.

## Forty-eighth dry run — ISS-144

One agent gave every filing a rank (3.35.55): both filing routes write a priority from one reading —
the filer's value or `low` — and end on a line naming it; the set is the tracker's own enum read at the
call, a rank outside it refused with the set before anything is filed, and the default held to that
same set rather than refused later at the write. The browse page sorts rank first, oldest first within
a rank, and prints the rank on every row. Eleven cases watched red first. Nine criteria, eight pass, one
skipped with its reason. Codex found two: the default not held to the enum, accepted and fixed; a page
the tracker cut by recency cannot be ranked past, rejected and filed as ISS-160 since the list takes
no order and no cursor. Closed by its run; no restart owed. Folded from the record.

- The run declined a third documentation file the issue named, because two existing homes already
  held the decisions and a third would owe an index row — a deviation said on the record.
- Two plugin defects met at ship were filed rather than worked around: the ship's own auto-filing of
  the owed review was refused by this CLI's duplicate check and blamed on the tracker, so the owed
  reading is filed nowhere (ISS-163); and the attach verb prints a URL that the evidence field then
  refuses, which cost six retried verdicts (ISS-164).
- A finding on the running ISS-104 batch went to that issue as a comment: the browse row grew a column
  and the ship's mark-reader now captures the status into the group it calls the title.

## Forty-ninth dry run — ISS-141

One agent gave the flow a light path (3.35.58): the size a filing declares decides the ladder, so a
fix's entry checks ask for less — the confirmation stays, the plan and the review shrink to what a fix
can carry, a fix declaring a user-facing outcome still owes its note on every project — and one table
in the flow's shared machine is read by both the checks that enforce the path and the report that
states it, because a hand-written second copy had already drifted once inside the run. A mis-filed fix
is re-sized by a correction record in one narrow form, honoured whenever written since it only ever adds
demands. Six decisions on the record, each with its undo. Codex: three findings, all accepted and fixed.
Nine criteria pass. Closed by its run; no restart owed. Folded from the record.

- Two of the issue's own claims were corrected in the open: the size is the description line and not
  the tracker's complexity field, and the parent's "under half a feature run" is a measured thirty
  percent over payload writes — the eight transitions survive by design, so a measure over every call
  would judge the wrong thing.
- The plan named the file the table would live in before measuring it; that file sat at the comment
  ceiling and its folder at the file limit, so the table went to the machine and the criterion was
  corrected with the reason. Measuring the landing place is part of the plan, not of the build.
- Three plugin defects filed as met: a correction record does not repeat (ISS-161); a key the browse
  page prints was refused by the reference resolver, whose projection disagrees with search (ISS-168);
  the ship never prints the sha its own rebase landed the change as (ISS-169).

## Fiftieth dry run — ISS-119

One agent wrote the sixth skill (3.35.60): a gate-review skill, prose only — how a project's gate is
measured, the moves that make it faster, how a move is proven not to have changed the answer, and when
the review is owed. The method was spent on this repository before it was written down: twelve steps
with the test step at most of the time, the slowest single file a floor no concurrency passes, one
linter run twice over the same files, and the gate's runner spawned inside the step that schedules it —
every figure carrying the caveat that the machine was five times oversubscribed while it was read, and
one unexplained reading reported as unattributed rather than as a saving. Codex raised seven, all
accepted: two were overclaims the skill would have taught. One line in the layout block. Restart owed.
Closed by its run. Folded from the record.

- Prose only, by a recorded decision: the skill-paths check refuses a skill naming a path outside its
  own directory, and a verb would have needed the held command table. The undo is a scripts directory
  inside the skill.
- Two of the issue's premises were stale — the fixture leak the issue measured was fixed two releases
  earlier, and the whole-gate reruns it counted are what the scoped runner was written against. The run
  checked before building on them, and said so.
- The half that lives in the held ship script — a green run recording its seconds and the ship printing
  the figure — was routed as ISS-166. The record note's unstated length cap cost one round (ISS-170).

## Fifty-first dry run — ISS-104, ISS-140, ISS-143 and ISS-146

One agent took four defects in the ship script as one batch (3.35.56, 3.35.57, 3.35.59): the mark's
first plant proves the target is this history's; the ship's review-issue lookup reads the key the
tracker named rather than one a path in its reason carries, and says a refusal apart from an absence;
step seven asks the shared checkout for a fast-forward, so a dirty tree there no longer stops a release
it does not move; and a named head is what `review --done` marks, the bare form refused over an owed
range. Twenty cases. Four issues filed onward. No restart owed. Closed by its run. Folded from the record.

- The projection grew a priority column mid-batch, when ISS-144 landed in the rebase base, and the
  ship's positional parse silently read the rank as the status while nineteen cases stayed green on a
  two-column stub. Found by probing the released copy against the live tracker, not by reading. The
  shipped shape is now two calls — the row says which issue, the issue reader says what status — and a
  correction record says so against the plan; the gap that one status costs a whole body or a moving
  column is ISS-174.
- One criterion's verdict records a decision rather than reproducing a defect and is not red without
  the change; the run said so instead of calling it proven.
- The batch took the longest of the day, at over two hours: four issues sharing one branch means four
  sets of records, and the rebase brought two landings mid-run. The rule for sharing a run is for fixes
  the size of one change; four is where the saving turns into serial waiting.

## Fifty-second dry run — ISS-166

One agent gave the gate a memory of its own seconds (3.35.61): each step's ledger entry carries how
long its pass took, one append-only line per green run records the whole figure and how many of the
table's steps it spent, and the release's last step prints that figure beside the code-volume count as a
ratio against the run before it — subtracting only between whole-gate runs of the same table size, and
leading with a scoped run's own figure named as scoped. Five defects found in its own first cut, each
reproduced and pinned by a case watched red: a ratio that could never fire here, a run evicting its own
predecessor, unequal tables subtracted, a read-modify-write over a file two worktrees share, one line
printed twice. Fourteen criteria pass, each citing an attachment rather than a temporary path. No
restart owed. Closed by its run. Folded from the record.

- The last defect took two rounds: the first fix only delayed the compaction, the recheck rightly kept
  the finding, and the compaction was deleted rather than guarded, because no lock could ship with a case
  that fails without it. A guard that cannot be watched failing is not a fix.
- A finding went to the gate-review skill's issue: three real readings moved a third either way on
  machine contention alone, so a trigger that is a ratio of wall clock will spend a delegated agent on
  noise. The skill's prose already made the trigger conditional; the number needs a load-aware companion.
- The release that lands a change to the ship's last step is the one release that cannot print it: the
  shared checkout's copy of the script is loaded before the step that pulls the change in. Said in the
  verification record rather than passed off as a defect.
- Two plugin defects filed: the note kind's help names no length limit, so the cap arrives from the
  tracker after three round trips (ISS-181); a comment verb given a flag it does not know reports a
  missing file named after the flag (ISS-182).

## Fifty-third dry run — ISS-139

One agent made the create path say what is open beside a filing (3.35.62): before a filing is sent,
the tracker's memory is searched for open issues in the same place, the matches are printed with their
scores, and a filing marked as belonging to one of them lands there as a comment instead. The fold's
threshold was proved live and then split in two by the review — the write's own threshold and the
suggestion's — because one number served two decisions with different costs of being wrong. Nine major
findings across five consults, all accepted but one, routed. Twenty-five criteria pass. The longest
single-issue run of the day, at over two and a half hours. No restart owed. Closed by its run. Folded
from the record.

- The run overrode a standing instruction and said so: told to point the config directory at a
  temporary one for anything exercising plugin state, it found the codex-second gate reads the consult
  log only from the live directory, so a run obeying the instruction can never satisfy the commit gate.
  Two consults were spent where nothing read them before the mismatch showed. Filed as ISS-189; the
  instruction now says probes and tests, not the run's own verbs.
- The issue's last rule — a run working an issue with several findings judges each as a criterion — is
  the flow's and the contract's, whose files another run held; routed as ISS-167 and the issue closed
  with that half named unbuilt, rather than waited on.
- The ship's rebase changed two files the change touched, so the mark, the review record and all
  twenty-five verdicts were re-posted against the merged commit: the fourth run today to pay ISS-156's
  cost, and the largest.
- Filed onward: a flag in a verb's own help absent from the row the top-level help prints (ISS-178);
  the dependency verb cannot record an edge to an issue nobody holds (ISS-190).

## Fifty-fourth dry run — ISS-154 and ISS-145

One agent took two fix-size defects in the checks as one run (3.35.63). ISS-154: a new check reads
the paths cited in the requirements tree and the scripts, and refuses one that does not resolve as
written; six stale citations across five files were corrected with it. ISS-145: the retired-names
registry gained a directory kind, with the deleted feedback folder as its first entry, and the liveness
rule scoped so a retired name a live verb shares is no finding. Thirty criteria pass, seventeen
mutations watched red. The branch rebased mid-ship as master moved and the rebased head was re-reviewed.
No restart owed. Closed by its run. Folded from the record.

- The issue's report was real but its stated mechanism was a guess: the existing check had never
  read those two sentences, so "matches on the basename" described nothing it did. Recorded as the
  confirmation and that check left untouched; the fix was a new check scoped to two populations, which
  is what kept the issue to fix size. The six citations outside that population
  are ISS-191.
- A criterion asked for a file to stay byte-identical, and another run's landing made that literally
  false while the branch was open; the criterion was narrowed to what the verdict proved — that neither
  of this change's commits touches the file — with a correction record after the fact.
- The tree's one pre-existing red is a test that never sets the config directory and passes only on
  the developer's live credential (ISS-177); the baseline named it so no later red would be blamed here.
- Two known defects were worked around rather than re-filed, each named with its issue: the dependency
  verb under a personal token (ISS-149) and the note cap (ISS-170).

## Fifty-fifth dry run — ISS-86 and ISS-36

One agent took two hook-gate bugs as one run and finished one (3.35.64). ISS-86: which tree a git
command runs in is now read from the shell's own moves, in the harness, shared by two gates — and the
answer is every directory a call could stand in, not one, since only a conjunction proves a change of
directory both ran and succeeded, while a pipeline stage, a background job and a subshell lose the move.
Where the tree is uncertain the refusal says so and names the form that makes it certain. Thirteen
verdicts pass, one with a divergence reasoned on the verdict itself; the before-state was reconstructed
from the parent commit into a copy of the plugin and re-probed rather than asserted. Four hook files
moved, so a restart is owed. ISS-36 was left open with nothing written to it: the issue reader cannot
resolve its key, and the run stopped rather than working around the reader. Folded from the record.

- Five review rounds, because the commit gate demands a consult on whatever stages, so each fix forced
  another; four closed a regression the run itself introduced, one opened a new class. The rounds were
  earned, and their count is the cost of a change that reads shell syntax.
- One shape shipped as a deliberate over-report in production code: the failed branch of a conjunction
  list is not carried, so a disjunction in front of a command keeps the caller's directory live even
  where it is unreachable. Chosen because it can only add a candidate and never drop one, so it cannot
  miss a refusal; it costs an occasional refusal naming the conjunction. That and six further shapes
  are ISS-188, whose first step is moving the reading out of a harness file at its line ceiling — twice
  a correct reading cost one line more than the file had, and the form that fitted was the one with a
  hole. Recorded as a gap.
- ISS-36's finding, made in passing — the reference pattern still accepts a spec citation as a key — was
  posted on the key-lookup batch that holds the file, since ISS-36 itself could not be reached.

## Fifty-sixth dry run — ISS-169 and ISS-163

One agent took two fix-size defects in the ship's last step as one run (3.35.66). ISS-169: the step
names the sha the change landed as, read from the mark for the pre-push head and from the tree for the
post-push one, says which end a merged mark takes when the change is more than one commit, and says when
a release carried nothing but its own bump. ISS-163: the refusal of the ship's own review filing now
names the right party — this plugin's duplicate check, a tracker that did not answer, or a CLI that
would not start, the third a party the review found. Eleven criteria pass. The predicted quirk
occurred as briefed: the release that changed the last step printed the old one, and the next printed
the new. No restart owed. Closed by its run. Folded from the record.

- The hypothesis handed in — that ISS-163 was already fixed by an earlier landing — was tested and
  found false: the earlier fix corrected the lookup and stopped the route pointing at the refused
  filing, but the party blamed was still wrong. A hypothesis in a brief is a thing to check, not a
  finding to record.
- The test file crossed the code-line ceiling and its directory the file limit in the same change, so
  it split into fixtures and two suites under a directory of their own; any brief naming the old path
  is stale. The ship script itself now sits three lines under its ceiling, so the next change to it
  splits it by responsibility first.
- The remote-tracking ref of the base branch is shared by every worktree of a repository, so no
  per-run step may read it to describe its own release — it names whichever run pushed last. Found
  by the review as a finding; other tooling could carry the same bug.
- The run's consults ran under a temporary config directory, as its brief said before the correction,
  so its review has no row in the live log and the four findings were verified again at the end against
  the shipped code: the cost ISS-189 names, paid once more.

## Fifty-seventh dry run — ISS-132 and ISS-168

One agent took the two filings of one defect as one run (3.35.67): the key-to-id lookup behind every
verb that takes an issue key walks the backlog in half-open windows by creation time and accepts only
uncut answers, so a key the browse page lists resolves whatever page it sits on, and a genuine miss
names what was measured rather than asserting absence. The four oldest high-priority issues became
readable again with it. The concurrency of the walk was verified against the released copy with two
keys at opposite ends of a reversed backlog. No restart owed. Closed by its run. Folded from the record.

- A predicate that reads a page as cut only when the row count equals the limit never fires on a
  response-size cut, and four callers read a cut page as whole. Found in the same file, deliberately
  left out because the callers need re-judging and not only the predicate; filed as ISS-203. The
  boundary of a fix-size run is drawn by what must be re-judged, not by what sits in the same file.
- Three refusals met were routed to the issues that already hold them, named on the record: the
  dependency verb under a personal token, the release-note cap, and the recheck flag printing help.
  The run posted the same comment twice on one of them in a compound line and said so beneath, since
  no verb deletes a comment — one more reason a write stays on its own line.
- One verdict was flagged by the run as proving less than its criterion reads: the full-projection case
  proves the key resolves under the flag, not what the flag adds. Said on the verdict rather than
  cited later as more than it is.

## Fifty-eighth dry run — ISS-191 and ISS-177

One agent took a check's population and a test's missing config directory as one run (3.35.68).
ISS-191: the cited-paths check now reads the parts this repository describes itself in — a population
stated as two data structures with every excluded part carrying its reason as a value, and a case
holding the two lists to cover every tracked source and document so a directory added later is red
rather than silent; seven citations corrected, one of a file that never existed, four illustrative
foreign paths rewritten from a placeholder root. ISS-177: not the one-line fix its title said — an
empty config directory alone made the case worse, because the filing verb reads the tracker's rank
declaration before the body, so the case moved to the feedback verb and took its room from the suite's
own fixture. No production file changed for it. No restart owed. Both closed by the run. Folded from
the record.

- The reported premise was wrong and the record said so before the plan: three of the six citations
  the issue listed were misreadings and three resolve under a rule the issue put out of scope. The
  outcome still held, so the run went on; a false premise ends a run only when the outcome falls with it.
- The whole tree was measured before the population was chosen — hundreds of findings, most of them
  test fixtures — and the measurement is what made the two lists defensible. Choosing a population
  without measuring the whole is the same guess the issue itself made.
- The new case sat in a gate step whose declared reads excluded three of the files it read — the
  never-red-only-absent failure — and was moved to the step that reads the whole tree; that step's
  measured comment was re-measured rather than left stale.
- A blanket exclusion the review called broader than its reason was narrowed to three entries each
  carrying its own; the remedy of including the package's readme was measured and refused, since its
  citations are literal values a consumer types. Seven filings onward, one loose end handed to the
  parent: the check has no clause in its requirement while every sibling has one.

## Fifty-ninth dry run — ISS-188

One agent closed the seven shell shapes ISS-86 left (3.35.69). The span and move reading left a
harness file that stood at exactly its line ceiling for a module of its own under the plugin's source,
one module because the move is read span by span, re-exported so no gate's imports moved. Then a comment
is outside every span at the one place every gate reads; a frame per subshell opened and closed, a
closing bracket popping only the frame its opener made; the compound keywords and the brace group
admitted, a whole shell word read; and a destination the text does not carry answers a sentinel the
guard treats as a tree with work at stake, saying so. All seven reproduced first; each mechanism
reverted alone turned only its own case red. Restart owed, wider than the ship step printed: the reading
now lives in a third file the two it named import. Closed by its run. Folded from the record.

- The green suite could not see two defects; the second opinion did, both narrowing in the dangerous
  direction — a command substitution's closing bracket popping a subshell the command was still inside,
  and a loop keyword after a failed move read as proof it succeeded. Worth copying into every dispatch:
  revert each mechanism alone, and get a second opinion that reads the reading rather than the tests.
- No document changed, because both the hooks document and the how-page sit within a few characters of
  their caps; the one clause that fit did so only by rewording a ranking into a disjunction that dropped
  a fact, and was reverted. A cap met is a cap, not an invitation to say less than is true.
- Three defects filed: a fresh worktree makes every file a read names count as written, so the turn
  gate asks for a consult the turn does not owe — met in the first minute, on every worktree run
  (ISS-200); the move reading answers the same nothing for never-moved and unnameable (ISS-211); one
  token inside data in a heredoc flips every literal in the body into a shell command, which refused
  the write of this issue's own cases (ISS-212).

## Sixtieth dry run — ISS-156

One agent let a verdict survive the landing that follows it (3.35.70): a verdict may cite the head a
run judged rather than the commit the landing produced, where the mark's note says the landing moved
none of the change's own paths — the note's grammar gained the judged head and what the landing moved,
the tested entry check spends them as one refusal item for the whole set, and the rule lives once in the
contract with its boundary stated: the equivalence is about paths, not behaviour. The run proved it on
itself — sixteen criteria judged at the branch head, shipped, the diff between the judged and the landed
head restricted to the change's ten paths measured empty, and the advance answered that the record
earns it with nothing re-posted. Two skill files changed, so a restart is owed. Closed by its run.
Folded from the record.

- The issue wrote half of a larger disagreement and said so: the skill judges at one phase and ships
  two later, while the contract's ladder earns the developed status from a landing. The shape all four
  re-posting runs stood in is now ISS-218; the finer per-criterion rule the outcome asked for is
  undecidable from the record because a verdict's evidence never names a path, and is ISS-207.
- A test file split at its line ceiling moved four cases to a new file, and three acceptance clauses
  still cite the old one as their proof — green throughout, because the cited-paths check asks only
  whether a path resolves, not whether the thing it is cited for is still there. Routed as ISS-217
  because the tree was held; the check's next rule is written in that filing.
- The contract credits a review grammar the record verb does not accept, so a partial disposition had
  to be written as a rejection with the folded half in the reason; a comment on the issue that made the
  grammar. A version typed by hand into the release note named the version before the one the step took;
  nothing reads the subject, so it stands, but the note is a value the step should fill.

## Sixty-first dry run — ISS-203 and ISS-36

One agent took two tracker defects as one run (3.35.71). ISS-203: a page says whether it was whole
from the envelope the tracker sent, with the caller's own limit as the fallback bound, replacing a
length-equals-limit test the byte cap never satisfied; one shared reading serves the four callers,
including a warning that had never fired at all. ISS-36: an issue key is the tracker's own shape — the
prefix and digits — so a spec citation is refused before the first call and routed to the spec verb,
retiring the third copy of a loose pattern. No restart owed. Both closed by the run. Folded from the
record.

- The tracker answered a shape neither issue anticipated — both caps at once in one field — and the
  code was right by construction because it prints what the envelope said, while the issue body and the
  projections document describe the caps as alternatives. The doc is incomplete rather than wrong, and
  the run said which, so the next run on that file knows.
- The issue's own out-of-scope pointed at a home that had been dropped, so a fresh filing was needed
  where a comment would have done; anything else routed into that home is orphaned with it. A drop
  should name where its routed findings go.
- Five defects filed as met: a gate self-guard that flakes under load (ISS-213); the finder's comment
  route invisible to the read-first gate (ISS-214); a gate budget that fails open in silence (ISS-215);
  the issue reader's field flag refusing every field the answer carries (ISS-219); the conjunction check
  reading inside code spans (ISS-220). The dependency verb's refusal under a personal token was confirmed
  live (ISS-8) and the edge recorded by the route the refusal named.

## Sixty-second dry run — ISS-14

One agent dropped the oldest high-priority issue as already fixed, in twenty minutes and with no
commit. The premise as filed was gone: the fenced record form landed for another issue in 3.35.4,
whose plan named this one as the part it deferred and whose ninth criterion is this issue's first rule;
six adversarial values round-trip byte for byte, and a suite already pins both directions. What survives
is the legacy bullet-form reader, which still splits a repeated field on the separator — which is what
the issue's own second rule asks of it, and which cannot recover a boundary it did not join. Folded from
the record.

- The drop was earned by a measurement, not a reading: every issue on the tracker read whole, three
  hundred legacy records found on seventeen issues, every one on a closed or dropped issue, and the
  advance's own assembly run over all of them with no status-bearing record failing its shape. The bound
  was stated — sixteen comment pages came back cut with nothing to read behind them, all on closed
  issues — and the reopen path was argued closed, since a reopen unearns the old verdicts and the fresh
  records are fenced.
- The first scan concluded there were no legacy records anywhere, off a list that returned fewer than
  half the project's rows while claiming it had kept the most recent; the seventeen issues were in the
  missing part. Filed high as ISS-221: any agent picking work off the unfiltered list silently misses a
  fifth of the backlog. The working route is a status-and-priority walk, every page complete.
- Three surfaces still cite the dropped issue as owing the separator rule; two were outside the hold and
  the retirement rule forbids clearing one surface without the others, so it went as ISS-226 rather than
  a partial edit.

## Sixty-third dry run — ISS-165

One agent read a batch of twenty releases as a whole (3.35.72), the first reading the ship's volume rule
filed for itself. Eight simplifications from one read: a shared markup pattern in the markdown module
with two local copies removed, a reader collapsed to one call, one predicate spent at three walks, dead
locals dropped in three tools. Neutrality was proven by running — a before-tree taken from the range's
start, one probe over every markdown file and twenty-odd call cases, and each of the nine mechanisms
reverted alone leaving the probe's output identical. The one-copy guard grew a row and was watched
firing both ways. The mark moved to the range's named end; the fifteen releases since stay owed to the
next reading. No restart owed. Closed by its run. Folded from the record.

- The dispatch cited the gate-review skill for a code-simplification reading; that skill is about a
  gate's wall clock, and no skill covers a batch reading. The run stood on the contract's review part and
  the issue's own rules. A batch review dispatched this way will meet the same gap every time until a
  reference says what a whole-range reading owes.
- Findings posted into another run's issue with the finder's route die with that issue: two holders
  closed before the comments landed, and three findings had to be re-homed as issues of their own
  (ISS-222, ISS-223, ISS-224), a fourth pre-emptively (ISS-228). A finding on a live issue is a comment;
  a finding on an issue about to close is a filing. The dependency verb demanding the target's lease is
  what made every routing prose instead of an edge, filed as a plugin defect.
- One finding was refused on the issue's own scope rule — a double tree-walk whose removal is a real
  change rather than a neutral one — and holds its own issue (ISS-216). A review that simplifies is held
  to the range's behaviour; what would change it is the next issue.
- Two shas on the record deliberately: the review cites the reviewed head and the landing another,
  with the mark's note carrying both and the byte-identical patch as the reason — ISS-156's rule, spent
  the first time by a run other than its own.

## Sixty-fourth dry run — ISS-51

One agent retired the workaround every brief this week carried by hand (3.35.73). The recheck refusal
had shared one sentence, naming no route, across three situations — no answered consult on the files, an
answered one that read only part of the set, and a whole-set pass that found nothing — and each now
carries the exact command that clears it, quoted for the shell. The reviewer's diff tool, asked with no
path, had handed over the whole checkout against the head, so a review judged the branch for code it
never touched; it now answers with the diff the consult is anchored to over the files named, and reports
a scoped failure instead of widening. Six review rounds, ten findings, all accepted and refuted. The
anchor wiring is covered by a real recheck against a stand-in gateway, since no unit test reaches it. No
restart owed. Closed by its run. Folded from the record.

- The most useful outcome of the rounds was a deletion: the whole-set branch had been asserting a
  contract-level conclusion — no further round owed — out of log fields, and three rounds each found
  another way the fields could lie, so the claim is gone and the document says a refusal reports the log
  and stops there. A refusal states what it read, never what it concludes.
- The other half is elsewhere: the flow's owed reading still reports a recheck owed after a clean
  whole-set pass, so until that lands the flow keeps pointing runs at a verb the CLI now refuses. The run
  posted it on an issue that had already closed; re-homed by the parent as ISS-230, the same lesson the
  batch review taught one run earlier.
- The run corrected its own filing: an out-of-scope clause said the ship's version commit conflicting on
  every rebase was worth a note if it recurred, and it had recurred twice inside that run; the note was
  posted rather than leaving a prediction the run had itself falsified (ISS-225).

## Sixty-fifth dry run — ISS-217

One agent corrected three acceptance clauses whose proof cited a test file the cases had left
(3.35.74): a three-line fix, eleven criteria pass, the full gate green, the reviewer confirming each path
case by case. Only the citation half was built: the check that can tell a proof citation from a path
that merely resolves needs the proof field to name a case rather than a file, a per-clause judgement over
two hundred clauses, so it was filed as ISS-231 with a next line rather than half-built. The ship filed
the next batch reading itself, ISS-232. No restart owed. Closed by its run. Folded from the record.

- The filing for the second half carries a fact that corrects a plausible assumption: the proof field
  sits outside the clause digest, so the edit left every hash byte-identical and extending the field owes
  no re-revision — and that same fact is why the rot was silent. A bound found while reading goes into
  the next issue's body, where the next run reads it first.
- The run corrected a belief it had carried in: that the flow ends at released. The record report now
  says a run ends at closed, and the run followed the tool. What the tool says outranks what a run
  remembers, which is the reason the tool says it.
- Every plugin defect met was already on the tracker, under six keys for one verb; nothing new was
  filed and the sibling link went in prose on both bodies. The dependency verb's refusals are the most
  repeated cost of the week and its issues the most numerous.

## Sixty-sixth dry run — ISS-153

One agent put one did-you-mean helper under every refusal that turns a name away (3.35.75): the helper
says what was given, the nearest names, and the whole set where it is small, so twenty call sites gained
it unedited — including those in files the run could not touch; a verb's flags are read off the row the
top-level help already prints, and eleven verbs ask before the shared parser reads a value and before
any endpoint resolves. Flags the withholding rule keeps off a row are declared beside the verb and
suggested to nobody, probed on the installed copy. No restart owed. Closed by its run. Folded from the
record.

- The issue reported a message defect; the run found the flag was dropped and the whole body came back
  at exit zero, reading as the one field asked for. A refusal that does not fire is the defect, and the
  message it would have carried is the smaller half. Confirm the shape before believing the report's
  reading of it.
- The half in held files — the verbs that parse their own flags and a checker to hold them — went as
  ISS-227 with an advisory lease saying it is not being worked, so a reader sees a claim and a reason
  rather than an orphan.
- Two defects filed as met: the dependency verb on a personal token once more (ISS-229, a duplicate of
  ISS-149, both noted), and a repeated record field keeping only its last value in silence — it dropped
  four routed findings from this issue's own record (ISS-234). A field that repeats and keeps one is a
  write that lies about what it kept.

## Sixty-seventh dry run — ISS-200

One agent gave the freshness reading a floor (3.35.78): a path a call names counted as written when
its modification time was within two minutes, a ceiling with no floor, so in a worktree cut a second
earlier every read raised the turn gate's debt — and, a second symptom the issue had not recorded, a
read of a skill file was blocked outright. The floor is the moment the call was asked for, read as the
timestamp of the last assistant record in the event's transcript; measured in the run's own transcript
that the record lands before the tool runs, that each agent has its own file, and that a subagent's
carries no prompt record at all, which ruled out the turn's start. Where no transcript can say, the old
reading stands. Both mechanisms reverted alone fail the key case. A harness file and its how-page
moved, so a restart is owed. Closed by its run. Folded from the record.

- A cleaner-looking alternative — reading whether the tree is git-clean — was rejected with a case: an
  edit and a commit in one call leave the tree clean and the write would be lost. The alternative
  chosen is the one whose failure is a case that fails, not the one that reads simplest.
- The second opinion found the floor is the request and not the call, since blocks of one message share
  the record's timestamp; inherent, so the claim was corrected in the how-page and the use case rather
  than the code. Two real narrowings it raised were named as outside the use case's reach and filed as
  ISS-235, and the recheck's automatic verdict was overridden to not-taken-with-reasons rather than left
  reading as three accepted findings nobody fixed.
- The reproduction came first and against the pre-fix code in a real worktree, which is what found the
  second symptom. A defect reproduced in the reporter's terms is the smaller half of what a reproduction
  finds.

## Sixty-eighth dry run — ISS-218

One agent told a run one order (3.35.76, 3.35.77): the landing is the ship's first step, judging comes
before it while the issue is still in progress, and the two statuses that a landing earns move at the
ship on the record the judging wrote. The order landed across the skill, its verification reference, the
contract's flow table and developed part, the flow's phase hint and the diagram; a second release
carried the two surfaces the whole-set pass caught — the figure's arrow sequence and one contract
sentence. The defect class is mechanized: a case reads the phase-owed cell off the code's table, the
contract's table and the figure's the same way, and was red on the untouched tree, where the figure had
already drifted. Two skill files moved, so a restart is owed. Closed by its run. Folded from the record.

- Thirty-eight verdict records where nineteen carry the meaning: the whole-set pass was taken after the
  judging, since the rebase owed it; it raised a major finding whose fix moved two of the change's own
  paths, so every verdict was owed again at the landed head. The criterion saying no verdict is re-posted
  after the ship was literally false and was corrected in the open — the re-post was the review round's
  cost, not the landing's, and the landing moved nothing. The pass that earns a review has a shape and no
  place, so a run judges before the read that could refuse it: filed as ISS-236 with this run as its
  measurement.
- One clause still states the verdict rule ISS-156 replaced, and the run that corrected its neighbours
  could not carry it because its own criteria pinned every clause's revision and hash (ISS-233). A
  criterion that pins a hash pins the drift beside it.
- The ship printed the owed batch reading's launch line twice in one run — once per release. A line a
  step prints is owed once per range, not once per ship.

## Sixty-ninth dry run — ISS-231

One agent made a proof name its case (3.35.79): a reader of the acceptance clauses reports the clause
whose named case is gone, with the nearest names in that file, whose test-file citation carries no name,
or whose escape names no issue; a suite runs it over the requirements against the real test tree with
floors on what it read. A hundred and sixty clauses now name their case and eleven take the escape with
one issue's key (ISS-237). No clause was re-revised: every identifier-and-revision pair is byte-identical
before and after, the bound ISS-217 had found and written into this issue's body. Three review findings
accepted before the commit — the escape requires a key, the case reader takes every quote style the
linter allows and refuses a computed name, and the reader is handed the citing document so it tries both
stated bases instead of skipping a clause in silence. No restart owed. Closed by its run. Folded from the
record.

- The run stopped once mid-run, waiting on a consult it had started, and was sent back by the parent to
  finish. A run waits on its own background work in the same turn; a stop with a consult in flight reads
  to the parent as a hand-back with nothing in it.
- A coupling to carry forward: renaming or deleting a test case now turns a requirements clause red, and
  most clauses cite files other runs hold. The run checked the two releases that landed after its own
  and found no case removed, so nothing is red today; the next run to rename a case learns the rule from
  the gate.
- A gap recorded: the method has no route for an approved issue whose out-of-scope line contradicts its
  own outcome, which cost a decision record and a correction. An issue reviewed against itself before
  the plan would have caught it in the confirmation.
