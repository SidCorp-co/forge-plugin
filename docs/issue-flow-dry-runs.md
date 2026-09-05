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

## Seventieth dry run — ISS-152

One agent gave the project's knowledge store its verb (3.35.80 to 3.35.82): list, read, write and
search over the tracker's store, the write carrying the shape the schema declares, and the rule that a
batch reading ends by writing what it learned of the codebase — one entry per module as a reference, and
the project brief. Three releases: the verb, one carry line the review found, and one paragraph recording
a decision that had been true by accident — on a project with a prose language an issue description is
translated and a knowledge entry is not, because the writer translates one argument and the store's tool
carries its text at the top level. No restart owed. Closed by its run. Folded from the record.

- The next batch reading's body (ISS-232) was frozen at its filing and predates the rule this run
  added, because the ship generates a body only when no issue is open for the mark. The run told ISS-232
  by the finder's route and verified the comment on the tracker; without that, the reading the parent had
  named as next would not have been told to write anything. A rule added mid-flight is posted to every
  open run it binds.
- The reading's range end is pinned at a named commit, so it stops short of this run's own three
  releases; the verb falls into the batch after. The named-not-defaulted end is what makes that a fact
  rather than a surprise, and the ship's volume figure is the mark-to-head count, not the reading's scope.
- The store still reads zero entries. The verb shipped; nothing has been written. A verb is not a use,
  and the first use is the batch reading's to make.
- Two defects filed: the half that belongs in held files — the first phase reading the store, a review
  writing a half-followed convention as a rule (ISS-238); and a flag in a body-path slot opened as a
  filename at three verbs, with one place to fix it (ISS-240).

## Seventy-first dry run — ISS-236 and ISS-230

One agent gave the read that earns a review its place and silenced the owed line's refused verb
(3.35.83). ISS-236: the whole-set read is the review phase's last step, taken after the replay onto
the default branch's head — chosen because the flow's phase table and the figure's arrow already read
the review as that phase's, and ISS-218's check pins the cell across three surfaces. The second half
answered: a landing owes no recheck at all, since the replay is the earning read's own first step; a
landing that moves one of the change's own paths owes a fresh whole-set read and its verdicts again,
never a recheck. Synced in one pass across the spine, the reference, the contract and the figure; the
retired clause is gone from every surface and a case pins the order, not merely the presence, on all
four. ISS-230: the owed line delegates to the same reading the refusal uses, so the two cannot disagree
by construction. Twenty-four verdicts pass. Two skill files moved, so a restart is owed. Both closed by
the run. Folded from the record.

- The run's own review found the figure's tested cell still stating the verdict-commit rule ISS-156
  replaced: the figure's copies of the contract's tables are held equal in one column and drift in the
  rest. Filed as ISS-241 — a check that pins one column proves one column.
- The planned mutation proof on the skill was refused by the learning gate, which reads a skill path out
  of a command's text rather than out of what the command writes, so a heredoc merely naming the file is
  turned away; the proof was taken on the contract instead and the gate's defect filed (ISS-242).
- One gap stated rather than hidden: the new order was walked end to end but for one clause about
  commit-gate consults, because this change's own shape never demanded one. A clause reviewed but not
  walked is named as such until a run walks it.
- The run named the fold it could not make — this journal is outside a delegated run's place — so the
  parent would not read the omission as a miss.

## Seventy-second dry run — ISS-211 and ISS-212

One agent closed two defects in the gates' shell reading as one run (3.35.84). ISS-211: the move
reading answered the same nothing for never-moved and for a destination the text does not carry, so the
commit gate asked a different repository what a commit staged; the sentinel now travels to its one
caller, which refuses and names both ways to spell the tree out. ISS-212: the escape names were one set
for every interpreter, so one token inside a python body's data turned the body into commands and, a
deny losing the whole command, the write vanished; the names are now asked for by the body's own
language, with the whole set kept for a runner the reading cannot place, and three gates ask the one
lookup. Eight mechanisms reverted alone, each turning its own cases red. Verified against the installed
copy through its own hook entries. Seven hook files moved, so a restart is owed. Both closed by the run.
Folded from the record.

- The opposite direction was found and deliberately left: a shell heredoc whose body names any escape
  has its own commands dropped, so a body that adds one such line is allowed where the same body without
  it is refused. A false negative the issue's scope did not hold, filed as ISS-239 with the reproduction.
- A criterion asked the how-page to enumerate the escapes per language, which neither fits its character
  ceiling nor belongs there, since the sets are the code's; a correction narrowed it to the language
  deciding with one named in each, and the verdict says it was judged as corrected.
- A checker that landed mid-run — the proof reader from ISS-231 — caught the run's own test-file split
  breaking two requirements clauses. Rather than edit the held requirements, the two cited cases went back
  to the file the clauses name. The gate that lands under a run is the run's gate from that moment.

## Seventy-third dry run — ISS-233 and ISS-237

One agent took two requirements defects as one run (3.35.85). ISS-233: the clause that still stated
the verdict rule ISS-156 replaced was re-revised to refuse a verdict at a commit that is neither the
merged one nor the judged head the mark records, and a clause for the equivalence added. ISS-237: all
eleven proof escapes resolved and nothing in the tree names the issue. Thirty criteria pass, no
revision of the eleven moved. No restart owed. Both closed by the run. Folded from the record.

- The issue proposed seven re-citations; verification refused three and the review two more, each a
  case that would stay green while the clause broke. Two cases were written instead, both watched
  failing against deliberately broken sources. A proof is a case that fails when the clause does, and a
  citation that merely exists is the rot ISS-231 was built to catch.
- A credential defect found incidentally while checking one citation: the consult log appends the
  record raw, file bodies included, so a token in a reviewed file reaches the log on disk verbatim and
  the log verb prints it back. Filed as ISS-248, medium; dispatched next by the parent as the one
  finding of the day with a secret in it.
- One wall stands open six times: the feedback verb prints its near-duplicate block after filing and
  never folds at the documented threshold, so the dependency verb's refusal under a personal token is
  filed under six keys. The run dropped its own seventh and moved its one new fact onto the oldest
  (ISS-250 for the verb). A duplicate check that reports after the write is a report, not a check.
- Five clauses whose proof lives in held files were filed with their holders named (ISS-246, ISS-247)
  or as their own (ISS-251, ISS-252, ISS-253), one of them noting that the contract's first-stamp wording
  and a test's latest-mark reading disagree.

## Seventy-fourth dry run — ISS-226 and ISS-241

One agent retired a dropped issue's citations and held the figure to the contract (3.35.86).
ISS-226: three surfaces citing the dropped issue were retired in one commit — the contract keeps the
separator rule word for word and says where it is met, the figure's row says the same, the open-items
register lost the row and its header now covers any terminal status rather than a close alone — with a
case holding all three free of the key, watched to fire on each. ISS-241: three checks hold every table
the figure copies equal to its contract part cell for cell — the flow table, eleven scenario tables
paired by heading, both rules tables paired per table — and the repair was generated from the contract,
not typed: four rows the figure never grew, three stale cells, one renamed lead, two rules with no row.
The parks table is excluded by name with its reason in the check. Thirteen criteria pass. No restart
owed. Both closed by the run. Folded from the record.

- The review's one major finding was that the two rules tables had been flattened into one, so a rule
  moved between them passed under the wrong heading. A check that pairs by table proves the pairing; one
  that pools proves membership. Fixed, and each finding watched to fire after the fix.
- A fourth surface citing the dropped issue sat in the held requirements tree and went as ISS-249; its
  own description misstated the mechanism, corrected by comment through the finder's route. The figure's
  cited paths are checked by nothing, because the path check declares the docs directory whole but reads
  two extensions (ISS-263).
- Two defects filed as feedback: the note cap stated nowhere before the write, met again; and a terminal
  transition leaving the lease live, so two closed issues hold a finished run's lease and past the
  duration that reads as a run that broke. A finished run has no way to say it finished.

