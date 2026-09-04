# The forge CLI — the failures and numbers behind its shape

Four homes, and each fact has one. `forge -h` and every verb's `-h` are the **surface**. The skills
(`plugin/skills/forge/`, and its `references/`) are **how to spend a call** — payload forms, fetching
narrow, what a missing verb means, how to ask codex and how to read it. The code is the
**mechanism**. This holds only what none of them can: the failure that was hit, or the measurement
that settled an argument. If a line here could go in one of the other three, it belongs there.

Dates stay, because a measurement was true once and not forever.

## The way in

Dispatch is by own-property, not truthiness: a mistyped verb naming a prototype member ran it and
exited 0 with no output. A dropped socket is caught, because an unhandled rejection reads as a bug in
this CLI rather than a network that is down.

The tracker's write-time rules are carried in the binary rather than fetched: a guide costs 3–6 KB,
and paying that lecture for a typo cost more bytes than `forge -h` itself. They print on
`-h --full`, because ten lines went into every transcript that only asked what to type.

`-h` answered on four of seventeen verbs. The others read it as their own argument — a filename to
open, a uuid, a tool name — and three resolved project scope before parsing anything, so the one
command that says what to type was the one a caller could not run. It is intercepted before the verb
now, and a verb documenting actions of its own says so rather than being overridden. Help is an
answer, so it goes to stdout: on stderr, `forge -h | head` printed nothing and every caller learned
to write `2>&1` first.

## What the projections leave out

The uuid column was 22% of the browse verb's bytes and bought nothing. A null `plan` and an empty
`attachments` were 179 bytes of an issue's 1,938 and said only that the field exists, so absence means
empty. `format: "uuid"` and a 150-character regex asserting the same thing appear together on every id
field; a pattern *without* a format is kept, because that one carries the only copy of its rule.

Guides come back as Markdown, not Markdown escaped inside JSON: 49 `\n` and 10 `\"` per guide, each
tokenizing worse than the character it stands for.

Nothing here keeps its own copy of names the server already publishes — a local list goes stale
against the thing it describes, silently, and reports the server's newest feature as a typo.

## The guides are the tracker's, and seven of them are not this flow's

Read guide by guide on 2026-09-03, five of the twelve the tracker serves state a rule this plugin's
contract has replaced, and `pipeline-and-issue-lifecycle` disagrees with itself inside one page: use
`dropped` for anything discarded, and three paragraphs later, the recommended discard for non-work is
`closed` plus `unmark`. None of it is the tracker's fault — those pages describe the pipeline runner
it ships. The cost is what a passthrough did to agents in another project the same week: one wrote a
body to `writing-an-issue`'s six blocks and the filing lint refused it heading by heading, and the
same agent paid four calls taking non-work down the `closed`-plus-`unmark` route. An agent reads the
guides on its first call of a run, and two contracts at that moment cost a round every time.

So the verb reads them through a disposition of its own, one row per guide in
`plugin/src/tracker/guides.mjs`: a slug, why, the rules replaced in the guide's own words beside
what holds instead, and where to go — a verb this CLI has, or a file the installed copy carries. It is
code and not a project setting because it is this plugin's reading of the tracker, and a
contradiction is not a thing a project can rightly turn back on.

**Having a row is what withholds the guide**, and the two other pages are the reason the rule is
stated that way rather than by disposition. `memory-and-knowledge` and
`issue-dependencies-and-decompose` are the tracker's in one half and the runner's in the other, and
for two releases the verb served them whole under a first line withdrawing the half that does not
apply — which asks an agent to read a page and then hold part of it aside. Neither is a page it can
follow whole, so neither is listed. The disposition decides one thing now and it is not visibility:
`superseded` is what the overlap measure below scores, which is a different question — whether a
project's own file restates a guide's authority, not whether this verb serves the page. What a
maintainer's read prints is decided by the rules the row enumerates, and a row may enumerate none.

Nothing the CLI volunteers names a withheld guide — not the listing, not a count of what it left
out, not a near miss, not `-h`. Asking for one by slug echoes the slug the caller typed and answers
in the words a slug the tracker never served gets, from the same line of code, so the answer carries
no evidence that the guide is anywhere. ISS-66 hid the five and left four traces; the rule that took
them out is the user's, 2026-09-04, and *Withholding a verb* below states it once for the whole CLI.

A maintainer reviewing the table still has to read what it hides, and that read belongs under
`forge doctor`, which is the surface for everything this copy or this credential cannot use. It is
not there yet: `forge guide <slug> --tracker` is the escape in the meantime, documented here and
nowhere the CLI prints, and ISS-71 holds `src/tools/doctor.mjs` — the need is filed against it.

What is decidable by code is the slug and nothing more. `forge doctor` reports a row the tracker has
stopped serving, and notes a guide it has started serving that no row has been read against; whether
that new guide contradicts the contract is meaning, and the one mechanical signal available — the
overlap measure below — is blind to negation, so a restatement and a contradiction score alike. The
list of twelve beside the table is not a copy of names the server publishes in the sense the rule
above forbids: nothing answers a guide from it, its whole purpose is to differ from the live list
when the tracker moves, and a row this record lacks fails the suite, so the change that notices a
retirement is the change that drops the row.

The contract those rows send a reader to is answered by the same verb, and it had to move to be
answerable at all: installing copies `plugin/` and nothing beside it, so for six releases every one
of those rows named a file that existed on one machine. It is `plugin/guides/issue-flow-contract.md`
now, and `docs/` keeps a pointer so the requirement clauses citing a section still land. Whole it is
fifty thousand characters, most of them about a stage the reader is not at, so the verb serves it cut
at its own headings: a bare `forge guide contract` answers with the parts, their sizes and the call
for each, and a named part answers with that part. Two consequences worth knowing before either
surprises somebody. A heading is the address, so renaming one moves the call that reaches it and the
suite fails until the change admits that. And `forge doctor` prints the file's absolute path and the
contract number it declares, because a copy that arrived without it is indistinguishable, from
inside, from a copy whose rules simply say nothing.

The overlap measure has the same premise the verb just abandoned — the guide is the authority, the
project's own file the copy — so it no longer scores a superseded guide. It would otherwise ask a
developer to delete their line and defer to the rule the CLI stopped serving. An `overrides:` marker
still resolves against all twelve: a waiver names a guide, and which of them this plugin stands
behind is not the waiver's business.

## `new` — the shape is read before the tracker sees the body

What the flow charges per issue barely moves with the work: ten payloads and eight transitions
whether the change is a line or a feature. What varies is whether the issue can carry that, and both
halves of the answer are legible at the filing. A body with no outcome and no rule gives the
confirmation nothing to confirm, so the same shortfall is paid again at every status; and a filing
whose whole subject is one verb was never going to repay the toll. `forge hooks --how issue-shape`
carries the count behind the second half.

