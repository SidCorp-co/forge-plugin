# The forge CLI, module by module

Why each part is shaped the way it is. The code states constraints; this states the failures
and the measurements behind them. Dates are kept because a measurement was true once, not
forever.

## `cli.mjs` — the way in

The tracker is the backlog, so every agent needs a way in that does not depend on an MCP client
being connected in the session that asks. The endpoint speaks JSON-RPC over one POST.

A verb whose backing tool this credential may not call is not listed and does not run. A
capability an agent cannot use is not information — it is an invitation to a failure two calls
from here. `forge doctor` measures which those are; `--all` is how a human looks past it.

The write-time rules printed by `-h` come from the tracker's own `agent-setup`,
`pipeline-and-issue-lifecycle` and `writing-an-issue` guides. They are carried in the binary
because a guide costs 3–6 KB to fetch and these are the lines it would have been fetched for.
They print on `-h` only: a mistyped verb wants the suggestion and the verb list, and paying the
lecture for a typo cost more bytes than `forge -h` itself.

Dispatch uses `Object.hasOwn`, not truthiness. `commands.toString` is inherited and callable, so
a mistyped verb that happened to name a prototype member ran it and exited 0 with no output.

A DNS failure or a dropped socket rejects out of `fetch`, and an unhandled rejection prints a
stack trace that reads as a bug in this CLI rather than a network that is down.

## `commands.mjs` — one verb per function

**Payloads.** One rule everywhere: inline, `@path`, or `-` for stdin. Measured on a
3,895-character issue body — passing the file costs 153 characters against 4,202 inline, but only
because the file already existed. Writing one in the same breath costs what inlining does, and
for a small flat payload the extra command makes it 1.6× worse.

**The browse projection.** One line per issue. The uuid column was 22% of that verb's bytes and
bought nothing, because every verb taking an id also takes `ISS-45`, resolved from a list the
process already holds. Three tiers, and the payload is what costs: `issues` is a line per issue,
`issue` is one whole body, `--fields plan` is one part of one body.

**What is omitted.** A null `plan` and an empty `attachments` are 179 bytes of an issue's 1,938
and say only that the field exists, which the schema already says. Absence means empty.
`format: "uuid"` and a 150-character regex asserting the same thing appear together on every id
field; anything patterned *without* a format is kept, because that one carries the only copy of
its rule.

**Validation.** A named argument is checked against the server's own declared schema rather than
a list here that would go stale against it — the same reason `scoped` reads the schema for
`projectId`.

**`open` is the default.** A repository that drives its own builders ignores the tracker's
pipeline, so `open` marks the active set; `draft` never dispatches.

**`plan` is a field, not a comment.** A comment is a message in a thread — it scrolls, it is not
what `--fields plan` returns, and a reader looking for the plan finds whichever comment they
reach first. The field has one value, and replacing it is how a revised plan supersedes the old
one instead of accumulating beside it. The write is read back before it reports success, because
a schema-validated field that is accepted and dropped answers 200 exactly like one that was
stored.

**Attachments.** Bytes go straight to the presigned URL, never base64 through a model's context.
That PUT carries no auth header of its own — the URL is the credential and expires in ~300s.

**Guides.** Ask for the guide, and only reach for the list when the slug was wrong; validating
first cost a 6 KB round trip on the happy path of the verb an agent hits most for orientation.
They come back as Markdown, not Markdown escaped inside a JSON envelope: 49 `\n` and 10 `\"` per
guide, and every one of them tokenizes worse than the character it stands for.

**`call` is not a bypass.** It reaches the same create and update the wrapped verbs do, so an
untranslated or unannounced write there would make every gate above decorative.

## `issues.mjs` — the primitives every verb needs

Paging, the browse projection, and turning the reference a human cites into the id the API takes.

They live here rather than in `commands.mjs`, which imports `deps` and `doctor` — so neither
could reach them and both grew their own copy. `deps` lost the full-page guard on the way, and a
truncated dependency graph reported itself as complete.

The server's default page is 25 and its schema caps `limit` at 500 with no offset or cursor
beside it, so **a full page is the only signal that anything was left behind**.

One list per process, not one per reference: `dep <a> <b>` fetched the same 41 KB twice, and a
`call` payload naming two issues did it sequentially. An issue's documentId never changes.

`issues` prints `ISS-45` in its first column, so that is the reference a reader copies — and the
API takes the uuid. Resolving it costs one list, and only when asked.

## `deps.mjs` — prose, not edges