## Seventy-fifth dry run — ISS-221

One agent made every reader of the whole issue set walk the list to exhaustion (3.35.87): the
unfiltered list had returned fewer than half the project's rows under a notice claiming the most recent,
and the route the notice implied stopped early; the walk now lives in one place, and a sweep of every
list call across the source and the hooks found no reader outside it. One skill file changed, so a
restart is owed. Closed by its run. Folded from the record.

- The issue's own rule was found broken one line over, after the fix: a count line tells a reader to
  raise the limit up to the ceiling even when the limit already stands at it, which is unactionable.
  Filed as ISS-264 rather than folded in, since the run's criteria had been judged. A rule landed is the
  first thing the run reads its own neighbours against.
- A record value whose first word begins with two dashes is read as a flag; met and worked around on
  this run, filed as ISS-255 — the same place as ISS-240's flag-in-a-body-slot, and the two will share a
  run.
- Two clauses in held trees were routed: a use case owing an exhaustion clause (ISS-254), and a lease
  view asked for a page notice the browse verb no longer gives, posted on the issue that owns that view.

## Seventy-sixth dry run — ISS-248

One agent masked the consult log at the write (3.35.88), in twenty minutes. The issue's mechanism was
partly wrong and refuted on the record: the log never held file bodies — the sent set is a path, a hash
and a count, and replay rebuilds from the repository — and the route a secret takes is body to model to
reply to log, plus the intent, an error's message, the risks and a verdict's rejection reasons. The
masking became its own export with one pattern set in the tree, run per value and never over the
serialised line, because the value pattern reaches to the next space and would eat a closing quote. Two
cases watched failing without the fix; the installed copy probed with a fixture token at three depths
under a temporary config directory. The live log was counted without printing: none of its two thousand
lines match a credential shape, and the entries the deliberately broad masker would change are prose
about credentials. No restart owed. Closed by its run. Folded from the record.

- The issue said reuse the existing scrub; it could not be taken literally, since that reading clips at
  a length and a reply is the evaluation set. Reuse of a name is not reuse of a behaviour; the run took
  the pattern set and left the clip where it was, one definition in the tree.
- The smallest possible diff still touched a file the batch review holds — one added export and two
  lines calling it — recorded as a decision and reported so the holder could be told. A hold is a
  reading rule between runs, not a wall; what crosses it is said.
- Entries written before the release are still unmasked and nothing rewrites them; filed as ISS-266
  with the counts and the trade-off of a rewrite verb, since the live log's zero makes it a fix rather
  than an incident.

## Seventy-seventh dry run — ISS-232

One agent read the second batch (3.35.89), sixteen releases as a whole, and left the store its first
eight entries. The mark moved to the range's named end. Eight filings came out of the read — a fence
pattern declared twice, a fold decided twice, a frame reader written twice, a help predicate open-coded
at seven sites, a gate's third reading of a directory change, a parser that refuses ordinary prose and a
bug report about itself, and two complete, proven simplifications backed out whole because a hold
landed on their second file mid-run, their neutrality evidence on the issues so they are re-landings and
not re-implementations. Two hook files moved, so a restart is owed. Closed by its run. Folded from the
record.

- The one-home rule was promised in the plan and not checked by any criterion: one module entry
  restated a clause of the repository's own rules file, and the project brief the run wrote restated five
  sections near-verbatim, at an injection level that would have put a stale copy into every future run.
  Caught after the verdicts, corrected on the issue: the entry became a pointer, and the brief was
  superseded by ISS-147's, which wrote the same slug in the right shape. The store was then checked by
  semantic search against the rules file's themes rather than by grep. A plan's promise that no criterion
  reads is a promise nobody kept.
- Two module tables had gone stale in the sixteen releases since the read began — an export one landing
  added, two names another retired — and were re-read against the head they now carry. The store is
  written as the last step before hand-back, since a run's own ship lands after the reading ends.
- A third reading is already owed and unfiled: the range since this mark stands past the threshold
  after sixteen releases, and the ship declined to file it while this issue held the mark. Readings queue
  behind readings at the rate the tree moves; the threshold is met faster than a reading is read.

## Seventy-eighth dry run — ISS-249, ISS-246 and ISS-247

One agent gave four acceptance clauses a real case each (3.35.90): the clause citing the dropped
issue now names a case that writes a repeated value carrying the separator, a newline, bare fence lines
and a line reading as another key, and reads it back byte for byte; the drop-refusal clause names a case
that tells the mark's refusal from the status's, since the route holds two refusals with one sentence
and a fixture with both set would have proved the wrong one; the two linter clauses share one case whose
three arms show silence, then speech on a config alone, then a real linter naming the rule. Every
mutation ran on a throwaway copy of the tree. No restart owed. All three closed by the run. Folded from
the record.

- The run edited one test file the brief had not named and said so, with the reason — the file the
  sibling clauses already cite, held by no run — recorded as a decision with its undo. A brief's place
  list is a starting reading; a run that leaves it names the step.
- Three issues, one branch, under two hours: three fixes in one tree is the size that pays, where four
  earlier in the week did not.
- Two filings onward: an accepted review finding cannot say what it changed while a rejected one must
  say why (ISS-269), and the mutation evidence that proves each case goes red lives only in attachments,
  with nothing in the tree to re-run it (ISS-270). The ship auto-filed the third batch reading, ISS-267,
  the moment the mark was free.

## Seventy-ninth dry run — ISS-264 and ISS-266

One agent took two fixes as one run (3.35.91). ISS-264: the browse count line drops its raise-the-limit
clause at the ceiling, where the limit is the one thing that cannot move, and a case built off the
imported constant pins it. ISS-266: no rewrite verb — the run re-counted the live log and reproduced the
earlier numbers exactly, then added two facts the issue lacked: only the two named patterns fire, so no
on-sight credential shape matches at all, and of the four fields only two are ever printed back, so the
exposure was half the count; a rewrite would remove nothing and destroy text in an unbacked evaluation
set. The mask sits at the print, since masking the whole log costs sixteen times its parse and the hook
path parses it every consult. Verified on the installed copy against a sandboxed config directory: two
lines on disk hold a synthetic credential, none printed do, and the file is byte-identical after two
reads. No restart owed. Both closed by the run. Folded from the record.

- The review's one finding — that replay still sends old entries to the provider unmasked — was rejected
  as the issue's own stated scope and routed as ISS-268; it had caught a real ambiguity in the prose,
  which now says back to the caller and names the other side. A rejected finding that improves a sentence
  is still a finding taken.
- Two source files sat exactly at their comment-density ceiling, so neither could take a new comment;
  the reasoning went to the two topic documents and the rules stayed in the checkers — the division this
  repository asks for, so the run recorded nothing new for it.
- Eight open issues already cover the dependency verb's refusal under a personal token; the run checked
  the list first and filed no ninth. A defect filed eight times is a fact about the filer, not the defect.

## Eightieth dry run — ISS-262

One agent re-landed a proven simplification the batch review had backed out (3.35.93): the shell
typing helper lives once beside its sibling in the hooks' source module, the harness re-exports it on an
existing line since the file is at its ceiling, and both the commit gate and the consult log spend it.
Neutrality was re-proven against this head rather than inherited: the shared form and both replaced
forms agree on every tracked path plus twenty built cases, and the two refusals probed end to end diff
to nothing against the base tree. Two hook files moved, so a restart is owed. Closed by its run. Folded
from the record.

- The guard was the real deliverable: the one-copy test read two directories, which is why two copies
  survived; it now reads every source file under the plugin's source and hooks, each row carrying its own
  home, and was watched firing on the real shape one copy at a time. A guard that reads part of the tree
  proves that part.
- The review's one finding: the shell row's needle was the four bytes any shell quoting writes, so a
  module with its own reason to write them would have been refused with no route out. Narrowed to the
  whole escaping call, a criterion added, a correction recorded in the open. A needle that matches the
  idiom catches the idiom, not the copy.