So the title and the body are read against that shape at the filing, on this verb and on
`forge_issues` called directly, and a body that fails is not filed. The sections are the ones the
tracker's own tool description asks a description to be — an outcome, a rule or invariant, an
out-of-scope — matched by heading rather than by prose; its `writing-an-issue` guide states an older
six-block form and is not the source. A title of one word, a title that is only a work verb and a
title carrying a file path each say nothing about the behaviour after the change. One sentence asking
two things of two different named tokens is the contract's split rule. A duplicate is measured
against the titles the browse projection returns for issues still open to work, at the threshold
this repository's own documents are held to: over the four filed that day it found one real
duplicate at 0.60 and no false positive. That page has no cursor behind it, so past it the
measure is what the tracker's own search returns for the tokens the body names — the same search the
fix route uses for its candidates, which is why a duplicate about the same thing is reachable past
that page, to the tracker's own ceiling for a search rather than for the backlog. What neither the page nor that search reaches is said on the way past, because
refusing every filing on a backlog that large is a refusal nobody can act on.

Where nothing in the body is a rule and nothing is out of scope, its size is the finding rather
than its shape, and three flags take such a filing instead of the tracker. `--into ISS-45` posts the
body as a comment there and files nothing, which is the route for a finding that belongs on an issue already open; it renews no lease,
because a finding on an issue nobody holds is nobody's claim. `--with ISS-45` files it and writes a
relates edge in the same create, so one branch, one review and one release carry both; it writes no
mark, because the flow such a filing is carried by is the related issue's. `--size fix` files it
marked. The refusal lists all three and, from a search on the token the body names, the open
issues that are candidates for the first two.

An empty body is refused before any heading is looked for, and the payload `-` refuses a stdin that
is a terminal or that closed with nothing on it: reading to EOF on one nobody fed waited two minutes
and then filed a titled issue with no body at all, which is the one filing the shape most has to
stop. Every verb taking a payload reads it through the same module now, so the two copies that
differed there are one.

The mark is the line `Size: fix.` in the description. The tracker auto-creates no label and offers
no tool to read one back, so a mark it owns could not be relied on; a line the CLI writes survives
every route, a person reading the issue sees it, and `forge advance --owed` reads it back off the
record like everything else. Its undo is an update that rewrites the description without the line.

## `record` — a payload has one shape

ISS-1's dry run of the issue-flow contract wrote nine payloads by hand: a confirmation, a decision
record, a baseline, six verdicts. Each was shaped at the keyboard, and the second run would have
shaped them differently. `forge record <kind>` owns the shape, so the reader and the checker find the
same fields every time, and a missing field is refused by name before anything is posted.

A record is a comment a person reads first: a heading, then the payload in a fenced block, then one
parsed line naming the kind and the contract. Both of those the prose pipeline copies byte for byte,
which is why the keys inside are the flags rather than the labels a reader sees: on a project whose
`.forge.json` names a prose language every body is rewritten on the way out, and a rewrite renames
prose. Eight verdicts and a verification earned nothing on such a project because the labels the
reader keyed on had become Vietnamese, and a criterion number read from an absent label keyed the
verdict map as `NaN`. A record written in the older form is read by its labels, and one whose labels
resolve to no field of its shape is named as rewritten rather than as the fields it appears to lack.
The verdict quotes the criterion's text as it stood
at the write, because the field can change later and the verdict has to say what it judged. Evidence
is an attachment name the issue carries, a URL or a commit, and a reference to a file on someone's
disk proved nothing — so a value that *is* a readable file goes up under its base name at the write
and is cited by that name, which is the `forge attach` and the re-send an author paid by hand. A
base name the issue already carries is refused there rather than attached twice, because a name
attached twice resolves to two documents (ISS-55). The upload comes after every refusal the record's
own shape can earn, so a shape a reader can fix costs no attachment; what is left cannot be undone,
because the tracker publishes no delete for an upload — a lease lost mid-command, a second file that
fails, or a comment gate that refuses the record after the first file went up. In each of those the
command names what it sent and the `--evidence` line that cites it, since sending the path again
would collide with the name already there. Named from before each PUT rather than after it: the
tracker can take a file and lose the answer, and a file nobody was told about is the one nobody
cites.

Two flags are read off the record when they are absent, and each prints where its value came from: a
commit from the merged mark's note, and evidence from the latest record of the same kind. The twelfth
dry run's verdict loop typed the same two values twenty times each, and both were already on the
record. Evidence is read from the latest record of that kind rather than from the attachment set, because
what an issue's evidence is belongs to whoever cited it first: the one attachment an issue carries
may be a design document nobody cited, and a default from it would turn a refused verdict into a
passing one. It is not read per criterion — one document answers twenty of them, which is where the
forty arguments went — so the line it prints names the record it came from and not the criterion. So the first of a loop names it — a path there goes up and is cited — and the rest inherit. A
default nobody can see is one nobody can catch being wrong, which is why neither is silent. And
neither is read at all where the comment list stopped with more behind it: the list takes no cursor,
200 is its ceiling, so past a full page the mark or the citation that would answer may be exactly
the comment cut off — the flag is asked for instead, which costs one value typed against a record
written on the wrong commit. The release note and the criteria go
to their fields, which the tracker already types; everything else is a comment. `report` assembles
the latest record of each kind and the latest verdict per criterion, and names the criteria no verdict
covers. Nothing is stored twice. The contract this serves: `forge guide contract`.

Two of the kinds exist because a reopen recorded nothing. The tracker has had a `reopen` status and a
`reopenCount` field all along, and neither says what the person found: what they expected, what they
actually saw and their own words went into a plain comment nothing read back, so the gap that let it
ship was never named. A finding is that comment typed, written by the agent on the person's behalf
and quoting them; a triage is the ruling on it, one of three outcomes and one line naming what would
have caught it. Both are marked as repeating, so `report` shows every one: the fourth dry run wrote
four corrections and reported one, because the assembly kept the latest of every kind.

Two more exist because the fold of a run was prose. A parent reading `report` got every payload that
earned a status and nothing about what the run met on the way: a defect it found on something else
and sent to the issue that owns it, and a place the method it followed did not answer. Sixteen runs
put both in a closing message instead, typed at the end out of whatever the agent still held, which
is the one moment neither is accurate. `routed` names what was found and where it went;
`gap` names where the method fell short and what was done instead. Each takes `--none` with a
reason, the way `decision` does, so a run that met neither answers rather than leaving an absent
record to read like an unasked question. Neither earns a status: a payload nothing told an older
copy about would refuse a run for a rule it could not have read, and the point of the record is that
nothing has to be told. `report` closes with the run's own worklog — the branch, the head, what it
touched and the plugin copy the capture was made under — so one read answers which copy typed it.