**This is not the recorded graph.** Every PM tool answers `FORBIDDEN: PM_REQUIRES_DEVICE` to a
PAT — all six `forge_project_pm` actions and the deprecated `forge_pm.set_dependency` alike — and
`forge_issues get` returns no relation among its keys, so a token cannot read the graph at all.
What it *can* read is the sentence a migrated issue carries about its own edges. Two issues that
disagree are the finding this verb exists for, so an edge is printed with the side that claimed
it and never reconciled into one arrow.

The marker sentence, and only it. ISS-11's evidence table says "those four edges are recorded
here" mid-row about a different set, so the trailing period separates the claim from prose about
the claim. The phrases come from the tracker's own `.forge.json`; only their shape is fixed.

Resolution ranks a phrase against *every* issue, not only the ones carrying prose: an issue may
be named as a dependent without saying anything about edges itself. A title's own code counts —
`identity` resolves IDENT-01 where whole-word matching alone ties it against "run the Leader
reseed per tenant", which shares `per` and `tenant` and nothing else. Unique best, or nothing: a
phrase that ties two titles is reported as written rather than resolved to whichever sorted
first.

One search, not three. Measured 2026-08-27: "Blocked by" and "blocks the" each returned a strict
subset of what the marker sentence returned, and `edgesIn` only recognises that sentence anyway.

Output is one line per blocker instead of one per edge, ASCII throughout. Measured on this
tracker's nine edges: 595 bytes and 19 non-ASCII arrows became 180 bytes and none. A box-drawing
tree is fewer characters still and more tokens, because those glyphs are multi-byte.

A literal NUL in the source once made git read the whole file as binary — no diff, no blame, no
`git grep`. The escape is the same byte at runtime and plain ASCII on disk.

## `cloudflare.mjs` — a second API, not a second tracker

**Cloudflare is not on the Forge endpoint, and this verb does not route through it.** The endpoint
this CLI resolves declares 68 tools in 33 groups and none of them is Cloudflare's; asked for one
directly, the server answers `Unknown tool`. So the calls go to `api.cloudflare.com`, and the
surface is eight actions rather than that API's full breadth — search, list zones, one zone's
detail, list, create, update and delete a DNS record, purge cache. Enough to run DNS from a
terminal, small enough to stay in one file.

Which means the credentials are this machine's: the accounts `forge cloudflare login` saved beside
the Forge config at 0600, and only those. A pair in the environment used to answer first, which
bought a CI convenience for a precedence rule, a half-a-pair failure mode of its own and a report
that had to say which layer answered. `forge doctor` lists the accounts and where they came from.

Nothing here touches the Forge endpoint, and that is load-bearing: `forge cloudflare zones` runs
on a machine with no Forge url, no token and no project. The verb carries no backing tool in
`VERBS`, so no capability probe can withhold it, and `doctor`'s cloudflare line gates no exit
code — an account nobody saved is not a broken Forge install.

**A failing account is named, and every account failing is an error.** Skipping one silently
would make a revoked token indistinguishable from an account holding no zones, so the account is
printed to stderr and the rest still aggregate. When none answered, the verb exits non-zero
instead of printing `0 zone(s)` — a caller piping that into a decision would read a dead
credential as an empty account.

Which account holds a zone is written down nowhere, so it is asked: one `GET /zones/<id>` per
account until one answers. Sequential, because the first hit ends the probe and one account is the
common case.

Search sends two queries per zone — `name.contains` and `content.contains` — because Cloudflare
has no OR across those fields, and the same record answers both, so ids are deduped after. Zones
are capped at 15 per search: two requests each is a bounded fan-out, and a query naming a host
still reaches the zone that host sits in.

Two flags cannot be what they look like. `--file` is pulled out of argv before `flags` sees it:
`flags` keeps the last value of a repeated flag, so a three-URL purge would silently purge one.
`--proxied` takes `true|false` rather than being a bare present-or-absent boolean, because
`dns set` has to be able to turn proxying *off* — a bare flag can only turn it on.

**Every write announces its zone and its account, and nothing asks for confirmation.** The zone
is an argument, but the account was chosen by a probe nobody watched, so the pair is printed to
stderr the way `rpc.mjs`'s writes print theirs. `dns rm` and `purge` then run.

## `codex*.mjs` — a second opinion, from a different provider

Three files: `codex-api.mjs` is the call and what it may read, `codex-log.mjs` is memory and eval
set at once, `codex.mjs` is the verb and the turn's bookkeeping.

