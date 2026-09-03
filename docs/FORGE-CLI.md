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

## `record` — a payload has one shape

ISS-1's dry run of the issue-flow contract wrote nine payloads by hand: a confirmation, a decision
record, a baseline, six verdicts. Each was shaped at the keyboard, and the second run would have
shaped them differently. `forge record <kind>` owns the shape, so the reader and the checker find the
same fields every time, and a missing field is refused by name before anything is posted.

A record is a comment a person reads first: a heading, one line per field, and one parsed line last,
in a code span so a translated project keeps it. The verdict quotes the criterion's text as it stood
at the write, because the field can change later and the verdict has to say what it judged. Evidence
is an attachment name the issue carries, a URL or a commit, and an attachment that is not there is
refused: a reference to a file on someone's disk proved nothing. The release note and the criteria go
to their fields, which the tracker already types; everything else is a comment. `report` assembles
the latest record of each kind and the latest verdict per criterion, and names the criteria no verdict
covers. Nothing is stored twice. The contract this serves: `docs/issue-flow-contract.md`.

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
a caller can tell "not yet" from "here is what to type". The contract it serves, and the tables it
carries in its own words: `docs/issue-flow-contract.md`.

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

A lease past its duration is stale for its holder too. The first version renewed the holder's own
expired lease instead, and a live run then showed a dead session writing payloads half an hour
after its lease had gone: past the duration another run may hold the issue, and that is exactly
what nothing here can refuse yet. A reclaim is a handoff between two holders, though, so a holder
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
upward, so rounds are for *reaching* code, not for thinking longer. The last call is served no tools
and is warned one round early: a model told mid-answer that its tools are gone has already spent the
round it would have read in.

Thinking tokens come out of the same ceiling as the reply, which is why 8,000 was mostly spent before
the review began. `reasoning_effort` is a request rather than a lever — the same puzzle answers
identically at minimal and at high — and the minutes go on the reviewer's own reading, which is the
argument for medium.

**A follow-up round verifies; it does not roam.** Six rounds on one patch, each a full review, each
finding a narrower hole than the last with no signal to stop on. `--recheck` replays the previous
consult's findings as the verification list, which is the shape the reviewer is reliable in.

**Angles are the checkout's.** On this CLI three of the four wrote "nothing material" in every one of
92 consults — output paid for, and the reader skimming past the one angle that mattered. The board
stays for a product with screens; `.forge.json` names the angles that fit.

**The history is marked for caching and chosen by file.** Zero cache reads in 92 consults, with the
role and the replayed history resent on every call: both now carry a cache breakpoint. Measured on the
first consult sent with them, the gateway created and read nothing — it caches on its own terms, so
like `reasoning_effort` this is a request and not a lever, and it costs nothing to ask. The last three consults
were the last three by date whatever they were about; one sharing a file comes first now, because that
is the one "still open" can be answered against.

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

What counts as a document is `codex.pathRe`, `^docs/.*\.md$` by default, because prose is what nothing
else here checks — and a document written by a heredoc is a document. The turn is keyed by canonical git
root, one state file for every checkout, and a consult clears only the files it was given: one recorded
while the call was in flight survives it.

## The refusal log

Three false refusals shipped in one session — a DNS query containing `cp`, a commit message quoting
`mv`, an intent whose heredoc quoted `writeFileSync` — and every one was found by watching a command
fail. Refusing is now what writes the line, so a gate cannot opt in or forget, including the two written
before the log existed. Only refusals are logged: they are the signal a false positive leaves, and
allows would double the write sites for a question nothing is asking.

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