## `advance` — a status is earned, and the record is the only witness

ISS-1, ISS-2 and ISS-10 moved twenty-six statuses between them, every one a raw `forge call
forge_issues` transition, and not one refused anything: the record held each payload because the
agent chose to write it. `forge advance` puts the contract's entry criteria between an agent and
the transition, so a status nobody earned costs a refusal instead of a reader's trust.

Two measurements shaped what it reads. The merged mark stamps a time and takes no commit, so the
commit that landed lives in the note as `at <sha>`, read back from the audit comment the mark
writes; a review may name seven hex digits where that note names forty, and the shorter of the two
decides whether they are the same commit. Nothing is read from the repository at transition time:
git is asked at the step that knows the answer, and the answer is written onto the issue there.

`--owed` is a question and answers zero; the same list without it is a refusal and answers one, so
a caller can tell "not yet" from "here is what to type". Asked what is owed, it ends by naming the
contract's part for the status it would enter and the call that prints it, so the rule arrives at
the stage that needs it instead of at the start of the run: `forge guide contract <status>`.

A reopen was the one thing it had nothing to say about. It refused at `closed`, named the raw
transition, and a person's word then left the issue at a status no entry check answered for —
`--owed` said nothing advances from it. Two records route it now, the finding and the triage, and
where the reopen landed comes from the merged mark, because a mark is what says code landed and so
which of a close and a drop was reopened. The one measurement that shaped the routing: an outcome
alone would have sent a reopened drop *forward*, to `developed` from the `clarified` it fell back
to, so the landing status is a ceiling rather than a starting point.

And the plan gained a third declaration, `User-facing outcome`, which is the only optional one of
the three. What asks for a person's look before `released` was the screen-change line and nothing
else, so a result with no screen to it shipped with nobody having judged it; a use case a person
judges cannot be read off the criteria at the transition, because the clause that would say so lives
in the repository and no status here is decided from there. It stays optional because FR-05 carries
a shipped criterion whose sentence says the plan declares two lines.

Whether that look is owed at all is the project's, and the answer was already on the tracker: a
project has a staging branch, a production branch and a setting saying whether production deploys go
without being asked. So nothing new was declared in `.forge.json` — a second place to say it would
have been a precedence rule, a report that has to name which one answered, and an undo that misses
one of them. The verb reads that config where it reads the plan's declarations, and only where the
plan declares one of them, because an issue that owes no person owes no round to find out. A release
onto a staging branch is one a person can still look at afterwards, so it does not park; a project
that deploys its own production branch has said the same thing about production. What comes back is
one derived line on the verification — the project's answer, in a field no flag can supply, because a
line an author could type proves only that they typed it.

A third measurement, two runs later: an edge the tracker had already answered for forced a raw
transition twice. `relations.blockedBy` returns mentions beside orderings, each edge naming its kind
and whether it gates dispatch, and the entry check filtered that list on the blocker's status alone
— so a mention of an issue nobody will develop refused `in_progress` with nothing to type past it.
The check reads the edge's own answer now, falling back to the kind where the tracker sent none, and
keeps the blocker's status as a second test beside it: the tracker gates on a merged mark and this
contract's floor is `developed`, so the two answer different questions.

## `claim` — one run holds an issue, as far as a client can promise

The issue's session field was there from the start and nothing wrote it: measured 2026-09-02, a
search for it across this plugin answered nowhere at all. It now holds a lease — a holder, a renew
time, a duration and the claims before this one — taken by the pick and renewed by every payload
write the CLI makes. A run that dies leaves the field behind, and the field is what the next run
reads.

Three measurements shaped it. The tracker replaces that field rather than merging it and answers
with the keys in an order of its own, so the compare is blind to key order: the first read-back
rejected a write where nothing had changed. There is no conditional write (ISS-7), so the compare
is a read, a write and a read back, which cannot stop another run's write and only refuses to build
on it — `forge claim` says so in its own output rather than leaving a reader to assume otherwise.
And 429 is the only answer this tracker gives that means it did not process a call, so it is the
only one anything but a read is sent again on; a gateway status or a dropped socket is retried for
a named read alone, because idempotence is documented for the merged mark and nothing else. Which
actions those are is decided here rather than read off the arguments: one of them mutates with no
payload field at all, and an action this list does not name is not retried.

A lease past its duration is another run's to take, and the holder's own next write renews it and
says so. The first version renewed it without reading the state at all, and a live run then showed
a dead session writing payloads half an hour after its lease had gone, silently; the refusal that
replaced it named `forge claim`, which cost the eleventh dry run two rounds for a value the CLI had
already read. What makes the renewal safe is what the refusal never used: the field still names this
session, and a run that took the issue would have replaced the holder, so the two states that mean
somebody else's lease still refuse. It is safe as far as the read, and no further — a reclaim
landing between the read and the write is the ISS-7 window, which the refused route paid too,
because `forge claim` is the same three calls. That read is the last call before the write: the
comment gate every write passes was a round trip sitting between the two, and a review of this
issue's own change caught it there, widening a window the CLI cannot close by as long as a
comments list takes. A reclaim is a handoff between two holders, though, so a holder
taking its own lapsed lease back appends nothing to the history and brings no park closer.

The holder is the harness's own session, read twice to check that it is stable for the life of a
process tree. Outside a harness it is a file under the config directory, which names a machine
rather than a run: two runs there look like one holder and neither is refused. Each payload write
costs three calls for the lease — the read, the write, the read back — and every one of them pays,
because a park is three writes and an upload of four files is four: a run reclaimed halfway through
has to be refused at the next of them rather than carried to the end.

Two facts beside the lease itself. **The holder names the kind of agent and the process id
beside the session**, because a uuid places nobody: when ISS-26's shell died, whoever had to decide
between waiting for that run and taking the issue off it could read only a uuid, and could not tell
what had held it or whether it still ran. Every refusal that names a holder names all three. Both
come from the environment, since no file can name a run, and both read `unknown` where the harness
set neither — a lease written before they existed is still a lease.