- One clause deliberately not landed and handed on: the module's header still summarises what it held
  before two helpers moved in. It sits in the issue's out-of-scope and the issue is closed, so it goes to
  the third reading rather than landing unrecorded.

## Eighty-first dry run — ISS-147

One agent put the project brief in the store and made the first phase read it (3.35.92, 3.35.94):
the brief a run once rebuilt from the same six sources every time — three to four minutes and a score of
calls per run over fifty-two runs — is one entry the project verb serves, with digests of what it was
read from so a stale brief says which part aged; the skill's first phase reads it and the discovery
reference says what to do when it is absent or stale. ISS-238, the other half in the same files, was
shipped inside and dropped with its disposition on its own record. Three skill files moved, so a restart
is owed. Closed by its run. Folded from the record.

- The second ship reported nothing moved under the hooks or skills, measured from the first release's
  own commit; the run said plainly that a second ship's clean line does not cancel the first's restart.
  A restart owed is owed until a session restarts, whatever the last ship printed.
- A finding filed with a fix-size line was auto-folded onto an open issue by place rather than by the
  nearer reading, and had to be refiled with the new-issue flag; the mis-fold is itself named in the
  refiled body (ISS-272). The fold prefers a place match over a meaning match, which is a threshold
  question for the create path.
- One token in the verb table was edited in a held file because the flag helper derives a verb's known
  flags from that row, so a new flag could not parse without it — said on the record as mechanically
  unavoidable rather than taken quietly. The half that needs the held visibility reading went as ISS-271.

## Eighty-second dry run — ISS-263

One agent made the cited-paths check read every file of its declared population (3.35.95): the
extension filter is gone from both its jobs, the coverage case holds every tracked file to being read or
excluded with a reason, the figure class is asserted by name and a citation inside a markup element read
as a citation. No figure edit was needed — its three citations resolve — and no gate-step change, since
the case already sits in the whole-tree step, proven by planning a markup-only changed set. A clause the
gate never had was added. Two mutations attached, each reddening its cases. No restart owed. Closed by
its run. Folded from the record.

- Two of the issue's premises were false and corrected on the record: three markup files are tracked
  under the docs directory, not one, and the population was unread by fifty-five files, not none;
  covering it honestly cost four exclusion rows, all measured. A premise stated as a count is checked by
  counting.
- The version commit's subject names the release before the one the step took, because the note was
  typed before the step computed the number — the third run this week to do so. Filed as ISS-273: the
  note is a value the step fills, not a guess the run makes.
- The widened population reddens on any stray untracked file with a refusal naming no remedy, and rests
  on an unstated everything-is-text assumption; nothing fires today, and the price is named (ISS-274).
  The feedback verb offered to attach a finding to a released issue while calling it open, so the
  new-issue flag was needed — a status read stale at the moment of the offer.

## Eighty-third dry run — ISS-240 and ISS-255

One agent took the two readings of a value beginning with two dashes as one run (3.35.96). ISS-240: a
flag standing where a body path goes is refused as a flag before any file is opened, in the one body
reader so two verbs inherit it without their files being touched, and the filing verb asks its own body
slot first so the sentence arrives before a credential is resolved. ISS-255: one flag-word shape shared
by the four value readers and the preflight, so a value the shell bound to its flag reaches the parser
whatever it opens with, and only a bare flag word is refused, named as the token read. Seventeen criteria
pass; one verdict's own reason begins with two dashes and is stored intact. No restart owed. Both closed
by the run. Folded from the record.

- Two review rounds found three real defects in the run's own first shape — the preflight turning away
  bound values, a declared flag passing the body-slot check, a bare double-dash becoming a nameless field —
  all landed with cases, and every one of seven new cases watched to fail without its change, the
  mutation table a comment on both issues.
- A document outside the run's file list was narrowed because its sentence was the project's own
  decision contradicting the issue; recorded as a decision with its undo. A rule the change refutes is
  corrected where it stands, held file or not, and said.
- Two findings posted to issues the run did not hold, one of them noting its rules one to three are now
  met by this landing and naming what remains; a reader of that issue starts from the remainder.

## Eighty-fourth dry run — ISS-265

One agent re-landed the second simplification the batch review had backed out (3.35.97): one file,
where the filing verb's duplicate check now takes the live titles from the shared reader instead of
walking the list itself, an import gone and a comment that had become a restatement of the reader's own
gone with it; the second file was read and not edited, since it already held the shape. Neutrality
proven by running both forms side by side against the live tracker over four title shapes and nine pages,
once per process so the agreement was not the walk's memo, then against the installed copy; each
mechanism reverted alone restores the pre-change bytes exactly. Nineteen criteria pass. The changed verb
was exercised end to end by filing a real issue through the shipped bytes. No restart owed. Closed by its
run. Folded from the record.

- Two corrections to the brief's framing, on the confirmation record: the run the brief said had landed
  in both files had only held one of them, and the other landing named had changed the reader above the
  walk, not the walk; both files were byte-identical to the tree the first review had proved against, so
  this was a re-landing and not a re-derivation. A brief's history of a file is checked against the log
  before it shapes the plan.
- One filing onward: the review record has nowhere to put what a reviewer verified when a consult
  returns no findings, so the report went into the reviewer field (ISS-276). A clean review that says
  what it read is worth more than one that says nothing, and the record should have the field.
- The lease on a closed issue stays live until it expires, with no release verb — the third run to note
  it, already filed.

## Eighty-fifth dry run — ISS-271

One agent made a help pointer earned rather than assumed (3.35.98): the help reader had read any bare
token in a row's usage line as a tracker field, so a verb whose value is a local file was pointed at a
schema with no properties; token shape cannot separate the rows, so the discrimination is per value — a
value the caller fills from this machine is not one the tracker names, and a row earns the pointer only
where every value it declares is. Derived from the row's own line; nothing lists the verbs that take a
file. Four more verbs lost the pointer as declared collateral, each passing a body or bytes. Two cases
watched failing with the old predicate restored, one walking all twenty-four rows. No restart owed.
Closed by its run. Folded from the record.

- One review finding was rejected on the record: a widened pattern for a spelling no row uses would ship
  with no case that can fail without it. A finding about a shape that exists nowhere is answered by
  showing it exists nowhere, not by a guard.
- A comment in a held file states the old reason a verb answers its own help, and this change makes
  that reason false; routed as ISS-275 with the right reason written in the filing. A comment that
  explains a mechanism is the second copy this repository's rules warn of, and it went stale on cue.
- A proof citation followed a renamed case without a revision moving, as the requirements rules allow;
  the run named it as a side effect rather than leaving it to the proof reader to catch.

## Eighty-sixth dry run — ISS-260 and ISS-239

One agent took two bugs in the gates' shell reading as one run (3.35.99). ISS-239: a shell heredoc's
body is read as commands whatever escape name it carries — one line in the guard, with the shell
alternation given one home in the harness — while the consult-order gate's own scan of heredoc bodies
was deliberately left, since it looks for something else. ISS-260: the learning gate's third reading of a
directory change is gone and it spends the shared reading. Two review findings accepted on the way — the
directory-stack verbs' no-change flag moves the stack and not the shell, and option parsing ran past the
end-of-options marker — both fixed and pinned. Hook files moved, so a restart is owed, and it reaches
further than the ship's list said: the shared reading in the plugin's source moved too, so three gates
read a changed move reading though one has no file of its own on the list. Both closed by the run. Folded
from the record.

- Found while closing out and filed rather than folded: the learning gate joins a write token the shell
  would still expand — a home-relative or variable path — against the call's own directory, so three
  ordinary forms refuse from inside a skills tree. The class predates the run, verified on two earlier
  releases, but this landing made it reachable without a directory change, which is the ordinary case.
  ISS-279, medium: an over-refusal on writes landing nowhere near the guarded tree is how a gate gets
  routed around. The issue stays closed, since none of its criteria are falsified.