**The model slot is not the model.** The verb asks for `fable`; the gateway profile at
`~/.claude/claude-proxy.env` maps that slot to `cx/gpt-5.6-sol`, which identifies itself as GPT-5
Codex. That mapping is the whole premise, so `consult` **refuses** when the slot resolves to this
model's own family — `--allow-echo` overrides it. Warning after the fact would be warning after the
tokens.

**Why this exists next to the built-in advisor.** Measured from a session transcript: the built-in
advisor is a server-side tool with empty input, the server forwards the whole conversation (32,385
input tokens, no cache read, ~33 s), and the reply comes back encrypted and never enters the
transcript as plaintext. So it reviews the agent's *account* of the work — it has no file access,
holds no session, and its advice cannot be read back or scored. codex is built for exactly the gap
that leaves: it reads the artifact's own bytes, it remembers this repository, and every consult is
logged verbatim.

**It runs after the advisor, and the ordering is load-bearing.** The advisor speaks first and may
speak repeatedly; a consult follows it. Because that reply is encrypted and unreadable afterwards,
the only moment its content can reach codex is the same turn, written into the intent by hand —
without which codex covers ground already covered, its agreement reads as independent confirmation
when it is duplication, and a disagreement between the two never surfaces.

**HTTPS POSTs, streamed, and no local agent.** The first engine spawned a `claude` session with
`--allowedTools Read Grep Glob` so the reviewer could grep for itself. Measured: `--allowedTools`
auto-approves, it does not confine. The child inherited this machine's skills, answered a review
prompt by invoking a multi-agent code-review skill, ran eleven minutes and had to be killed by pid.
So the call is `POST /v1/messages` with `x-api-key` and `stream: true`, and what the reviewer may do
is decided here rather than by whatever a spawned agent happens to have.

**It has tools, and they are this process's.** Probed against the gateway: it answers a `tools`
request with real `tool_use` blocks and takes a `tool_result` continuation, so the reviewer gets
`read_file`, `list_dir`, `grep` and `git_diff`, executed in `codex-tools.mjs` — read-only, output
clipped, each call reported on stderr as it runs.

**What travels with the prompt is the diff, not the body** (`codex.send`, `--send diffs|bodies`).
Sending every file whole *and* offering tools paid for the same bytes twice: two consults spent 12
and 17 tool calls re-reading files whose full text was already in front of them, and each tool round
is another model call. Asked to rule on that, codex agreed the re-reading was not rational — *"the
payload contains the full changed document, its diff, and the full relevant implementation… fewer
rounds or stronger instructions against redundant reads are appropriate."* Telling it not to
re-read, in the intent, did not work. Sending less did: 4,381 characters against 32,233 on a
two-file review, 5,266 against 59,462 on a four-file one, with the same findings. `bodies` remains
for a consult on a file outside any checkout, where there is nothing to read from.

`codex.rounds` caps *model calls* — three by default, measured rather than guessed — and the last one is served **no tools**, which
is what makes it answer; it is warned one round early, because a model told mid-answer that its tools
are gone has already spent the round it would have read in. Eleven runs over a fixture with two
planted defects — a model-chosen git ref in option position and a call cap left to the gateway, both
findings codex made against this harness for real — say what a review actually needs: given ten calls
it used **two** on a two-file review and **four** on a four-file one with three named risks, and a cap
of three lost no finding while saving a third of the wall time (99s against 145s). Every one of the
eleven found both defects, at every cap from one upward, so the rounds are for *reaching* the code,
not for thinking longer. A cap that bites degrades rather than fails: the unserved calls are reported
as `past the call cap`, and `--rounds n` raises it for one consult.

Wall time is `calls × ~45s`, and almost all of that is the model thinking before its first token. A
timed consult: 49.5s total, one call, 39.5s of silence and then 10s of streaming. Probed against the
same gateway, a trivial call is 1.6–2.0s and this payload with one word asked for is 6.1s — so input
size is not where the minutes go, and the number of calls is the only lever that moves. `codex.maxTokens` is 32,000: the gateway
returns `thinking` blocks whose tokens come out of the same ceiling, so the old 8,000 was mostly
spent before the review began. Thinking is counted and logged, never printed — the reasoning is not
the review. `codex.effort` is sent as `reasoning_effort` and defaults to **medium**, with `--effort
minimal|low|medium|high` overriding it for one consult. Probed, the gateway accepts the field and the
same puzzle answers identically at high and at minimal, so the slot appears to decide and this is a
request rather than a lever — which is the argument for medium: the minutes a consult takes go on the
reviewer's own reading, not on the level asked for.