**And the lease carries one line naming the step whoever comes next starts on.** `--next` sets it on
the claim, on `forge advance` and on any `forge record` that writes; every renew keeps it, because a
payload write is not a new step; and the transition it precedes clears it, because that step is over.
A claim that takes an issue over prints it, `forge advance --owed` prints it above the shortfall,
and the claim history keeps the line that was current at each reclaim, so a crash loop shows where each attempt
died rather than only that it did. Nothing checks the sentence — it earns no status and it is the
run's note to its successor, not a payload. It is written by the renew that precedes the write it
belongs to, which is the same call that refuses a stale holder, so a write that then fails can leave
the line describing a step that never started; that costs a sentence and never a fact, because what
earns anything is the record, and a second lease write to close the gap would cost three more calls
on every payload and leave a gap of its own between the two. The measurement that asked for it: the sixth dry run's
agent died mid-consult, and the one fact its record could not hold was which codex round it was in,
so the round was run again to find out. The verbs that write something other than a payload — a
comment, the plan field, an upload, a dependency edge — renew the lease and leave the line alone.

**Every write to an issue lists that issue's comments first**, because the read that looks complete
returns none of them. The renew that precedes each payload write is where the list is made, and the
one route that renews nothing, `forge call`, makes it from its own payload. An empty list costs one
line and no round at all. Comments this session has not been shown *are* the refusal: every one on
the page the list returns is printed whole, in the fence the tracker returned it in, with the count
when the tracker holds more, and the same command sent again lands — so
the round that is spent carries the content the rule exists to deliver rather than a pointer to it.
The delivery is recorded under `~/.config/forge/`, which is what makes one process's reading the
next one's and a run's reading its delegates' — the account's directory outlives both, where a
transcript belongs to one of them. What it takes to owe a delivery again is one document, `forge
hooks --how issue-read-first`, and the same state answers whichever route asks. Where nothing names
a run — a bare shell, no harness — the machine is the session, because a key per process would
refuse every command and no key at all would refuse forever. Two costs are the
routes' own rather than that rule's: a comment created through the tracker's tool returns its id to
a client no hook can see, so that one comment is handed back once; and nothing past the page the
list returns is delivered at all, the seam a cursor closes and the reason `advance` refuses an issue
with more comments than a page outright. The pre-hook makes the same list before the
call, for the tracker's own tool and for a `forge` write in a shell command alike: the plugin copy a
session loads and the `forge` on its PATH are separately installed and can be different versions, so
neither is trusted to be the other — one list twice on the path where both hold is the price, and a
gate switched off leaves the verb, which cannot be.

## `resume` — one issue's whole context, re-minted from what the last run wrote

ISS-26's shell died mid-review. What made the recovery cheap was luck: a file the dying run happened
to write to the one mount that still took writes, naming the branch, the head, the codex round and
the step it was on. The record held everything that had *earned* a status and nothing about the run
between two of them, so without that file the successor would have re-read the tree, re-run the
consult and guessed the rest. `forge resume` and the worklog beside the lease turn the luck into a
mechanism.

**The worklog is a sibling of the lease in the field the issue already has**, so it rides the same
whole-field compare-and-set with no second write path and no new field. It holds the branch, the
head, the base and the files touched, with the time they were read; the last codex consult with its
findings and what it owes; and a capped list of one-line dead ends, the oldest dropped aloud when a
new one arrives. Nothing in it earns a status — the record still does that, and a fact in the
worklog that a check needed would be a fact in the wrong place.

Three flags write it, on `forge claim` and on any `forge record` kind that writes: `--pushed` reads
the git block, `--review` reads the consult log, and `--open` appends a line. What `--pushed` captured
is one line at the write — branch, head, base, and how many files — because two captures that wrote a
complete block printed nothing but the lease renewal, and their author ran `forge resume` to find out
whether the flag had worked. A capture with nothing in it says which of the four reasons held, and
leaves the block an earlier capture wrote: that block carries the time it was taken, so it is a true
statement about an earlier push rather than a stale one. **None of them is
automatic, and that is a decision rather than an omission.** A renew is made from wherever the shell
happens to be, and a write from another checkout would name that checkout's branch as this issue's,
or another project's review state as this one's. So the flags name the moment a run knows the values
are true, and a forgotten one costs a stale field the brief prints with the timestamp it was
captured at. Git and the log are read at the write and never at the read: the brief prints what a
run wrote, because a brief that consulted the repository would answer differently on every machine.

**The round is the consult id, not an ordinal.** The issue asked for a round number and the log has
no round in it — only consults, rulings and verdicts. A number would have needed a streak rule that
lived in one function and nowhere a reader could check it, so the block names the consult, whether
it was a recheck, how many findings it made and whether a verdict or a recheck is owed. `forge codex
log --id <id>` expands it.

**`forge resume ISS-nn` writes nothing and takes no lease**, so a person, a supervising run or the
holder itself may all read it; the printer and the brief import none of the writing functions, which
is what a case asserts rather than a comment claiming it. It prints, in reading order: the status
with the phase it owes, the plan bounded with a pointer to the whole field, every criterion with its
verdict mark, one line each of the latest confirmation, decision and correction, the worklog, the
parks and the blocking edges with the kind of each and whether it holds the status back — one
answer, the entry check's own, never worked out a second time for the screen — the command the next
status is owed in the same words `advance --owed` uses and from the same function, and the path of
the reference holding that phase's method. `--json` is the assembled object the screen was printed
from, so a tool and a reader cannot be told different things.

Two smaller measurements. A section with nothing in it is left out, not printed empty, which is what
made the brief fit a screen at all. And the comments it reads are not shown as themselves: the typed
kinds are, one line each, so a plain comment a person left reaches nobody through this verb. It
therefore credits nothing to the read-before-write rule, which delivers the bodies in its own
refusal instead — a digest of the record is not the record.

## `spec` — a clause answered by its identifier, and the storage known once

One file per requirement, one per section of business intent, and an agent implementing a clause
found it by searching for words. `forge spec` takes an identifier and prints the clause with
everything under it, so the day this reads a tracker's API instead of a checkout, no caller
changes. Keying on an identifier holds only while no two documents define one, which is why the
reader names both and refuses rather than choosing, and why it was run over every document of this
project's tree and not over fixtures alone — a fixture proves the notation, never the tree. The one
path it prints is the one `--where` asks for, and a developer asks for it to go and edit the file.

Three readings the notation admits were narrowed rather than guessed, and each cost a case that
fails without it. **Emphasis is what separates a defining row from a reference to one:** every
requirement file closes with a table naming the rules it carries out in a plain cell, so a reader
that took a plain cell for a definition made every business rule ambiguous once over for each
requirement naming it. **A criterion under a non-functional requirement is numbered from its section**, not from a
requirement, so arithmetic on `AC-17-2-1` names a requirement that was never written and the
enclosing clause answers instead. **A business sequence may keep no revision column at all**,
so a citation of one is answered with that fact rather than called stale.