- The first filing of that finding folded into a same-place neighbour of the opposite direction and was
  refiled with the new-issue flag, with the fold named as designed behaviour and a cross-reference left.
  The fold's escape printed is what makes a wrong fold a one-line cost.
- The full gate last ran one commit before the shipped head; the final refinement was covered by the
  ship's scoped run and four suites, and the verdict says so plainly, with the cost of closing the gap
  stated. A verdict that names its own gap is worth more than one that hides it under a green.

## Eighty-seventh dry run — ISS-258

One agent gave the event-stream frame reader one home (3.35.100): a module that imports nothing, so
neither transport depends on the other; the tracker's transport and the provider's spend it, and the
is-it-framed test takes the shared name rather than typing the prefix a third time. The provider's own
sentinel and parse stayed where they were, since hoisting them would have changed the tracker's behaviour
behind a diff that read as a pure move. Neutrality proven by running nearly six thousand built frames
across the shared form and both replaced forms captured verbatim, then both consumers end to end against
a local event-stream server and a local gateway serving captured frames — identical bytes from base and
branch — and the installed copy the same way. The live tracker answers plain JSON, so that branch was stood
up rather than waited for. No restart owed. Closed by its run. Folded from the record.

- Two criteria were corrected in the open before judging because they asked for outcomes the change
  makes impossible: a revert probe wanting a green whole gate, when restoring either half restores a copy
  the new guard refuses; and a probe wanting a live model reply to match byte for byte. A criterion is
  judged as the review left it, and one the review proved impossible is corrected, not judged failed.
- The reader is not the standard's dispatch — it does not strip a leading space or join with a line
  feed — and both callers have always read it the private way; the divergence is stated at the module, in
  the docs and in two pinned assertions rather than quietly fixed. A behaviour two callers rely on is a
  contract, standard or not.
- A third copy sits in the Vietnamese tool's gateway client, outside the assigned files, and the fix
  depends on a decision nobody has written — whether that tool may import from the plugin's source. The
  run had asserted the boundary existed; the review caught it, and the doc now says it does not (ISS-277).
  The dependency verb on a personal token was filed once more with its workaround written out (ISS-278).

## Eighty-eighth dry run — ISS-257 and ISS-275

One agent gave the fold one home and a comment its true reason (3.35.101). ISS-257: whether a filing
lands as a comment on an open neighbour is decided once, in the neighbours module, which takes the
read-first hold and posts; the create path and the feedback verb each spend it and keep only what is
theirs — body, title, the relation flag, whether the write is soft, and every printed line. The neighbour
search stayed each route's own call because the raw create path is a third caller that must never fold.
Two new cases watched failing, one comparing the two routes' output from the fold sentence onward. The
review's one finding — a failure-keeper moved ahead of a show — was accepted, put back where the issue's
own rules had it, and refuted on recheck. ISS-275: the comment above the project verb's usage gives the
length reason and names its sibling. No restart owed. Both closed by the run. Folded from the record.

- The reading the parent asked for, on the record and on the related issue: one home does not settle
  ISS-250. The feedback verb has folded since its landing; one unfolded note carried no fix mark, and the
  run's own marked note was shown two neighbours at a high score and folded onto neither because neither
  named the same place. Both of the fold's signals fail on that wall for different reasons; what one home
  buys is that the answer is one expression on one line.
- A file the run only read gained a caller from the file it changed, while another run held the first
  file on a branch cut earlier; the run told the parent, since a rename there would break the fold and no
  gate catches the edge. An import across two live branches is a message owed, not a merge surprise.
- A sibling comment two declarations away states a fact three landings made false (ISS-280); kept out
  and filed, since the issue named one comment. The run's own note on a documented cap duplicated two open
  issues and was dropped, becoming the evidence for the second reading above.

## Eighty-ninth dry run — ISS-256

One agent gave the untrusted-data fence one source (3.35.102): the pattern's source lives in the flow's
machine, the issue-shape reader imports it and compiles its own flags, all three call sites byte-unchanged;
the one-copy guard gained a row needled on the class between the brackets, with two tests tying the needle
to the home's source and passing a prose mention as not a copy. Neutrality proven over every real issue and
comment on the tracker — seven readers captured at the base and at the landed head, nearly ten thousand
answers byte-identical — and each mechanism reverted alone. No restart owed. Closed by its run. Folded
from the record.

- The issue's suggested direction was wrong and the record says why: the file it implied should own the
  pattern already reaches the flow's machine through two hops, so that edge would have closed a cycle.
  A home is chosen by the import graph, not by which file mentions the thing first. A tree-wide search
  also found two copies where the issue listed three files.
- Two corrections the run made to its own record after review: a merged mark's moved-paths clause had
  been written as prose, and reading it back through the very module the issue touched returned two
  non-path fragments — re-marked with paths only; and both consults ran on rebased-away hashes whose
  contents were byte-identical to the landed change, which the comment names since the reviewed-head line
  cannot. A record is read back through the reader that will read it.
- The upload verb's refusal of a source file's type names no accepted type and no route, met again and
  routed to the issue that holds it rather than filed a fourth time.

## Ninetieth dry run — ISS-279

One agent stopped the learning gate refusing writes the shell would still expand (3.35.103): since the
shared move reading, the gate joined every relative write token to each tree the shell could stand in,
and a home-relative or variable destination reached that loop looking exactly like a relative path. One
predicate beside the token pattern: a leading tilde or a dollar the character class dropped means the
word names no directory here, so it is placed against no tree; a token spelling a guarded path on its own
face still denies. Reproduced first on the pre-fix code through the gate's own entry; both mechanisms
reverted alone turn their own case red; judged against the installed copy. One hook file moved, so a
restart is owed. Closed by its run. Folded from the record.

- The second opinion's braced-variable finding was rejected on evidence — allowed on the fix and on the
  head alike, since the match starts at the slash and the join already excludes an absolute token — which
  is why the fix has two mechanisms and not three; a case for it went into the suite anyway. A finding
  refuted by running earns a case as much as one confirmed.
- Its quoting finding was accepted as a bounded false negative with no code change: a quote-region scan
  is a second reading that can err in the over-refusing direction, the exact defect this issue removes.
  Declined deliberately, with the residual named in the decision ledger.
- Routed to the issue that holds it: the commit gate records a pending file by path and time with no
  digest of what the consult read, so this repository's own proof method — revert each mechanism alone,
  run, restore — re-charges a full consult on bytes already reviewed. It cost this run one consult, and
  costs every run that proves by reverting.

## Ninety-first dry run — ISS-272

One agent kept a recheck inside its consult's range (3.35.104): a recheck naming no file derives its
set from the range the consult it answers recorded, and never widens past it, applied only after the
owed reading has been asked against the set the caller stood on, with one line carrying both counts. A
unit case and an end-to-end case reproducing the reported shape both go red when the narrowing is
stubbed. No restart owed. Closed by its run. Folded from the record.

- One claim in the issue was false and changed the fix: the body blamed the lower effort on the line
  count, but a recheck steps its effort down before it looks at lines; what the widened range bought was
  the clipping and the call budget — five files clipped and four thousand changed lines against one file,
  nothing clipped and two lines. The rule aimed at effort was answered as a line naming the narrowing,
  on the confirmation record.
- A merged mark whose note read that the landing moved nothing, followed by an explanation, was parsed
  as a landing that moved paths, and the advance demanded eight verdicts again; rewriting the note earned
  the move at once. Filed fix-size, it folded onto the issue that owns the note's grammar — the create
  path's fold doing what it was built for.
- The project brief's stale line was left deliberately: a refresh is a whole-file write to a store with
  no undo, and three other agents were live. A shared store's write waits for a quiet moment, and the run
  said so rather than writing.

## Ninety-second dry run — ISS-259