**A named file may live in another checkout, a requested one may not.** The config is the account's,
so `forge codex consult /elsewhere/src/a.mjs` reviews a sibling project: `locate()` takes a path
outside the root when it is absolute and readable, and carries it absolute through the record. What
the *model* asks to read is the narrower question — `scopeFor()` allows this checkout plus the
checkout of every file the caller named, and nothing else on the machine, because the account config
and the gateway profile both hold live tokens. A refused read comes back as a `tool_result` saying
so, since a reviewer that cannot tell "outside" from "you forgot" asks again.

**Containment is physical, not lexical.** `..` is the traversal you can see; a symlink committed
inside the repository is the one you cannot, and both routes end at `readFileSync`. So
`resolvedInside()` realpaths the root and the target, checks the prefix, requires a regular file,
and returns the canonical path that is then read — and it guards paths named on the command line as
well as paths the reviewer asks for. The check and the read remain two operations, so a checkout
mutated between them is a race this narrows rather than closes.

**A tool call arrives in pieces.** `content_block_start` carries the id and the name, the arguments
follow as `input_json_delta` fragments, and `content_block_stop` closes it — so `consume()` assembles
them and hands the loop whole calls. Arguments that never parsed become an empty input, which the
executor refuses in words rather than the loop throwing. Frames split on `/\r?\n\r?\n/`, the decoder
is flushed and the tail absorbed — the last frame often arrives with no blank line after it, and it
is the one carrying `stop_reason`.

**Precision is asked for, not hoped for.** Three shaping flags, each answering a measured failure of
the open review. `--diff [ref]` attaches every file's diff and states that unchanged files are
context rather than subject — of the findings in the first three consults here, a good handful were
about code the turn never touched, and that class of noise crowds out the real ones. `--verify
"<risk>"` names risks to rule on, CONFIRMED / REFUTED / CANNOT TELL against a quoted line, because a
reviewer verifying a stated risk is reliable where a reviewer discovering one invents; the published
work on critic models puts human-plus-critic ahead of either alone for exactly this reason.
`--only blocker,major` drops the rest rather than downgrading it — the same precision-for-coverage
trade CriticGPT exposes as a decoding knob.

**Receiving is half the mechanism, and it lives in the skill, not here.** A model cannot localise its
own errors but fixes them once localised, so a finding is a pointer whose worth is the verification
you do of it; and a model challenged on a correct answer tends to cave, so capitulation is the
failure mode to design against. `verdict` exists to make the acceptance rate visible instead of
assumed.

**The log is the session.** There is no session id: `historyFor()` replays this repository's last
three answered consults — the intent that was judged, the reply, and the verdict recorded against
it — so a second consult can say Resolved / Still open / New. `verdict --accepted n --rejected n`
records what survived contact with the work, because the reply is only half an eval set, and it is
scoped to this repository and to consults that actually answered: "3 accepted" against a gateway
timeout is not a verdict.

**A `started` entry is written before the call.** A consult that dies mid-flight reaches neither
handler, and a review that vanished is the one an eval most wants to see. The result closes the pair
on the consult's id; `log` says whether an unpaired start is still inside its budget or is never
coming back, and `--id` replaces a racy `--last 1`. Each entry carries the commit, a per-file
sha256 and whether the file was clipped, because advice that cannot be tied to bytes cannot be
checked.

**The hook records; it never reviews.** A PostToolUse half notes each document a turn changed and
asks — *once* — for a consult at the end. That reminder is context and nothing blocks a turn over it;
what does is `codex-second.mjs`, which refuses the next write when the advisor has spoken over a dirty
tree and no consult has followed. Once, because an instruction repeated on every write gets ignored: `afterTouch` answers
`added` and `first` separately for that reason. The turn is keyed by canonical git root, since one
state file serves every checkout, and `clearConsulted` removes only what was consulted on — a file
recorded while the call was in flight is not part of that answer. What counts as a document is
`codex.pathRe`, `^docs/.*\.md$` by default, because prose is what nothing else here checks;
the files come from `touched()` rather than `tool_input.file_path`, so a document written by a shell
heredoc is caught too.

`doctor` reports codex and gates nothing — a missing gateway profile costs the second opinion and no
verb.

## `hook-log.mjs` — what the gates refused