The clause a citation was written against is decided by a digest of the clause's own words with
its markup gone — a reflowed paragraph is the same clause and a reworded one is not. It is printed
and never stored: the file that records a digest per revision is the gate's (ISS-27), and a second
place writing it would be a second answer. A revision that has moved is reported *stale* here,
because *suspect* is spoken for — a citation whose recorded digest disagrees is the gate's word,
and the two failures are not the same one.

The prose that follows the last criterion of a requirement file belongs to no clause. Under the
tree's own boundary rule it would attach to that criterion, which would move the criterion's digest
whenever an unrelated closing section changed, so it is left where a page renderer can pick it up.

## Two writes that lie about themselves

A schema-validated field that is accepted and dropped answers 200 exactly like one that was stored, so
`plan` reports success only after the server shows it. The same check found the translation gap: every
prose field an agent can write is rewritten for a Vietnamese tracker, not the three this started with,
because `plan` and `acceptanceCriteria` were going out in English while the banner said otherwise.

`call` reaches the same create and update the wrapped verbs do, so an unannounced write there would
make every gate above it decorative.

And a read-back compares the copy the boundary sent rather than the copy the caller wrote: those are
two documents on a project that rewrites prose, so comparing the caller's refused every write that
had in fact landed. The plan's three declaration lines are the one piece of machine data inside a
prose field, and the boundary wraps each in a code span before the rewrite runs — a rewrite renames
prose and leaves a span alone, so `advance` still reads them off a plan it cannot otherwise parse. A
line already wrapped no longer matches, so a stored copy sent through again is wrapped once.

## The primitives live in one module

Two verbs could not reach them and each grew its own copy; one lost the full-page guard on the way,
and a truncated dependency graph reported itself as complete. One list per process, not one per
reference: `dep <a> <b>` fetched the same 41 KB twice.

## `deps` — what the measurement decided

Only the marker sentence counts, and its trailing period separates the claim from prose about the
claim: ISS-11 says "those four edges are recorded here" mid-row about a different set. Measured
2026-08-27, "Blocked by" and "blocks the" each returned a strict subset of it. A phrase is ranked
against *every* issue, because an issue can be named as a dependent without saying anything itself.

One line per blocker, ASCII: on this tracker's nine edges, 595 bytes and 19 arrows became 180 bytes
and none — a box-drawing tree is fewer characters and more tokens. A literal NUL in the source once
made git read the whole file as binary: no diff, no blame, no `git grep`.

## Cloudflare

The Forge endpoint declares 68 tools in 33 groups and none is Cloudflare's, which is why this is a
second API rather than a route through the first.

An environment pair used to answer before the saved account, which bought a CI convenience for a
precedence rule, a half-a-pair failure mode, and a report that had to say which layer answered.

A failing account is named to stderr and the rest still aggregate; when none answered the verb exits
non-zero, because a caller piping `0 zone(s)` into a decision reads a dead credential as an empty
account. Which account holds a zone is written down nowhere, so it is probed sequentially — the first
hit ends it, and one account is the common case.

Search sends two queries per zone, since Cloudflare has no OR across `name` and `content`, capped at
15 zones: two requests each is a bounded fan-out. `--file` is pulled out of argv before flag parsing,
which keeps the last value of a repeated flag and would have purged one URL of three. `--proxied` takes
`true|false` rather than being a bare boolean, because proxying has to be turnable *off*.

## codex

**No local agent.** The first engine spawned a `claude` session with `--allowedTools Read Grep Glob`;
that flag auto-approves and does not confine, so the child inherited this machine's skills, answered a
review prompt by running a multi-agent review skill, and had to be killed by pid after eleven minutes.
The one exception since is `codex.check`: a command the *checkout* names in `.forge.json`, run at most
once per consult under a clock, exit code and tail returned. "The tests pass" was the claim every review
said it could not verify; a fixed command it did not choose is not a shell.

**What the advisor is, measured.** From a transcript: the built-in advisor forwards the whole
conversation (32,385 input tokens, no cache read, ~33 s) and its reply comes back encrypted, never
entering the transcript as plaintext. That is the number behind what the skill says about carrying
its reply into the consult.

**The diff travels, not the body.** Sending files whole *and* offering tools paid twice: two consults
spent 12 and 17 calls re-reading text already in front of them. Telling it not to re-read did not
work; sending less did — 4,381 characters against 32,233 on a two-file review, 5,266 against 59,462 on
a four-file one, same findings. `bodies` remains for a file outside any checkout.

**Calls are the only lever on wall time**, which is `calls × ~45s`, almost all of it thinking before
the first token: one timed consult was 49.5s, 39.5s of it silence. Against the same gateway a trivial
call is 1.6–2.0s and this payload with one word asked for is 6.1s, so input size is not where the
minutes go. Eleven runs over a fixture with two planted defects: given ten calls it used two on a
two-file review and four on a four-file one with three named risks, and a cap of three lost no finding
while saving a third of the time (99s against 145s). Every run found both defects at every cap from one
upward, so rounds are for *reaching* code, not for thinking longer. The last call is warned one round
early: a model told mid-answer that its tools are gone has already spent the round it would have read
in.

**Three was a constant, and it was the wrong shape.** Over 487 answered consults, 384 ended at exactly
three calls, and what a reply then said tracked the cap and not the difficulty: a clause saying the
reviewer could not check something appears in none of the 22 one-call replies, 10 of the 75 two-call
ones and 251 of the 384 three-call ones. Three is now where a consult *starts*, and the payload moves
it — a `bodies` pass holds every file it was asked about and has nothing to fetch, so it starts a call
lower; each clipped file is the one thing that reliably costs a retrieval round, so it earns one back.
`--rounds n` is still used exactly as typed.

**A review that says it could not check is not shown and then patched by the next consult.** It is one
attempt short, so it gets one more at `codex.roundsMax`, and the caller sees nothing until that one
answers. Which is why the first attempt is buffered rather than streamed: "retried before it is shown"
and a stream to stdout cannot both hold, and what streaming was actually for — telling a slow review
from a hung one — is the `call N of M` and tool lines, which print either way. The predicate is one
definition, shared by the field on the row, the retry's trigger and the stats line, and the one thing
it must never match is `CANNOT TELL`: that ruling is what the verification grammar *asks for* on a risk
the reviewer cannot decide, and retrying there buys the same answer at twice the price.

Thinking tokens come out of the same ceiling as the reply, which is why 8,000 was mostly spent before
the review began. `reasoning_effort` is a request rather than a lever — the same puzzle answers
identically at minimal and at high — and the minutes go on the reviewer's own reading, which is why
medium is the base rather than the answer. It was also the *only* level anything ran at: medium on 384
of the 393 consults that recorded one, high on four. What moves it now is the round and the size, one
step and never two, the round winning where both apply. A recheck is asked a narrower question than the
pass that raised the findings, so it steps down; a change under `codex.effortLines.small` steps down and
one over `.large` steps up, measured on the diff where the consult is anchored to one and on the bodies
where it is not.