One agent gave the help predicate one home (3.35.105): seven hand-written readers now read the one in
the flag module, a row in the one-copy guard needled on the literal and on the word pair, the two
any-position readers excluded by path with the reason beside the scan. Each of the seven proven neutral
by reverting it alone — thirty-eight captures identical every time, the guard naming the reverted file.
No restart owed. Closed by its run. Folded from the record.

- A wrong claim reached the tracker and was corrected in the open: the run read the answers-help mark
  off the command table alone, concluded six of seven sites were dead, and built its judgement method on
  it; the review refuted it — ten verbs set the mark beside their own export. The code was unaffected; the
  confirmation, a decision, the doc and a filing were corrected with a comment naming what moved. A claim
  about the whole tree is read off the whole tree.
- A comment arrived on the issue mid-flight — a complete, measured widening row from a sibling run —
  after the claim had reported no comments, and the run did not re-read the thread before shipping. It
  could not have landed anyway, since the sibling's own file still spells the copy; routed back with the
  file's new shape. A thread is read once more before the ship, since the claim's answer ages.
- A knowledge entry says the guard file is held by this run; it is closed. Left to the run whose subject
  the widening is, and named so a reader of the store knows the line is stale.

## Ninety-third dry run — ISS-277

One agent wrote down the direction an import may run between the two trees and landed the third
copy's row (3.35.107): no checker, rule or document had forbidden the Vietnamese tool importing from
the plugin's source — the absence of an upward import had been read as a boundary, which is inferring a
rule from a measurement. Three facts settle it: the shared module imports nothing, the plugin's source
reaches the tool only by spawning it, and the tool's entry already runs the plugin's dispatcher, so the
trees ship as one unit. Recorded with its reversal trigger in the layout section and at the primitive;
the knowledge entry that asserted the opposite rewritten in the same act. Only the field-name constant
crossed, since that client reads one line at a time off a buffer. Neutrality proven against a local
event-stream server with five chunkings and failure servers, byte-identical before and after and against
the installed copy. No restart owed. Closed by its run. Folded from the record.

- Two gate catches worth keeping: a test fixture copied the tool's tree alone into a fake checkout,
  which only modelled a real plugin copy while the tree was self-sufficient — the decision being enforced
  rather than asserted, fixed with a plan correction; and the review caught the run overclaiming that the
  guard's scan already reached the tree, corrected in the doc and the entry before the commit.
- The guard row handed back by ISS-259 mid-run was refiled against the file's current shape (ISS-295)
  with its measurement, since the file was free by then. A row written against a file another run holds
  is written against the shape that run will leave.
- A document sits thirty characters under its one-pass cap, so the paragraph had to be written to the
  length of the one it replaced; the next run to add anything there trips the gate after the writing
  (ISS-294). A cap met tells the next writer nothing until it fires.

## Ninety-fourth dry run — ISS-278 and ISS-280

One agent withheld the dependency verb on a credential that cannot write edges and moved a misplaced
comment (3.35.106). The gate key grew an action, since the same tool answers reads on the token and
refuses writes; the probe sends the write action with no ids, because the credential check runs before
argument validation, so it measures the class and writes nothing. Only the device-required refusal
records a gate. Verified against the installed copy: the verb off the help and the did-you-mean set,
a direct call refusing in one line, the tool still listed and its schema still printed. Every sentence
routing a run to the verb retired at once, across the contract, the diagram, the guides and the CLI
pages. No restart owed. Both closed by the run. Folded from the record.

- Eight duplicates carried the hand-built edge as their answer. One dropped as landed; six left open,
  each with a note closing that route and naming what stays live on it; one untouched because its real
  ask was a different verb's help. Reading each duplicate's remaining half is what keeps a withholding
  from closing an issue that only mentioned the verb in passing.
- A page that says the opposite of what the withholding retires owed nothing here, and its three stale
  tracker facts were filed instead (ISS-293), since touching the skills tree would have made a
  restart-free landing owe one. A fix that is only near the change pays its own cost in its own run.
- One ledger branch is pinned by a test and confirmed live on neither token: a paired device is
  assumed to reach validation and keep the verb. The run said so rather than claiming both.
- The third batch reading was owed again at ship and already open (ISS-267); the ship's counter reports
  the same mark every landing until a reading moves it, so the ledger note is the reading's, not a
  fresh filing.

## Ninety-fifth dry run — ISS-286

One agent taught the shell guard to refuse a sleep-polling loop (3.35.108). That shape is read
off the shared span decomposition as one more export, past the prefixes a shell allows before a
compound command, and an unclosed opener is dropped rather than swallowing the line; a lone pause,
one before or after a wait, and the shape quoted inside an argument all pass. The refusal names both
routes out and the tool's cap. The argument got its own topic page, since the guard's page sits two
characters under its ceiling and its claim is about a loss that cannot be undone, which a poll is not.
Proven by neutering the pattern and watching the case fail. Evidence captured from the installed copy,
not the worktree. Three hook files moved, so a restart is owed. Closed by its run. Folded from the
record.

- The one sentence the Outcome asked of a skill file another run holds went to that run as a
  ready-to-paste comment, and the skills tree stayed untouched. Two landings on one file are avoided
  by handing the wording over, not by waiting.
- One consult finding widened the shape to two prefixes and both were planted in the case before the
  recheck. A finding about coverage is answered with a case, not a sentence.
- A batch of verdict writes echoed the previous criterion's text on one criterion once; the standalone
  re-run was right and the smudged record was corrected by hand. The run left it named on the record
  because it did not reproduce; the fold filed it (ISS-296), since a wrong tracker write is a defect whether
  or not it recurs, and the batched write that landed the same hour may already be the fix.
- The harness's own tool description recommends an until-loop for waiting on a condition, on a
  different tool than the one the guard reads. The topic page names no harness tool on purpose, since
  the plugin runs in projects it cannot see; the adjacency is noted here so the next reader does not
  file it as a contradiction.

## Ninety-sixth dry run — ISS-289

One agent made a verdict write carry several criteria (3.35.109). Everything before the first
criterion block is shared by all of them, so one commit and one evidence set are uploaded once;
advance reads a batched write exactly as it reads one write per criterion, and the owed reading folds
several unjudged criteria into one item carrying one command. Proven on the run's own issue: twelve
verdicts in one call, twelve records read back, and the ladder walked off that one comment. Only the
flow module, a new suite, the record page and two clauses moved. No restart owed. Closed by its run.
Folded from the record.

- The other half of the same fold was seen and filed rather than folded in (ISS-297): after a merged
  mark moves, every stale verdict still comes back as its own item and command, which is the reopen
  case where the cost is largest. A change that halves a shape says which half it left.
- The new suite hangs rather than fails when a module-body assertion throws, because it reads the
  session key from whatever the run has; that cost thirty-six silent minutes and two orphan processes
  before it was understood (ISS-298). A test that can hang is a gate that can stall.
- The paragraph the verification reference owes was posted on the batch that held the file at plan
  time, and that batch had closed by ship time. A held-file note is addressed to the run holding the
  file when the note is written, so the fold re-routed it to the run holding it now (ISS-290).

## Ninety-seventh dry run — ISS-284

One agent gave the flow a measuring verb (3.35.111): where a run's minutes and rounds go, read off the
transcripts the harness keeps for a project, by phase and by tool class, with the refusals a run met
and the commands it repeated. Nothing written, nothing read from the tracker: it measures the flow,
not the backlog. Two one-line rows were taken in files other runs held, because the gate refuses a verb
without them; both holders had closed by the landing. No restart owed. Closed by its run. Folded from
the record.

- The hand profile that motivated the verb was wrong in three places the verb exposed: whole-file
  matching admitted twenty-six review subagents as runs, a process lookup for the ship was counted as
  the ship so the judging phase read as zero minutes, and the gate count came out at nearly double.
  A number produced once by hand is a hypothesis; the verb is what makes it a measurement.