Three false refusals shipped in one session — a Cloudflare DNS query containing `cp`, a commit
message quoting `mv`, a consult intent whose heredoc body quoted `writeFileSync` — and every one was
found by watching a command fail. A refusal left no trace anywhere: `codex-log.jsonl` records
consults and verdicts, and the gates recorded nothing. So `deny()` and `block()` in
`plugin/hooks/_hook.mjs` now append to `hook-log.jsonl` themselves, reading an event that
`readEvent()` stashed, which is why no hook's call sites mention logging and every gate is covered
including the two that predate this.

`forge hooks [--deny|--block] [--hook h] [--last n]` reads it back with a count per hook, so a
pattern that refuses too much shows up as a number rather than as an anecdote. Only refusals are
logged: they are the signal a false positive leaves. Allows would double the write sites for a
question nothing is asking yet.

`forge hooks --how <hook>` prints that gate's reasoning: `plugin/hooks/how/<hook>.md`, which is
where the paragraphs a refusal used to carry now live. What a hook prints reaches a context window
on every tool use, so a refusal states the shape it refused and one action and ends with this
command — measured at 1,765 characters of standing argument removed from seven gates. The document
sits under `plugin/` because only that directory travels into an installed plugin, and a name with
no document is refused with the nearest one that has, like every other hook name this verb takes.

**The log is a file on disk, so it never holds a credential.** `scrubbed` masks named secret flags
(`--token`, `--password`, `--api-key`, `--secret`), `Authorization`/`Bearer` values, and the shapes
that read as a secret on sight — a Coolify `7|…` token, a JWT, `sk-`/`ghp_` prefixes — then cuts the
line at 220 characters. The reason is specific: an hour before this was written, a Coolify API token
reached a session transcript through a redaction that missed one nesting level. A zone id and a
hostname survive, because those are what the log is read for. Mode is 0600, and a write that fails
is silent where `logConsult` warns — a hook's stderr is protocol, and a full disk must not turn a
gate into noise on every call.

## `doctor.mjs` — everything at once

Every other verb fails at the first missing piece and tells you about that one. Doctor is the
opposite: it reports all of them together, because "no credentials" and "credentials from the
wrong file" look identical from inside a single failing command. It also installs the account
half, since the fix for the commonest finding is to write a token somewhere private.

**It withholds values by default.** Doctor's output lands in an agent's context, and an agent
never types a token, a project id or a path — the CLI resolves all three. So the default reports
that each resolved and from where. A fragment of a credential is still a credential once it is in
a transcript, and a project id an agent can read is one it can paste into a call the CLI exists
to stop it writing. `--full` is for the human holding two tokens who needs to know which is which.

**Capabilities are probed, not counted.** A tool appearing in `tools/list` says nothing about
whether this credential may call it — all 67 are declared to a PAT, and `forge_project_pm` then
refuses all six of its actions. Read-only, one call each. What the probe learned is written down,
keyed by project, so `tools` and `schema` can mark a gated tool without paying for a probe of
their own; the date goes with it.

**It settles CLAUDE.md's claims about the repo.** Eight of them, calibrated by running the check
over 28 real CLAUDE.md files in this tree rather than over one:

| Claim | Falsified by |
|---|---|
| a path | nothing resolving, and no file of that name anywhere |
| an `npm run <script>` | no package.json the project holds declaring it |
| a script told to answer `-h` | the file handling no such flag |
| a command told to answer `-h` | it not being on PATH |
| a git ref such as `origin/production` | `rev-parse` not resolving it |
| **an absence** — "there is no `backend/.env` and there must not be one" | the file existing |
| a cited sha | it being no ancestor of `HEAD` |
| a cited `FR-`/`BR-`/`UC-`/`ISS-` identifier | it appearing nowhere else in the repo |

The absence claim is why the direction matters: read the other way round, a checker reports the
*required* state as the defect. Three of these projects state the identifier rule themselves — "a
cited identifier must exist" — so that check is theirs, not this tool's invention.

Only backticked spans and link targets count; prose naming a file is not a claim. A placeholder, a
glob, a package name, a url, a CIDR block, a date mask, a bare extension used as a noun, a git ref
and a build directory are all excluded, each because it produced a false positive on that corpus.
A path whose basename exists elsewhere is *stale* rather than missing — `port-plan.md` for
`docs/port-plan.md` — and prints as one `note` with a count, because at 102 occurrences across the
corpus it is worth a line and not a list.