**An open stdin is not an intent that has not arrived yet.** The consult reads its intent from
stdin, and inside a harness the shell's stdin is a pipe nobody is writing to: read to EOF, it never
returns. Two consults ran 17 and 13 minutes on 2026-09-03 and were killed by pid, which is the
largest single round a dry run has lost. What is bounded now is silence rather than the whole read —
two seconds before the first byte and between any two, ten for a payload a verb cannot proceed
without — because a producer that writes one byte and stalls is the same unbounded wait. A silence
after bytes have arrived is a refusal and never a short payload: a plan read in half would be stored
as the plan. The line naming what the consult is about to do prints before the read, so a stall says
where it is.

**Asked for a diff and given nothing, the tree answers.** `--diff` with no file named and nothing
pending answered "nothing to consult on", and what an author then did was run `git diff --name-only`
and type the list back. The names come from there now and are printed on stderr, so the review's
scope is legible without a second call. A deletion is among them, and so is an untracked file: the
diff step used to pass over a path that is not on disk, which named the file and said nothing about
it, and `git diff` never lists a file git has not been told about, which a turn's new file always
is.

**Three of the reviewer's four tools take the checkout when no path came.** `list_dir`, `git_diff`
and `grep` default to the root: 34 refusals in the log were that argument left out, and a reviewer
that meant the repository has nowhere else to mean. `read_file` keeps its path, having no such
default. And a path that is not there is answered with the entries of the nearest directory above it
that is, rather than the root's top — a leaf six levels down has siblings, and the root says nothing
about them.

**A follow-up round verifies; it does not roam.** Six rounds on one patch, each a full review, each
finding a narrower hole than the last with no signal to stop on. `--recheck` replays the previous
consult's findings as the verification list, which is the shape the reviewer is reliable in.

That was half of what stops a consult repeating itself. The other half is that 100 of 196 rechecks raised something marked
New, and each one cost the head another fix and another round — a recheck asked to confirm went looking
instead. So a recheck now anchors to the head its findings were made against, which puts the diff since
that head in front of the reviewer instead of the whole file it has to find the change in again; where
nothing differs from that head the consult runs without a diff rather than refusing, because the
findings are still owed a ruling. And its system prompt carries a clause the first pass does not: the
round exists to close findings, not open them. It does not forbid a New one — a defect the fix itself
introduced is real — it requires the bullet to name why the earlier round could not have seen it, which
is the sentence a wasted round cannot write. `newFindings` on the row is what says how often that
worked.

**Angles are the checkout's.** On this CLI three of the four wrote "nothing material" in every one of
92 consults — output paid for, and the reader skimming past the one angle that mattered. The board
stays for a product with screens; `.forge.json` names the angles that fit.

**The cache is the provider's prefix, not a breakpoint we place.** The role and the replayed history
each carry a `cache_control` marker, and over 487 answered consults `cache_creation_input_tokens` was
0 on every single one: nothing this end asks for is honoured, because the slot resolves to a model on
another provider whose caching is automatic and keyed on the longest matching prefix of the request.
Reads do happen, and the one thing that visibly moved them was the tool list. A consult whose last call
was served `tools: []` read 11% of its input from cache; one that never reached that call read 22% —
the tool-less call is the only difference between those two groups, and system-and-tools is exactly the
front of the prefix. So the list now stays in the request on every call of a consult and the last one
is sent `tool_choice` of none instead. The cap is unchanged and stays this end's, which already refuses
and records a tool call made past it. `codex.toolChoiceNone: false` sends the empty list again.

The last three consults were the last three by date whatever they were about; one sharing a file comes
first now, because that is the one "still open" can be answered against.

**Containment is physical, not lexical.** `..` is the traversal you can see; a symlink committed inside
the repository is the one you cannot. A path is admitted by realpath and by being a regular file, for a
name on the command line as much as for one the reviewer asks for, and checking and reading stay two
operations — a checkout mutated between them is a race this narrows rather than closes. Scope is this
checkout plus the checkout of every file the caller named, because the account config and the gateway
profile both hold live tokens; a refused read is answered in words, since a reviewer that cannot tell
"outside" from "you forgot" asks again.

**A malformed tool call is answered, not thrown.** Arguments that never parsed become an empty input
and come back as a refusal: the model's mistake to correct, not a reason to end a consult already paid
for.

**The log is the session.** There is no session id, so a consult opens with this repository's last
three answered ones and their verdicts. Findings are numbered `F1…` across angles and a verdict names
them — `--accepted F1,F3 --rejected F2=why`, never a count: 185 accepted to 14 rejected was the count
form saying nothing. What is replayed is the findings, the rulings and what became of each, not the
prose: the gateway reported no cache creation in 108 consults, so every replayed character was paid for
on every call. A recheck's REFUTED rulings record themselves as the verdict on the consult they judged
(CONFIRMED stays open), a verdict lands by default on the last consult that made findings and heard
nothing, and `--of` names another. The commit gate waits on both, and its how document carries the
counts. Usage is summed over a consult's calls; logged from the
last call alone, `log --score` counted a third of the input. A `started` entry is written before the call, because a consult
that dies mid-flight reaches no handler and a review that vanished is what an eval most wants to see.
Each entry carries the commit, a per-file sha256 and whether the file was clipped: advice that cannot
be tied to bytes cannot be checked.

**A harness with no numbers on itself is tuned by memory.** `forge codex stats` reads a window —
`--last n`, `--days n`, `--root p` or `--here` — and answers the questions a change to the harness is
judged by: how many consults ended at the budget they were given, how many replies said they could not
check, how many were retried at the ceiling, how many rechecks raised something New, the tokens by
kind, and which prompt versions ran. A row written before a field existed is counted from its own
reply, using the same predicate the field is written with, so the window before a change and the window
after it are read the same way rather than one of them looking clean for want of a column.

**A prompt is versioned because "it seems better" is not a comparison.** Every consult records the
system prompt's version and the digest of the text actually sent, so an edit nobody bumped for still
shows. `forge codex replay --prompt <file>` is the other half, and it is honest about how little of it
there is: the log keeps each sent file's sha256 and never its bytes, so a consult can only be rebuilt
where `git show <head>:<path>` still produces bytes that hash to what was sent. A consult is run on a
dirty tree by nature, so most cannot — over the last thirty, two rebuild. The verb prints the window,
what it kept, and what it lost with the reason, rather than replaying approximately and calling the
comparison a measurement. Storing the prompt whole would make it exact at roughly 140 KB a consult,
which is the trade the log does not take.