- Read on landing day: the close phase is the second-longest here at thirteen minutes and forty-one
  calls a run, filled by gate runs after the ship and by ships run again. The cadence issue in flight
  (ISS-290) owns the first; the second is the rebase the ship's own advice prescribes (ISS-225).
- The other project spends a third of its tool time in poll-shaped calls, and its judging phase runs
  twenty-three minutes against four here. The guard that landed the same day (ISS-286) reaches the
  first; the second is what a batched verdict write (ISS-289) was added for, once that project's
  installed copy carries it.

## Ninety-eighth dry run — ISS-290

One agent wrote the gate's cadence into the verification reference and retired the as-often-as-it-
changes sentence from every surface (3.35.110), then landed a second release carrying the paragraph a
batched verdict write owed the same file (3.35.112). The reference now says when the gate runs and
when it does not, in one paragraph, where the retired sentence had invited a run after every edit. The
contract states no cadence, so the light path inherits the reference; a contract test holds the rule in
both directions and was watched firing each way. Twelve
criteria judged in one write. The skills tree moved twice, so a restart is owed. Closed by its run.
Folded from the record.

- The sentence another run handed over verbatim did not land as written: what landed is the
  obligation and a route to the guard's own topic, because the two waiting routes are already the
  refusal's own line and CLAUDE.md's first rule is that a checked rule is stated once, in the checker.
  The reviewer held that open through two narrowings and the run accepted it over the parent's
  instruction, with the reasoning on both threads. A handed-over wording is a request, and the
  one-copy rule outranks it.
- The handed paragraph was trimmed of its flag mechanics because the document gate measured it at
  0.26 against the record page's 0.25 limit. A paragraph written by the run that owns the mechanics
  is already a second copy of them.
- Two pushes were rejected by a moving master, each costing a gate and a rebase; the stale version
  commit recurred and the rebase that does not conflict is the silent case (routed to ISS-225). One
  review record carried a zero-padded sha and one attachment a misannotated grep, both corrected on
  the thread. A criterion worded as "cites no issue at a terminal status" turned false at release,
  since the paragraph cites its source for provenance; recorded, not re-shipped.
- Two gate defects were met and routed to their open issues rather than filed again: a heredoc-fed
  interpreter writes a guarded path the same gate refuses to a direct edit (ISS-37), and a pure read
  of a guarded path was refused before the call and reported as a change after it (ISS-81).

## Ninety-ninth dry run — ISS-288

One agent landed half of an outcome and parked the other half (3.35.114, then on hold as blocked). A
translation refusal now ends with the command that writes the text, in the shipped binary's own path
with this CLI's register flags, which is what forty help reads on the other project were for. The
core half, the release note translated by the CLI itself, stopped at a read-back comparator that
closes over the object before translation: with the note in the translation layer, every note write on
a Vietnamese project would land and then be refused as not read back as written. The comparator, its
wording and its case are in the flow module another run holds, so the design went to that run as a
comment and the park's reason carries it. No restart owed. Folded from the record.

- A half that can land is landed and the half that cannot is parked with its design on the holder's
  thread, rather than the whole outcome waiting on the hold. The re-dispatch reads the design off two
  places and owes nothing to the first run's memory.
- Asking the release script for one verb's help ran the release: it reached the gate against the
  shared checkout before it was caught, and landed nothing only because master had nothing to release
  (ISS-301, raised to high by the fold). A verb that acts when asked to explain itself is the one
  defect a run cannot afford to meet twice.
- Filing into an existing issue posted the same comment twice with no word (ISS-300), and a verdict
  flag typed for the next criterion block landed in the previous one, misfiling three of six (added
  to ISS-234). The second is the same shape ISS-296 recorded a day earlier from the per-criterion
  route, which says the neighbour smudge is the flag reader's, not the route's.

## Hundredth dry run — ISS-287 and ISS-295

One agent gave the did-you-mean helper an alias table read before edit distance, so a synonym answers
with the one verb it means, and widened the one-copy guard to the Vietnamese tool's tree (3.35.113). A
test rule holds the table to live verbs and refuses a row keyed on a retired name. The comment that
kept the tree out by judgement is retired, and the primitives page and the knowledge entry stop
saying the tree is unwatched. Both guards watched fire before being trusted. No restart owed. Both
closed by the run. Folded from the record.

- The widening's own measurement was stale: a help-predicate needle added by a later landing sat in
  the tool's entry in both positions, so the guard could not go green on its own. A measurement taken
  by the filing run is dated by the head it was taken at, and the taking run re-measures before it
  plans.
- The first fix dragged the settings chain into the second tool and was refused on review; the
  layout rule already written for the case (a primitive both trees need lands in the source tree, in a
  module that imports nothing) settled it, and the predicates split out with the old module
  re-exporting so no caller moved, including one a running agent held. A rule written down a day
  earlier is what made the second attempt a lookup rather than a debate.
- The two any-position help readers still spend the named predicate, and the row's exclusion list
  can go with them (ISS-299); it carries a hook file, which is why the run left it. A pointer comment
  and a correction (one of its rules described a rewrite this release already did) were left on it.
- Closing an issue does not release its lease: both showed this session as holder for three hours
  after the close, until collapsed to a minute with a closing next line. A closed issue with a live
  holder reads as claimed to the next run.

## Hundred-and-first dry run — ISS-293

One agent rewrote the forge skill's dependencies page against the tracker as measured (3.35.115). All
three of its claims were false on this token: the graph answers with two hundred nodes, an issue read
returns its relations naming the far end by key, and a relation sent on an update lands and reports
whether it created or updated. Each claim now cites the schema or the doctor's own report rather than
restating it, and the heading stopped asserting that the store holds no edges. One file moved, under
the skills tree, so a restart is owed. Closed by its run. Folded from the record.

- The first draft added a retraction mechanism and a claim about retracted edges that were never
  measured; they came from the tool description, the same provenance as the three claims the issue
  existed to remove. The review caught it, and a criterion was corrected in the open on the record
  rather than judged against its old wording. A page about what the tracker does is measured line by
  line, or it is the old page with new mistakes.
- Re-sending an already-expired edge is how the update route was measured without mutating anything:
  the graph was byte-identical after. A measurement that would change the store is designed as a
  no-op first.
- The ship's own install step rewrites every skill file into the plugin cache seconds before its next
  step tells the run to read one, and the landed-learning gate refused the read as a write (ISS-302;
  kept apart from ISS-242 by gate and selector, cross-referenced). The plugin walked its own gate for
  two turns.
- A high-priority open issue (ISS-69) plans a resolver for a relation shape the tracker now returns
  directly; the measurement was left on it before anyone builds it. A finding that saves the next run
  a module is worth one comment now.
- The push raced twice during the gate and the ship's advice re-ran the review each time, so one
  unchanged diff cost three consults (ISS-225, recorded as a gap).

## Hundred-and-second dry run — ISS-285, ISS-297 and ISS-298

One agent closed three flow issues in one release (3.35.116). A record write now ends with the one
line the owed reading prints, from a single reading shared by the trailer, advance and resume, so a run
reads the ladder off the write it just made and calls advance only to move. Stale verdicts after a
reopen fold into one owed item and one batched write, through builders shared with the unjudged fold
so the two cannot drift. The batched-verdict suite pins its session and takes its lease in a setup
hook, so a broken assertion fails in two seconds with a name instead of hanging the gate. Verified
against the installed copy: three verbs print the byte-identical line. No restart owed. All three
closed by the run. Folded from the record.

- The hanging fix was found narrower than it read when the run probed the landed file: a throw at
  construction, before the setup hook, still hangs, because teardown hooks never run when a module
  body aborts. The criterion was scoped to the setup hook, so the verdict stands, and the boundary is
  written on the record instead of inferred (ISS-122 carries the request-handler half and a note that
  it does not cover this one).
- Two declared deviations, each with a correction record: the trailer goes to stderr, because stdout
  is the record document whose last line the reader anchors on; and a refused reading prints the
  refusal's first line with its colon turned into a full stop.
