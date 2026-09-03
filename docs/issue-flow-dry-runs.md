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