What counts as a document is `codex.pathRe`, `^docs/.*\.md$` by default, because prose is what nothing
else here checks — and a document written by a heredoc is a document. The turn is keyed by canonical git
root, one state file for every checkout, and a consult clears only the files it was given: one recorded
while the call was in flight survives it.

**Scoped to the working tree, the commit gate was a function of other people's work.** In a checkout
shared with another session, a three-file commit was refused five times over with a list of 726 paths
to review, 243 of them that session's uncommitted files; past five hundred status rows the walk stops
measuring and answers *changed now*, so no number of consults could ever spend it. What a commit closes
over is its index, plus whatever `-a` and a pathspec add, and that crossed with this root's unread
record is the whole of what is asked for — computed once, so the verb that prints the list and the gate
that compares it cannot drift apart. The 726 became one.

**A count standing in for a timestamp is never spent.** ISS-70 bounded the commit and left the other
half of that same cap arming itself forever: five consults, four verdicts and every finding ruled on,
and 727 dirty paths still said *changed now*, listing another agent's uncommitted files as work to go
and read. Above the cap the demand is now bounded by this root's unread record, so what a refusal
names is what consulting it clears, and where nothing is recorded nothing is owed. Two prices, both
taken deliberately. The record is the root's and carries no session dimension, so a co-tenant's
recordable file can still be demanded of you — satisfiably, which is the whole of the change. And what
it holds is what `codex.pathRe` matches, so above the cap a write outside that pattern is not asked
about at all; the commit carrying it still is, from its own index, which is where the pattern does not
reach.

**A kill switch nobody in the session can throw is not one.** `FORGE_CODEX_DISABLE=1` stays, for a
configuration too broken to read a switch out of, but it answers from the environment a hook process
was started in, which an agent inside that session cannot reach; written as a prefix on the refused
command it changed nothing, and the refusal read as offering a way out. `forge hooks --off codex-second` is what the refusals name now,
and the log says which gate is down.

## The refusal log

Three false refusals shipped in one session — a DNS query containing `cp`, a commit message quoting
`mv`, an intent whose heredoc quoted `writeFileSync` — and every one was found by watching a command
fail. Refusing is now what writes the line, so a gate cannot opt in or forget, including the two written
before the log existed. Only refusals are logged: they are the signal a false positive leaves, and
allows would double the write sites for a question nothing is asking.

**A class of refusal is a loop, and the log can say so.** `forge hooks --rounds` counts, per
session, the refusals that stood in front of a tracker write and how many distinct writes they stood
in front of. The number is refusals per *refused* write, and it is named that in the output, because
only refusals are written down here: the writes that passed are in no denominator, so 1.0 is the
rule working and 2.0 is a run re-sending. Across this session's own 307 refusals it read 1.16, with
three on one `forge plan`; the worst row in the whole log is 6.5, from a session calling the
tracker's tool directly, which is where the write is named by the tool rather than by the command.
Two gates answering one attempt is one round, so a refusal of the same write inside a second counts
once. A true rate wants a counter where every write already passes, which is
one site in the transport rather than the many the rule below rejected.

**It is a file on disk, so it never holds a credential.** Named secret flags, `Authorization` and
`Bearer` values, and the shapes that read as a secret on sight — a Coolify `7|…` token, a JWT,
`sk-`/`ghp_` — are masked, then the line is cut at 220 characters. An hour before this was written, a
Coolify token reached a session transcript through a redaction that missed one nesting level. A zone id
and a hostname survive, because those are what the log is read for. A failed write is silent here: a
hook's stderr is protocol, and a full disk must not turn a gate into noise.

## doctor

Every other verb fails at the first missing piece. Doctor reports all of them together, because "no
credentials" and "credentials from the wrong file" look identical from inside one failing command.

**It withholds values by default.** Its output lands in an agent's context, and an agent never types a
token, a project id or a path. A fragment of a credential is still a credential once it is in a
transcript. `--full` is for the human holding two tokens who needs to know which is which.

**A probe is paid for once.** All 67 tools are declared to a PAT and `forge_project_pm` then refuses
all six of its actions, so what a probe learned is written down, keyed by project and dated, and
listings mark a gated tool without paying for a probe of their own.

**CLAUDE.md's claims, calibrated over 28 real files** in this tree rather than over one. The absence
claim — "there is no `backend/.env` and there must not be one" — is why direction matters: read the
other way round, a checker reports the required state as the defect. Three of those projects state the
identifier rule themselves, so that check is theirs. Only backticked spans and link targets count; a
placeholder, glob, package name, url, CIDR block, date mask, bare extension, git ref and build
directory are each excluded because each produced a false positive on that corpus. A path whose
basename exists elsewhere is *stale* rather than missing, and prints as one note with a count — 102
occurrences across the corpus is worth a line, not a list.

**Structure is measured against the published rules, not taste.** The 200-line target and a resolving
`@path` import are mechanical and gate; emphasis dilution, vague words and coverage are notes, because
each is a reading. Nine of the 28 files had every bullet bold-led — one was 25 of 25 — so dilution is
flagged above 80% of at least 8 bullets. A word quoted as an anti-pattern is not a finding: one project
lists those exact words as signals of unfinished thinking, and meant it.

Structure and claims read the tree and nothing else, so they run before the endpoint: a project with no
Forge slug still gets its CLAUDE.md checked, anchored at the `.forge.json` directory rather than by
walking up — an unbounded walk-up eventually reaches `~/.claude/CLAUDE.md` and reviews the user's global
file against a project's guides.

**A rule a checker already states is noted where CLAUDE.md explains it too.** Only backticked
hyphenated names count, against names a checker declares as a literal, so a rule that derives its name
from its filename is missed and a stray string cannot invent one. **And the guides are the authority**, the project file the copy: a rule stated in
both diverges the first time someone corrects only the one they found, silently, because each still
reads as correct alone. The overlap measure is the one the duplicate-comment rule uses, at 0.25 over a
floor of 3 rather than 0.34 over 5 — two documents state one rule in their own vocabularies, and over
those 28 files 0.34/5 finds nothing while 0.25/3 finds seven pairs, every one a real restatement.

A pair is reported, never classified: negation is a stop word, so a restatement and a flat contradiction
score alike. That is why an overlap is a note and cannot fail doctor — a check that stays red until
somebody edits prose gets switched off. A project may override a guide but not fork one by accident, so
the waiver names the guide and gives a reason, and one naming a guide that does not exist fails, because
that is mechanical. A global guide whose body calls a foreign MCP namespace is a finding against the
guide, and a note, since nobody can fix it from the checkout.