- The sentence the skill owes for the trailer was posted on the run holding the skill files, which
  closed without it; filed as its own fix (ISS-311). A note owed to a held file is re-read against
  the holder's state at ship, not at plan.
- A recheck based on the parent of the landed head diffs only the version files, because the version
  commit sits above the change; the pre-ship sha is the base. The record page was measured at
  seventy-eight characters under its one-pass cap and its split filed (ISS-304).

## Hundred-and-third dry run — ISS-267

One agent read the third batch as a whole: forty releases and 2448 changed lines under the source,
hook and bin trees since the last mark, fixed at the head master stood at when the run began, which
matched the ship's own count exactly and is what proved the range was the one being re-counted. The
mark now names that head. Four issues filed, three open issues corroborated with what the reading
found, one line landed naming a tree the layout map had missed (3.35.117), and every module knowledge
entry brought current. The next reading is not owed: 168 lines against the threshold. No restart owed.
Closed by its run. Folded from the record.

- A third shell-word quoter was written four commits after the primitive was given one home, and the
  one-home guard stayed green over it because its row is two exact-text needles the copy spells
  differently (ISS-303, with the guard-miss detail on it). A checker whose needle is the copy's exact
  text is only proven against the copies it already knows.
- Dead exports were re-verified one by one after the first scan proved to have a false-negative mode:
  tests import dynamically, and a static import search does not see them. Posted onto ISS-114 with the
  dead parameter no checker class covers.
- Two claims in the parent's brief were wrong and are corrected here. The gate-review skill is about
  gate wall-clock profiling and says nothing about reading a diff; the issue body's own rules were the
  authority. And ISS-300 records two invocations sixteen seconds apart, so its defect is that the
  into-route runs no near-duplicate check, not that one call posts twice; `forge comment` is the route
  that refuses a finder without a lease (ISS-63), so filing into an issue is the finder's only one.
- A plan declaring a screen change with bold closing before the colon is refused as declaring
  neither, and the refusal names no markup (ISS-312); the trap was already written in the flow
  module's knowledge entry, which is where a run reads after it has been refused, not before.
- A knowledge write has no revision, so each upsert was captured with a read first as the only
  restore copy; one upstream 502 said it may have been processed, and the timestamp showed it had not.

## Hundred-and-fourth dry run — ISS-288, second half

One agent resumed a parked issue and landed the half a held file had blocked (3.35.120). The one
translation layer now names a path rather than a key and walks into the release note's user-facing
half, leaving the section and the technical half alone; the read-back comparator compares half by
half against the copy that was sent rather than the object it had closed over, in the same commit,
because without that every note write on a Vietnamese project would have landed and then been refused.
Proved by running it: an English note written through the installed copy from a directory whose
config says Vietnamese came back off the tracker in Vietnamese with the technical half byte-identical,
and the same note from a tree with no prose language came back English. No restart owed. Closed by its
run. Folded from the record.

- One part of the five-part design was dropped with a measurement rather than built: the
  trailing-newline hazard existed only for the comparator the third part replaced, and the tracker
  stores all three halves byte for byte. A design handed over at a park is a list of hypotheses, and
  the resuming run measures each before it spends a commit on it.
- The run edited two files outside its granted hold list because the outcome was unreachable
  without them, and both were the issue's own from its first half. A hold list written by the parent
  is a claim about other runs' files, not a fence around the run's own.
- A park is lifted only by the status move, so the two correction records and a rewritten plan field
  are the audit trail of what changed between the halves (ISS-13, open, is the explicit lift).
- Both defects met were already open and got the instance added (ISS-234: a one-value flag given
  twice keeps the last and reports success; ISS-276: a clean consult's qualifications have nowhere on
  a review record to go). Two qualified passes went on the thread as a comment so they are not lost.

## Hundred-and-sixth dry run — ISS-301

One agent made the release script's help safe (3.35.118). One table now says what each verb takes and
one reading walks the command line before dispatch, so no verb decides whether a help flag is help,
and an argument no verb takes stops the script by name before the first step. Verified in the shared
checkout itself: the shape that had reached the gate now exits with the verb's usage and no step
reached. The review's own route was verified unchanged in the real checkout. Twelve criteria pass;
three new cases fail against the old script. No restart owed. Closed by its run. Folded from the
record.

- The first commit read a flag's value as whatever followed it, so help typed after a value-taking
  flag still ran a release; the consult found it and help is now reserved from every value position,
  pinned by a case. A parser that answers help and takes values has this hole until it says so
  (carried onto ISS-227).
- The brief's figure for the script's line count was wrong by a tenth, but the file sits six-tenths
  of a line under the comment-density limit, so the plan's move of the usage text broke the gate and
  no other chunk helped. The table moved out and the usage stayed, recorded as a correction. A ceiling
  a file is near is worth measuring before the plan, and the near one was not the one the brief named.
- A comment on an unheld issue posted and silently took a lease once, then refused minutes later
  naming the claim verb; filed as ISS-315. With ISS-63 open and two runs reading ISS-300 differently,
  the finder's route is the one thing three runs today could not agree on; the only lease-free path
  found was a feedback filing with the exact open title, which folds as a comment.
- Filed ISS-313: the consult verb reads a bare dash as a filename where every other body-taking verb
  reads it as stdin.

## Hundred-and-seventh dry run — ISS-310

One agent gave the consult log a cadence (3.35.121). Every hundredth answered consult on the device
ends its output with one line naming `forge codex eval`, and that verb compares the last hundred
records with the hundred before them, per model, effort and prompt version: consults, findings, the
share kept, rechecks that raised something new, median time, tokens by kind and replies that could
not check, with the slot, model and effort proportions that moved between the windows. Run against
the live log it showed the day's reviewer switch as a proportion, seventeen of the last hundred on
the new slot. The log was byte-identical before and after. Seventeen criteria, five consult rounds,
five findings accepted and each pinned by a case. No restart owed. Closed by its run. Folded from the
record.

- The issue's own rule for the crossing (the count before and after the consult's write) could not
  give the once-per-crossing outcome the same issue asked for: two consults finishing together read
  the same counts and both announce. The mark became the record's own ordinal among answered consults
  in the written log, matched on id, timestamp and root. A rule that names a mechanism is checked
  against the outcome it serves before it is built.
- A verb added to the CLI owed one line in a file another run was reading, because the help test
  fails without it; flagged to that run rather than hidden. A test that names every verb is what
  makes a new verb visible to every holder.
- The score verb's median changed as a side effect, since rows with no recorded time had been
  counted as zero; the issue never mentioned that verb, and its numbers are now different and right.
  A shared reader fixed for one caller changes what every caller prints, and the report says so.
- A recheck's ruling was dropped when the reviewer opened the bold span with the finding id
  (ISS-314), so the automatic verdict never landed and was typed by hand. The log page now sits thirty
  bytes under its cap; the next paragraph there forces the split its own message describes.
- The ship filed the fourth batch reading (ISS-319): six releases and 627 changed lines since the
  mark moved this morning, past the threshold within the day.

## Hundred-and-eighth dry run — ISS-319

One agent read the fourth batch (3.35.124): 44728d4..299f437 under the three source paths, fourteen
files and 627 lines, all under `plugin/src`. The head it read to was fixed from origin at the run's
start and proved equal to the body's range by file and line count before the reading began. One
landing: four `export` keywords dropped from symbols nothing outside their module reads. Two issues
filed (a verb's closing block copied from the one beside it, ISS-327; two readers a previous fold did
not reach, ISS-328), one plugin defect (the push-race refusal names a rebase that conflicts on the
version commit the ship itself made, ISS-333), and five comments onto the issues that already carried
what it found, one of them correcting the run's own first framing of where a fix belongs. Seven
criteria, two consults at zero findings. The mark moved to the head read. No restart owed by this
range, measured on the two hook paths and not inferred. Closed by its run. Folded from the record.