**Structure, against the published rules rather than taste.** `code.claude.com/docs/en/memory`
gives a line target and an emphasis rule; `docs/en/best-practices` gives the include/exclude table.
Two of these are mechanical and gate: a file over **200 lines** (the documented target — longer
files consume more context and reduce adherence), and an `@path` import that resolves to no file,
which matters because an import loads at launch. Import parsing skips backticked spans, as the
docs specify, so `` `@README` `` stays literal.

Three are notes, because each is a reading rather than a measurement:

- **Emphasis dilution.** The docs say that if you emphasise many lines, none of them stands out.
  Measured over 28 real CLAUDE.md files, nine had *every* bullet bold-led — sid-erp's own was 25 of
  25 before this check existed. Flagged above 80% of at least 8 bullets.
- **Vague words** — "appropriate", "adequate", "properly", "clean code". The docs' exclude table
  names "write clean code" specifically. A word quoted as an anti-pattern is not a finding: one
  project lists these exact words as signals of unfinished thinking, and meant it.
- **Coverage** of what the docs say a CLAUDE.md is for — commands, testing, environment quirks,
  gotchas. A gap to look at, never a fault; a library with no deploy has no deploy section.

The structure and claim checks read the tree and nothing else, so they run **before** the endpoint:
a project with no Forge slug, or no Forge project at all, still gets its CLAUDE.md checked.

**Claude Code ships its own `/doctor`**, which proposes trims for a checked-in CLAUDE.md — it cuts
what Claude can derive from the codebase and keeps pitfalls and rationale. That is a judgement made
by a model; everything here is a measurement made by a command, and the two are complementary
rather than a second way of doing one thing.

**A rule with a checker is not documented twice.** Doctor reads the rule names the project's own
checkers declare — eslint configs, a `rules/` directory, a gate script — and notes each one
CLAUDE.md explains, because the message a developer reads when it fires is the documentation. It
matches only backticked, hyphenated names against names a checker declares as a literal, so a rule
that derives its name from its filename is missed and a stray `"edge"` string cannot false-positive.

**It reviews CLAUDE.md against the guides, and the guides are the authority.** The project file is
the copy: a rule stated in both has two homes, and the pair diverges the first time somebody
corrects only the one they found — silently, because each still reads as correct on its own. So
doctor measures the project root's CLAUDE.md against every guide body and prints the guide first.

The measurement is `hooks/vendor/text-overlap.js`, the same Jaccard index the duplicate-comment
rule and `skill-dup.mjs` use, at 0.25 over a floor of 3 rather than the shared 0.34 over 5. That
is a calibration and not a preference: two documents state one rule in their own vocabularies, so
"a green gate proves nothing about a screen" and "a page that returns 200 proves nothing" share
three content words where two comments in one file share eight. Measured over 28 real CLAUDE.md
files against these guides, 0.34/5 finds nothing at all and 0.25/3 finds seven pairs, every one a
real restatement.

**A pair is reported, never classified.** Negation is a stop word, so a restatement and a flat
contradiction score alike and the tool has no way to tell them apart — claiming one would be a
resolution it does not have. Reading the pair is the reader's job, and this is why an overlap
prints as `note` and cannot fail doctor: a check that stays red until somebody edits prose gets
switched off.

**A project may override a guide; it may not fork one by accident.** The difference has to be
said out loud, in the waiver grammar the ESLint rules already use — `overrides: <guide-slug> —
<why this project differs>`, on a line inside the block that differs, with a reason that is not
optional. A marker sanctions the pairs against that guide and nothing else. A marker naming a
guide that does not exist waives nothing and *does* fail doctor, because that one is mechanical.

**A guide that is really one project's is a finding against the guide.** Guides are global, so a
global guide whose body calls a foreign MCP namespace — `mcp__epodsystem__*` and not
`mcp__forge__*` — is describing one integration to every project that reads it, and that scope
belongs on the project rather than in the guide set. It prints as `note`: the guide lives on the
server, so nobody can fix it from the checkout doctor is reporting on.

Discovery is anchored at the `.forge.json` directory, else the checkout — never an unbounded
walk-up, which from a subdirectory eventually reaches `~/.claude/CLAUDE.md` and reviews the user's
global file against a project's guides. The root file only; a nested CLAUDE.md is another scope.

A missing `vi-natural` key is not a reachability problem, but `forge new` and `forge comment`
translate before they post, so a green doctor would send `doctor && new` into a certain failure.
Reads and writes differ here, and the exit code follows the stricter one.