Writes translate before they post, so a missing `vi-natural` key fails writes while reads stay green:
the exit code follows the stricter one. The gateway url and model are read beside the key, because a
saved key alone is configuration that looks complete and dies at the first call.

**And it names the copy a call from here would run.** `~/.local/bin/forge` is one symlink for the
machine, written from whichever plugin root a session started with, so for two days every project on
this machine ran this checkout: one of them died on a `SyntaxError` from a refactor half-finished
here, and another silently ran an unreleased build. A call that arrived through that link now picks
its copy per call — the checkout the working directory sits in, else the newest installed copy the
record resolves to — and the report has to answer for a directory rather than for the machine,
because the answer changes with `cd`. A call that names a copy by its own path still runs that copy:
the probe of a worktree, the suite's own spawns and the bundled `vi-natural` all mean the copy they
name, and a caller who typed a path was not asking.

## Which gates run

The names are the hooks directory, read, so a hook added later is switchable without editing anything
here. Derivation alone did not make that true — an entry point can read no event and keep running while
`forge hooks --off` reports it off — so a test fails on a hook the switch cannot reach, and names the
fix. A typo is answered with the near miss, so a switch that silences nothing cannot be written.

One place answers whether a gate is off, and anything that is not a list reads as empty: a broken config
runs every gate rather than none. Nothing in the environment reaches that decision, and a test asserts
it against the source rather than by sampling names, because a second layer is a precedence rule plus a
report that has to say which layer holds a gate.

A name is a *type*: the answers name the event they turned off, and a test fails on a script registered
on two. `docs/HOOKS.md` says why the switch is read by the hook process rather than declared in
`hooks.json`.

## Settings

Provenance is the shape of every answer rather than a courtesy some resolvers extend, because that is
what doctor reports. Credentials that resolve by directory are the account's in name only, which is why
one file answers and a setup that stops answering in silence is the failure the report exists for.

Six environment variables remain and none is a value — two say where config lives, two are what the
platform passes a hook, two are kill switches, and a kill switch has to work when the config file is
what is broken. A test walks every source and fails on a seventh name, because an env read is one line
that looks like every other line.

**Credentials sit outside every repository.** A token in a repo file is one `git add -A` from a remote.
The config is 0600 from the moment it exists: chmodding afterwards leaves it world-readable for the
length of the write, and a temp file a crashed run left behind would take the token at whatever
permissions it already had.

The once-only memo remembers *that* it ran, not what it returned — four of the seven it replaced tested
the value for truthiness and re-ran on a valid `null`. Unmemoised, one `forge issues` spawned
`git rev-parse` nine times. Flag parsing lives in one place: three verbs had grown their own copy and
two dropped a valueless flag silently, which reads as an unfiltered answer.

**A project's release policy is the tracker's and not a checkout's.** The staging branch, the
production branch and the automatic production deploy are project columns already, and doctor prints
them under the names their owner uses — the tracker's `baseBranch` is the staging branch everywhere
but in the one reader that fetches it. An automatic production deploy onto a branch the tracker
holds as null is the incoherence its own schema warns of, and it is reported: until the branch is
set, the person's look stands.

**`translate` off by default was measured, 2026-08-27:** sid-growth is Vietnamese and forge-dev is
English, so posting one convention into both is a wrong-language issue no verb can delete afterwards.
That failure is unrecoverable; a missing translation is an edit.

## Withholding a verb

Two mechanisms, deliberately not merged: the server *refuses* a tool, and a human *chose* to withhold a
verb. A gated verb cannot run; a withheld one is unlisted and still works, so collapsing them loses the
distinction that makes each correct. `needs` is declared on every verb with a backing tool, not only the
probed ones, so if `forge_issues` is ever gated, six verbs disappear together rather than fail one at a
time. A gated tool's schema is not printed at all: it is an invitation to a call that cannot succeed.

The usage line has one home. It lived twice and the two had drifted four ways, so `forge -h` and the
error a caller hit disagreed about which payload forms exist.

**And where this copy or this credential cannot use a thing, `forge doctor` is the only surface
allowed to say so.** Not `-h`, not a list, not a near miss, not a closing line saying how many
things were left out. An agent that does not know a thing exists is better off than one that knows
and cannot use it: the first spends no turn on it, the second reads it, weighs it against what it
may use, and asks. So a gated verb is absent rather than annotated, a withheld one is unlisted, a
guide the table holds a row for is not named or counted, and a flag only a maintainer can act on is
in no help text.

That is a permission and not a promise. It says where the answer may be given, and `doctor` gives as
much of it as it has been built to give — today the verbs a human withheld by name, the capabilities
this credential is refused by count, the guide table by count, and a withheld guide's own text not
at all, which is ISS-71's half. What the rule
forbids is any *other* surface making up the difference: a gap in `doctor` is a gap to close there,
because a person debugging the copy is the one reader who should carry it.

A refusal answers what the caller named and volunteers nothing past it. Typing a gated verb still
says which tool it needs and that this credential may not call it, because the caller has already
spent the turn and a silent refusal costs a second one; what the refusal must not do is *describe*
the thing — `forge guide --tracker` echoes the flag and refuses the shape, and says nowhere what
the flag would have printed.

## One transport

**Rate limits.** The server states its own wait. Failing instead of honouring it turns a two-second
pause into a lost run; honouring it without a ceiling turns a server saying 3600 into an hour of sleep.

**Errors.** A schema violation returns a zod array carrying the full uuid regex per field; the path and
the message are the whole signal. `isError` is the tool's own refusal rather than a transport failure,
and must not read as a success.

**The tool surface is cached.** `tools/list` is 130 KB and every verb needs it; fetched per process it
was 75% of the traffic of `forge issue`. One fetch serves concurrent callers, because caching only what
has already arrived turned one fetch into five the moment anything ran in parallel. A miss refetches
before erroring: an absent name may be a typo or a tool the server grew since, and only one is worth an
error.

**Announcing a write is not a courtesy owed per verb**, which is how two of them were written without
it. It happens in the transport, so a verb added later cannot forget.

## "did you mean"

An agent's mistakes are not a human's: it does not fat-finger adjacent keys, it recalls a name from the
wrong shape — a dot where the server wants an underscore, a singular for a plural. So matching is on the
separator-stripped form and containment counts as much as edit distance, which puts a name differing
only by separator ahead of everything.

## Vietnamese

`vi-natural review` was tried as the gate and cannot be one: it flagged its own previous suggestion, so
it has no fixed point and blocking on its findings never terminates. Translating is one deterministic
pass, and a source that stays English is the source to fix. The binary is the one shipped beside the
plugin, never whatever PATH resolves — a plugin that spawns a copy it did not ship has no idea which
contract it is getting.