- Master moved four times under the reading, and two of those landings touched `plugin/skills/`
  (ISS-321). The run reported the restart as that run's to say and not its own, which is the right
  division: a restart is owed by the landing that moved the file, and the fold says it once.
- The reading found four open issues describing the same release-note cap (ISS-46, ISS-170, ISS-181,
  ISS-243) and filed nothing new. Collapsing a cluster is a filer's write, and a run holding one lease
  has no verb for it: the ranker (ISS-322) sees four issues where there is one problem.
- A filing this run made against its own first framing was posted as a correction onto the issue
  rather than by editing the body: the record keeps both the wrong home and the right one.
- The ship's push was rejected once because another run's release landed during a 316-second gate
  run; the mark was then planted by its named ref. A ship that rebases past a release must not
  default the mark to whatever head it finds.

## Hundred-and-ninth dry run — ISS-321

One agent trimmed three skills across three releases (3.35.122, 3.35.123, 3.35.125): the issue-flow
skill lost 8,025 bytes, the forge skill 3,041, and the tree fell from 119,444 to 108,378, every cut
sentence named beside the command or refusal that states it now, thirteen of them run in the worktree
to prove they answer. The one-home check was widened so a skill sentence restating a hook's page or a
verb's line of help is red, watched failing on the parent commit against a real sentence in the plan
reference, and the one hit it found on the tree was cut. A registry seam for local guides landed
unwired. The stub conversion the issue asked for did not land: `forge guide <skill> [<part>]` needs
a hunk in commands.mjs and a usage line, both held by ISS-322, and the exact code is filed there.
Nine criteria, one correction on the record found at judging time and said so, one rewritten
criterion for the gate-review skill, which was measured clean and kept. Three defects filed (ISS-337,
ISS-342, and a finding onto ISS-206). Restart owed, once, for seven skill documents. Closed by its run.
Folded from the record.

- A stub whose one command is refused is worse than the fat skill it replaces: the body would leave
  every open session while `forge guide <skill>` answers nothing. The run landed the half that stands
  alone and filed the exact hunk for the half that needs another run's file, which is the same
  division as run 103.
- A criterion that bundled a measurement with the help text around it would have deleted the fact:
  "one part of one body is 21x cheaper than the whole" is a number this repository took, printed by
  no `-h`. The correction retired the enumeration and kept the number; found at judging, which the
  record calls the weak order.
- The gate-review skill was measured and not trimmed, because its own opening says it is written for a
  harness this repository has never seen: a pointer at `node tools/gates.mjs` would put one
  checkout's fact inside a global skill. Measuring against the rule and recording why nothing moved
  is the criterion, not the cut.
- Two duplicate posts (ISS-321's own thread and ISS-206), each because a grep over the reply made a
  successful write read as a failure; the parent made the same mistake on ISS-316 the same hour. No
  verb retracts a comment (ISS-343), and the post says nothing on a repeat (ISS-300).
- The three releases put seven skill files under the hand's feet, and the sessions open during them
  are reading retired text. ISS-320, which landed beside this run, is the change that stops a gate
  landing from owing one; skills still owe theirs until the stubs land.

## Hundred-and-tenth dry run — ISS-320

One agent made a registered hook entry run the copy the CLI would (3.35.126). `hooks/gate.mjs` and
`hooks/link-cli.mjs` are thin: each asks the same chooser the CLI asks per call, imports that copy's
harness, and falls back to its own copy with the failure named on stderr, so a gate that lands is live
in every open session without a restart and nothing is ever silently unguarded. The restart-owing set
became one declaration beside the chooser: the registration, the two thin entries, the chooser itself
and `plugin/skills/`, and a case walks the entries' imports transitively
and fails if the reachable set is not exactly that declaration. The hop costs 13 ms at the median on a
five-gate line with a ten-second budget, and the deadline counts from process start so a fallback buys
no time back. Two of the issue's premises were found false and retired where they were written: how
pages were never frozen, since `forge hooks --how` already dispatches per call, and the session-start
link script was never stale. Ten criteria, one accepted consult finding, one correction naming three
files the plan had not, two defects filed (a shell launcher pinned to the copy a session start saw,
ISS-340; a merged mark's note read as moved paths, ISS-341). Restart owed, once, by this landing itself, and it is the last a gate fix owes.
Closed by its run. Folded from the record.

- The issue asked for a paragraph in each of thirteen how pages saying the rule; the run refused its
  own issue's rule and put the sentence once, in a new `how/copies.md`, because thirteen copies is the
  second copy CLAUDE.md forbids and the how-page cap would not have held them anyway.
- The try covers the import only, never the run: a consumed stdin cannot be replayed, so a retry after
  the event was read would judge an empty event. Where a fallback sits decides what it can still see.
- The entries under `plugin/hooks/entries/` were deliberately left importing this checkout's harness,
  because the suite spends them to test this checkout's gate text; an entry that hopped would test the
  installed copy instead. A uniform rule applied to the test route would have blinded the tests.
- The declaration is the shared reader ISS-332 asked for, and the release script already filters its
  restart line on it, so ISS-332's gate imports it and declares nothing of its own. The ship that
  landed this change still ran the old filter and printed the set wrong in both directions; the next
  release prints the narrowed one.
- A premise read off the code and found false narrows the work: the run measured what was frozen
  before building, and half the issue's set was never frozen. Confirmation is where that is cheap.

## Hundred-and-eleventh dry run — ISS-322

One agent gave the CLI `forge next` (3.35.127): the open issues ranked off what the tracker holds,
priority, kind, band, age with a cap, reopens and what each blocks counted through the chain, with
three efficiency signals printed beside the score and entering no total: the median cost of past runs
in the same band, a restart flag on a body naming a hook or a skill, and a warm mark on a tree the
last landing touched. Eligibility drops print their own sentence, relatedness is read three ways and
each member's line says which, a batch is at most three fix-size issues, and `--why` accounts for
every point beside the number. Bodies are read a pass at a time in score order and the reading stops
on a bound, not a count, with a warning when no bound survives. Nothing is written. Fourteen
criteria, five consult rounds, ten findings all accepted, three corrections on the record. Live at
the landed head the order was ISS-316, ISS-317, ISS-318 on equal points, then two high bugs, with one
issue left out for a live blocker. One defect filed (ISS-347: a dropped blocker gates forever), and
the ship filed the fifth batch reading (ISS-351). No restart owed, and the ship's narrowed set said so
by name. Closed by its run. Folded from the record.

- The blocker floor is the contract's `developed`, not "a terminal status": two floors would have
  `forge next` call an issue blocked that `forge advance` moves without complaint. The verb that
  decides eligibility spends the reading the flow already refuses on, and ISS-316 must spend the
  same one.
- A single window sized off the count truncates the row a body would have promoted; the reading
  became passes in score order that stop on a bound. What review proved wrong was the criterion's
  shape, and the correction says so rather than fitting the code to the words.
- The criterion's own arithmetic was wrong: at this table's weights a four-issue chain is twelve
  points and cannot beat a thirty-point priority gap, so the achievable case is a five-issue chain
  on a high issue against a lone critical. A criterion that names numbers is checked against the
  table before it is written.
- Three of 350 issues carry the tracker's complexity value and all three are closed; no open body
  carries a size line. The band printed "unset (neither source)" on every row, which is the honest
  answer and the measurement ISS-334 and ISS-317 start from.
- Five consult rounds each numbered findings from one, and the review record's grammar takes only
  `F<n>`, so the run renumbered chronologically and wrote a gap record carrying the mapping; ISS-34
  owes the grammar. `record verification` refused every upload because the thread was past the
  comment cut (ISS-194), so the landed-head output survives only as prose in the record.
- Two agents filed the same defect within an hour (ISS-341, ISS-342: a merged mark's note read as
  moved paths) past the same near-duplicate search this verb now uses. The fold dropped one onto
  the other; the search's floor is what ISS-336's class of false holds and this class of misses
  share.
