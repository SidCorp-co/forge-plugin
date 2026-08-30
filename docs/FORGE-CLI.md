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

A missing `vi-natural` key is not a reachability problem, but `forge new` and `forge comment`
translate before they post, so a green doctor would send `doctor && new` into a certain failure.
Reads and writes differ here, and the exit code follows the stricter one.

## `resolve/` — where every setting comes from

**Two scopes, and they are not the same scope.** The url and the token are the *account's*: one
Forge instance, one PAT, every project. The slug, the prose language and anything else a tracker
decides for itself are the *project's*, and they change when you cd elsewhere — so the slug is
demanded lazily, by the call that actually needs a project id, and `tools`, `schema` and `guide`
never ask for it.

Every setting resolves to `{ value, from }`. Provenance is the return type rather than a courtesy
some resolvers extend, because that is what `doctor` reports.

**Credentials sit outside every repository.** A token in a repo file is one `git add -A` away
from a remote, and `.mcp.json` is git-ignored precisely because it holds one. The config is
0600 *from the moment it exists*: a token written world-readable and chmodded afterwards was
world-readable for the length of the write, and `w` sets the mode on create only — so a temp file
a crashed run left behind would take the token at whatever permissions it already had.

The once-only memo remembers *that* it ran, not what it returned. Four of the seven hand-rolled
memos it replaced tested the value for truthiness, so each would silently re-run on a valid
`null`. The git helper returns trimmed stdout or null; a caller destructuring it as
`{ status, stdout }` gets two undefineds and silently takes its own fallback branch forever.

**Worktrees.** A linked worktree has no `.mcp.json` or `.forge.json` of its own — both are
git-ignored and belong to the checkout they were created in. `--git-common-dir` names the main
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