The gateway url and the model are read beside the key, because neither has a default to fall back
on — a host and a model id both belong to whoever runs the gateway, and a saved key alone is
configuration that looks complete and dies at the first call. All three print on every run whatever
`translate` says — the vi-natural skill translates a locale file with no tracker in sight — and only
the tracker's own writes gate on them.

## `hook-switch.mjs` — which gates run

`hookNames()` is the hooks directory, read: nothing here carries a list, so a hook added later is
switchable without anyone editing this file. Derivation alone did not make that true — an entry
point can skip `readEvent` and keep running while `forge hooks --off` reports it off, which is what
`link-cli` would have been — so a test asserts that every file in `hooks/` calls one of the two,
and names the fix when it fails. `hookOff(name)` asks one place, the account config, and treats anything that is not an array as
empty — which is what makes a broken config run every gate rather than none. Nothing in the
environment reaches it, and a test asserts that against the module's own source: a second layer is a
precedence rule plus a report that has to name which layer holds a gate. `forge hooks --off <hook>` validates against the derived names and answers with
the near miss, so a typo cannot write a switch that silences nothing.

`hookEvents()` parses `hooks.json` into name → events, which is how a name becomes a *type*: the
switch answers name the event they turned off, and a test fails on a script registered on two, whose
name would take both. `offNow()` is what is down right now, each with its event. `forge doctor` prints one line per gate
`hooksOff` holds with the command that clears it, one per variable a gate reads of its own — those
pairs read out of the hooks themselves — and reports a name matching no hook file as a miss. Why the switch is read by the hook process rather than declared in `hooks.json`:
docs/HOOKS.md.

## `resolve/` — where every setting comes from

**Two scopes, and they are not the same scope.** The url and the token are the *account's*: one
Forge instance, one PAT, every project. The slug, the prose language and anything else a tracker
decides for itself are the *project's*, and they change when you cd elsewhere — so the slug is
demanded lazily, by the call that actually needs a project id, and `tools`, `schema` and `guide`
never ask for it.

Every setting resolves to `{ value, from }`. Provenance is the return type rather than a courtesy
some resolvers extend, because that is what `doctor` reports.

**One source per setting.** The url and the token are the account config's, the slug and the prose
language a `.forge.json`'s, and nothing else answers for any of them — not the environment, and not
a `.mcp.json`. `sourced()` is what remains of a chain: a value and the name of the one file it came
from, because `doctor` reports provenance even where there is nothing to arbitrate. A `.mcp.json`
naming a `forge` server is *reported* and never read, since a setup that stops answering in silence
is the failure this report exists for, and credentials that resolve by directory are the account's
in name only. Six
variables remain and none of them is a value: `XDG_CONFIG_HOME` and `CLAUDE_PROXY_ENV` say *where*
config lives, `CLAUDE_PLUGIN_ROOT` and `CLAUDE_PROJECT_DIR` are what the platform passes a hook, and
`CLAUDE_CODE_DISABLE_ADVISOR_TOOL` and `FORGE_CODEX_DISABLE` are kill switches — a kill switch has
to work when the config file is what is broken, which is the one thing a config flag cannot do. A
test walks every source here and fails on a seventh name, because an env read is one line that looks
like every other line.

The codex knobs live in a `codex` object in the account config — `model`, `pathRe`, `rounds`,
`maxTokens`, `budgetMs`, every key optional and defaulted in code. `forge codex -h` lists them.

**Credentials sit outside every repository.** A token in a repo file is one `git add -A` away
from a remote, which is the other half of why a `.mcp.json` is not read from. The config is
0600 *from the moment it exists*: a token written world-readable and chmodded afterwards was
world-readable for the length of the write, and `w` sets the mode on create only — so a temp file
a crashed run left behind would take the token at whatever permissions it already had.

The once-only memo remembers *that* it ran, not what it returned. Four of the seven hand-rolled
memos it replaced tested the value for truthiness, so each would silently re-run on a valid
`null`. The git helper returns trimmed stdout or null; a caller destructuring it as
`{ status, stdout }` gets two undefineds and silently takes its own fallback branch forever.

**Worktrees.** A linked worktree has no `.forge.json` of its own — it is git-ignored and belongs to
the checkout it was created in. `--git-common-dir` names the main
checkout's `.git`, whose parent holds them, and that is the only way in from a worktree kept
outside the main tree. Memoised: unmemoised this spawned `git rev-parse` nine times for one
`forge issues`, and the cwd does not move inside a run.

**`translate` is off by default.** Measured 2026-08-27: sid-growth is Vietnamese and forge-dev is
English, so posting one convention into both is a wrong-language issue no verb can delete
afterwards. That failure is unrecoverable; a missing translation is an edit. `deps` sits at the
same altitude for the same reason — a convention the tracker owns, not the CLI.

**Flag parsing lives in one place.** Three verbs had grown their own copy, and two dropped a
valueless flag silently, which reads as an unfiltered answer.

## `resolve/visibility.mjs` — what this credential may see

Two mechanisms, deliberately not merged: the server *refuses* a tool (measured by `doctor`,
cached per project), and a human *chose* to withhold a verb (`doctor --hide`). They differ in
authority and in consequence — a gated verb cannot run, a withheld one is merely unlisted and
still works — so collapsing them would lose the distinction that makes each correct.

`needs` is declared on every verb with a backing tool, not only the ones the probe list covers:
if `forge_issues` is ever gated, six verbs must disappear together rather than stay offered and
fail one at a time.

The usage line lived twice — once in the verb table and once inline in each verb's `fail()` — and
the two had drifted four ways, so `forge -h` and the error a caller hit disagreed about which
payload forms exist.

A cached refusal is replayed, never re-probed: filtering a listing must not cost a call per tool.
The schema a gated tool publishes is an invitation to a call that cannot succeed, so it is not
printed at all.

## `rpc.mjs` — one transport

The endpoint speaks JSON-RPC over a single POST, so this is that POST plus the two things a
caller should never type: the credentials, and the project id.

**Rate limits.** The server states its own wait:
`{"code":"RATE_LIMITED", …,"details":{"retryAfterSeconds":2}}`. Failing instead of honouring it
turns a two-second pause into a lost run; honouring it without a ceiling turns a server saying
3600 into an hour of sleep, four times over.

**Errors.** A schema violation comes back as a pretty-printed zod array carrying `pattern` — the
full uuid regex, ~150 characters, repeated per field. The path and the message are the whole
signal. A tool result carries its payload as text, structured, or both; `isError` is the tool's
own refusal rather than a transport failure, and must not read as a success.

**The tool surface is cached.** `tools/list` is 130 KB and every verb needs it — to answer "does
this tool take a projectId", and to validate a name or filter before spending a round trip.
Fetched per process it was 75% of the traffic of `forge issue`. It describes the server, so it is
cached beside the config, keyed by endpoint, and refreshed whenever a lookup misses. The
*promise* is memoised, not the value: assigning after the await lets two concurrent callers each
fire the request, turning one 130 KB fetch into five the moment anything runs in parallel. A miss
refetches before erroring, because an absent name may be a typo or may be a tool the server grew
since the cache was written, and only one is worth an error.

Which tools take a project key is read from the schema rather than a list here that would go
stale against the server it describes.

**Every write announces its target.** A write goes to whichever project the cwd resolves and
`forge_issues` has no delete action, so announcing is not a courtesy owed per verb — `dep` and
`attach` had each been written without it.

## `suggest.mjs` — "did you mean"

An agent's mistakes are not a human's. It does not fat-finger adjacent keys; it recalls a name
from the wrong shape — a dot where the server wants an underscore, a singular for a plural, a
stem it saw in a schema three calls ago. So the match is on the separator-stripped form, and
containment counts as much as edit distance. Zero is an exact match on that form, so a name
differing only by separator sorts ahead of everything — the commonest miss against this server's
dotted tool names.

## `vi.mjs` — the tracker is Vietnamese

A source given to this CLI is English; the prose fields are replaced by what `vi-natural`
returns, so authorship is a property of the pipeline rather than a claim about it.

`vi-natural review` was tried as the gate first and cannot be one — it flagged its own previous
suggestion, so it has no fixed point and blocking on its findings never terminates. Translating is
one deterministic pass, and a source that stays English is the source to fix.

The binary is the one shipped beside that file, never whatever PATH resolves: a plugin that spawns
a copy it did not ship has no idea which contract it is getting.

Every prose field an agent can write is translated, not only the three the wrapped verbs started
with. `plan` and `acceptanceCriteria` are written by the plan step and read by whoever works the
issue next, so leaving them out posts English into a Vietnamese tracker while the banner says the
prose was rewritten — found by reading a write back rather than trusting it.

`doc` mode keeps fenced blocks, inline spans, link targets and blank-line structure, so a body may
carry shas, file paths and identifiers without either being translated or stripped.
