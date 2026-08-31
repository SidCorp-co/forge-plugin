# The hooks, and why each one exists

Eight hooks, and the reasoning behind them. The code states constraints; this states the
failures the constraints were written for. `plugin/hooks/hooks.json` is the wiring.

## Two levels

This plugin is the **global** level: it owns *when and where* a rule fires — which tool routes
are watched, which directories are in scope. A **project** owns *what counts as correct*: its
ESLint config, its thresholds, its gates. Which level a rule belongs to, and what happens
where both could speak, is stated once in
`plugin/skills/issue-flow/references/two-levels.md`.

## Which files a call wrote — `_hook.mjs`

The file hooks watched `Write`, `Edit` and `MultiEdit` and nothing else, so every edit made
through the shell — `sed -i`, a heredoc, a one-liner that opens a path — passed all of them
unseen. Under a permission mode that encourages Bash that is not an edge case; it is the main
road.

Parsing the shell command is the wrong tool, because there is no bounded set of ways to write
a file. So the hook asks the disk instead: any path-shaped token in the command that names a
real file whose mtime is within the last breath is a file this call just wrote. That covers
`sed`, a heredoc, `tee`, `cp` and a script that opens a path it mentions, without any of them
being understood.

## `code-quality.mjs` — the plugin fires, the project decides

`eslint-plugin-code-quality` ships its own Claude plugin whose hook script resolves the
consumer project's workspace, ESLint binary and config. Reimplementing that here would be a
second copy of something already maintained, so this hook forwards to it instead — preferring
the project's own copy in `node_modules`, falling back to `hooks/vendor/` for a project that
never installed the package. A project with no ESLint stays silent either way; the script
treats that as an opt-out rather than a misconfiguration.

The gap that justifies a wrapper is routes, not rules: the shipped hook's matcher is
`Edit|Write|MultiEdit|NotebookEdit`, so the shell route was unwatched.

The vendored copy is a copy on purpose — that script is built to travel alone into a plugin
cache, and its own header says so. `plugin/scripts/check-vendor.mjs` compares it against
upstream when upstream is on this machine, and reports which commit it is pinned at when it
is not. It compares code rather than commit ids: upstream moving without touching that file
is not drift.

`hooks/vendor/text-overlap.js` is here for the same reason and read by a different caller:
`plugin/scripts/skill-dup.mjs`, so the duplicate-text measurement the `no-duplicate-comment`
ESLint rule uses is the one the skill audit uses. Every file in `vendor/` names its own
upstream path in its header, which is what lets the check walk the directory instead of
carrying a list of what is vendored.

The delegate runs the project's `prettier` before linting, so it **writes** the file.
Extending it to the shell route means a file written by `sed` gets formatted too — the same
contract every project already accepted on `Edit`.

## `derive-dont-list.mjs` — a checker that hard-codes its cases

A checker earns its keep by catching what nobody predicted. A list written by hand only knows
the cases its author had already met, and it fails twice over: it stays silent when someone
adds a case it never heard of, and it reports a false gap when someone extends the thing
correctly. The second failure is the expensive one — a checker that cries wolf gets switched
off, and a switched-off checker protects nothing.

Measured on a real repository: an error-code test carried a six-item list copied by hand out
of a `switch`. Adding one arm to that switch and one code to the shared contract — a correct
change, both halves consistent — made the test fail on the correct change, while a version
that derived its cases from the source stayed green.

It is a nudge, not a refusal, because a hard-coded list is sometimes the honest answer: a
ratchet's list of migrated directories is *supposed* to be enumerated, because being
incomplete is the point. A comment directly above the literal silences it outright. That is
not politeness — it is the difference between a list nobody examined and one somebody decided
on, and the decision is the only thing a reader downstream can act on.

## `learning-gate.mjs` — two writes, and they are not the same write

A memory row is *project knowledge*. An edit to a skill's own text is a *skill learning*,
which develops the method rather than the repository. Confusing them loses the lesson twice:
the project inherits a rule it never agreed to, and the skill repeats the mistake in the next
repository.

The failure this guards is not a bad memory row — it is the reflex one. An agent that
finishes a task reaches for "save what I learned" as a closing ritual, and the corpus fills
with entries nobody reads, which is how the two or three that mattered get buried.

So the gate is cheap to pass and impossible to pass absent-mindedly. The write is refused
once; the four conditions and the category list come back as the reason. A memory row passes
on a second attempt carrying `metadata.checked`, and a file edit passes on the next attempt at
the same file in the same session. Naming the category is the point — it is the one part of
the test that cannot be answered by nodding.

**A declared `type:` buys nothing.** It used to end the check, so the only memory write ever stopped
was a malformed one — and shape is not what is wrong with a second copy. The schema is in the agent's
own instructions, so `type: feedback` costs it nothing to type. Every memory write and edit is now
stopped once per file, with one action fitted to the situation: a new file is asked why it should
exist and given the shape, an edit is told to replace the wrong rule in place rather than append a
version beside it, and a restatement is named. A write carrying no content is reminded too rather
than waved through, because emptying a memory is exactly when "delete it if the rule no longer
holds" is the advice.

Condition 4 is the one a hook can actually check, so the text is compared sentence-by-sentence with
the other memories in the directory and above 0.45 the reminder names the file it restates.
Calibrated on six real memories: five score 0.00 against the others, the one genuinely related pair
0.27, a paraphrase re-filed under a new name 1.00. A file is excluded from its own comparison, so
revising one never reads as duplicating it.

A memory or skill file written through the shell would pass all of that unseen, because
`sed -i` and a heredoc carry no content the gate can read, and the decision has to happen
*before* the write. So that route is closed for those two kinds of file rather than
approximated. Naming a file is not touching it: only a command carrying a write shape is
asked about, so reading a skill stays free.

**A refusal names which kind of file it means**, states the rule in one line, and gives one action.
"A memory or a skill" makes the reader work out what it is being told, and a refusal that only
redirects the tool teaches nothing about whether the fact belongs in a file at all.

**A heredoc body is data — until an interpreter executes it.** `python3 - <<PY` hands its body to a
program that runs it, so discarding it as data left a `Path(...).write_text(...)` aimed at a guarded
directory invisible, and a memory file was rewritten unasked. Two faults: the write shapes an
interpreter uses (`write_text`, `writeFileSync`, `shutil.copy`, `os.replace`) were missing from the
list, and the body carrying them was thrown away. A body survives now when the operator's own line
names something that executes stdin, which `cat` does not. `bodiless` lives in `_hook.mjs` because
`advisor-first` needed it too — a data heredoc there was an *intent* quoting the write shapes, and
the gate refused the consult that was about to describe them.

The cost is real. A program that carries a write shape *and* quotes a guarded path is refused even
when the path is only prose — which caught the very commit documenting this. Which token the program
would actually open is not knowable from the text, and refusing is the right side to err on when the
way out is one tool call.

## Every refusal is written down

A gate that refuses too much is the failure mode here, and for months nothing recorded a refusal:
three false positives in one session were all found by watching a command fail. `deny()` and
`block()` append to `~/.config/forge/hook-log.jsonl` themselves — the event comes from a stash
`readEvent()` fills, so no hook passes anything and the gates that predate the log are covered too.
`forge hooks --deny` reads it back with a count per hook. Credentials are masked and the line is cut
at 220 characters before anything is written: `docs/FORGE-CLI.md` says which shapes and why.

## `bash-guard.mjs` — what cannot be undone, and what launders a finding

Every rule here used to be a sentence in a skill. A sentence is read by an agent that decided
to read it, and these are the cases where one missed reading costs work nobody can
reconstruct: a process the user has been running for days, or uncommitted changes with no
history to restore from.

`--fix` is the second kind. Nothing is lost — the rewrite is in git if the tree was clean —
but the run comes back green without anyone deciding which findings were real, which is the
one outcome a checker exists to prevent. So it is refused whatever the tree looks like, and
the message names the single case where the sweep is the point: adopting a new formatting
rule, which is a decision to put to the user rather than a step to take.

It is deliberately narrow. A guard that refuses too much gets disabled, and a disabled guard
protects nothing — so each pattern names one command shape with a stated safer form, and
anything it cannot recognise is allowed through. The git rules only bite when the tree is
dirty, because there is nothing to lose otherwise, and any doubt counts as dirty. The
`--fix` rule is anchored on command position for the same reason a narrow guard survives: a
commit message or a doc line that quotes the flag is prose, and refusing it would teach the
agent to route around the guard rather than obey it.

## `codex-turn.mjs` — the review that knows what you were trying to do

The other four hooks judge a write against a rule. This one judges nothing: it records which
documents a turn changed and asks for a second model to read them at the end, with the intent
attached. Splitting it that way is the point — a per-write review sees a paragraph and cannot know
whether the paragraph was the plan; a review at the end of the turn sees the turn.

**It asks once, then it insists.** The first document of a turn carries the instruction and the rest
are recorded silently, because an instruction repeated on every write is an instruction that gets
ignored. `afterTouch` in `plugin/src/codex.mjs` therefore answers `added` and `first` separately.

**There is no Stop half.** One existed briefly, twice: first printing the reminder into a channel
nobody reads, then refusing the ending with `{"decision": "block"}`. The refusal worked — and the
first turn it caught was one that had only edited this document, which is not what anyone wanted a
turn stopped for. The user removed it on sight. So the asking ends at PostToolUse: it is context, the
agent can ignore it, and nothing here forces a consult. `forge codex pending` still lists what a turn
left unread, for whoever wants to look.

The logic lives in `src/codex.mjs` rather than the hook, so `forge codex` and the hook cannot drift
on what counts as a document or where the turn is written down. The turn is keyed by canonical git
root: one state file serves every checkout on this machine, and its paths are repo-relative.
`FORGE_CODEX_DISABLE=1` silences it. There was a second switch, `FORGE_CODEX_INSIDE=1`, set on the
detached child a background consult used to spawn; a consult now runs inline, so nothing sets it and
it is gone.

## `advisor-first.mjs` — the call that is easy to forget

`codex-order` orders the two opinions, and that is not the failure the user kept hitting. The failure
is simpler: **the advisor is never called at all.** It cannot be automated — a server-side tool is
not dispatched locally, so no hook can invoke it — so the nearest thing is to make forgetting
expensive at the moment forgetting starts. The first write of a turn is what trips it — the plan is
still soft there, and one call costs nothing next to the same point arriving after the work — and it
stays tripped while no `advisor_tool_result` appears after the last prompt.

It is a wall, not a nudge: every write in the turn is refused until the call appears in the
transcript. That is safe here and it would not be in `learning-gate` — this condition is a fact the
agent can clear by calling advisor(), where only the agent can judge whether a memory is worth
recording, so that gate has to let the re-send through. The re-send is the escape hatch there; here
the advisor call is.
The turn boundary is `promptSource`, the same field `codex-order` stopped trusting — and here its
unreliability runs the safe way. A message typed mid-turn reaches the transcript as one of two
shapes: a `queue-operation` record, which moves no boundary, or a `user` record carrying
`promptSource: "queued"`, which moves it like any prompt. When the second shape or a compaction
summary is read as a new turn, the cost here is one extra advisor call; in `codex-order` the same
misreading cost a false refusal.

It reads a write the way `learning-gate` does, through the shared `WRITES` and `REDIRECT` tests,
because most of this repo's edits arrive as an interpreter writing a file or as `cat > file <<EOF`
rather than as the `Write` tool — the first version covered only `WRITES`, and the user named the gap
before the hook had fired once. A redirect counts unless its target is under `/dev/`, so `2>/dev/null`
is not a write. `CLAUDE_CODE_DISABLE_ADVISOR_TOOL=1` stands the gate down.

**The first write after an advisor call is always refused, and the message says so.** The gate
refused writes seconds after live advisor calls, repeatedly, with the user watching. The logic was
right — replaying `advisedThisTurn` against the transcript truncated to what the hook could have read
returns `true` — and the file was wrong. Measured: the record generated at 12:18:11, the write
dispatched at 12:18:14, the refusal returned at 12:18:15, the transcript file not written until
**12:18:26**. The record lands about one tool round-trip later, and past this hook's 10-second
timeout, so no amount of waiting inside the hook can reach it. A `settle()` that re-read for a second
was tried and removed: it never once caught the case and cost every honest refusal a second. So the
refusal names the real move — run any other command, then re-send — and `codex-order`'s first half
says the same, because it reads the same lagging record. The price of the wall is one refused write
per turn. Making a codex consult the suggested escape instead would not work: `codex-order` gates the
consult on that same record, so both go blind together and the consult is refused too.

**A verb only counts in command position, and prose is not command.** Three false refusals in one
session, all from one matcher: a Cloudflare DNS query (`--name cp.musetools.com` contains `cp`), a
commit message quoting `mv`, and the intent of a codex consult whose heredoc body quoted
`writeFileSync`. So `advisor-first` runs `bodiless` first, and the shell verbs (`sed -i`, `tee`,
`cp`, `mv`, `truncate`) are anchored the way `bash-guard` anchors `--fix`.

Anchoring is where this gets narrow in the wrong direction, and codex caught it: a first version
allowed only separators and a short wrapper list, which missed `MODE=fast cp a b`, `command mv a b`
and `if cp a b; then`. Command position now means start of string or line, after `;` `&` `|` `(`,
after `-exec`, after an assignment prefix, or after `sudo`, `command`, `nohup`, `time`, `env`,
`xargs`, `do`, `then`, `else`, `if`, `elif`, `while`, `until`. `^` alone was another such miss —
without `/m` it matched only the string start, so `cd repo\ncp a b`, the shape most of this repo's
commands take, was invisible. The library calls — `open(…, "w")`, `write_text`, `writeFileSync`,
`shutil.copy`, `os.replace` — need no anchor, because nothing else looks like them.

The two errors are not symmetric, which is why the anchor is generous: a false refusal costs one
advisor call, and a missed write is the wall silently not existing.

## `codex-second.mjs` — the second opinion happens

`codex-order` puts the two opinions in order and `advisor-first` makes the free one happen. Neither
makes the *second* one happen, and it did not: a commit landed, then an hour of hook changes, with
the advisor consulted four times and codex not once. The end-of-turn reminder is `additionalContext`
— an agent can ignore it, and did.

**Where it fires was the user's choice, and the alternatives were measured.** Claude Code 2.1.251
offers `PreToolUse`, `PostToolUse`, `Notification`, `Stop`, `SubagentStop`, `SessionStart`,
`SessionEnd`, `UserPromptSubmit` and `PreCompact`. There is no advisor event: the advisor is a
server-side tool handled in the streaming path, so nothing local is dispatched and no `PostToolUse`
follows it. `Stop` was tried twice — printing, which reached nobody, then blocking, which stopped a
turn whose only change was this document — and removed. What is left is the write itself, which is
where the user asked for it: a `PreToolUse` on a write *that follows an advisor call*.

So the condition is four facts, all cheap: the call writes, the advisor has spoken this turn, no
consult has spent that advice, and `git status --porcelain` is non-empty. The last one matters — a
clean tree gives codex nothing to read, and a rule enforced where it cannot be satisfied usefully is
the kind that gets switched off. Before the advisor speaks this is `advisor-first`'s refusal to make,
not this gate's; two walls arguing over one write is the same failure.

**It decides once per advisor call, not once per write** — and that is a rule change codex named
before it shipped. Standing down when nothing dirty postdates the last consult stops the gate
demanding a review of bytes codex just cleared; alone, it also means the write it allows creates new
dirt, so the *second* write of a turn gets refused and the consult it demands reviews a fragment. So
the decision is stamped: a stand-down is remembered for that advisor call, a refusal is not, and a
new advisor call re-arms the question. The cost, accepted deliberately: work built after a stand-down
is not reviewed in that turn. It is reviewed at the first write of the next turn, when it is finished
rather than half-built. A deletion has no mtime and slips through; a turn that only deletes is not
what this is for.

One consult clears the turn, because the same spend accounting `codex-order` uses says the advice is
answered. `FORGE_CODEX_DISABLE=1` clears the session, and `CLAUDE_CODE_DISABLE_ADVISOR_TOOL=1` stands
it down too — with no advisor there is no first opinion for this to be second to.

The price is stated rather than hidden: a turn that takes advice and touches a dirty tree pays one
consult, around 30–60 seconds, before its first write lands. That is the trade the user asked for
twice — "not relax but forget to run" — after watching the reminder be ignored.

## `codex-order.mjs` — the second opinion goes second

Two second opinions exist here and they are not interchangeable. The built-in advisor reads the
conversation — the reasoning, every tool result, what was tried and abandoned — and costs nothing.
`forge codex` reads the files and has never seen any of it. Run in that order each is worth its
tokens; run backwards, the expensive reviewer pays to rediscover what the free one would have said.

The order was written into a skill first, and that is exactly why this hook exists: **a rule in prose
fires only if it is read.** Measured mid-session, six consults had run and the advisor had not been
called once in the turn that ran them, while the skill said plainly to call it first.

**The advisor cannot be hooked, but it can be witnessed.** It is a server-side tool, so nothing is
dispatched locally and no `PreToolUse` fires. Every call still leaves an assistant record carrying an
`advisor_tool_result` block, and every hook event is handed `transcript_path` — so `unspentAdvice()`
in `_hook.mjs` reads those records and a consult with none behind it is refused.

The second half is a nudge rather than a refusal, because it is a judgement and not a fact: the
advisor's reply is encrypted and unreadable once the turn moves on, so the intent piped to codex is
the only place its content can survive. A consult whose intent never mentions it is stopped **once**
per session. Whether a paragraph really carries the advice is not something a regular expression
should be the judge of.

**What counts as "before" is bookkeeping, not a boundary in the conversation.** The first version
asked whether the advisor had spoken since the last user prompt, and every version of that question
was wrong in the same direction. A compaction summary is a user record bearing text, written *after*
the advisor call it summarises, so it discarded advice from minutes earlier; keying on `promptSource`
fixed that and left a worse case, measured here — advice at 11:16:49, a typed correction at 11:17:36,
the re-run refused 47 seconds after the advice arrived. A prompt is not evidence that advice went
stale, and this user types mid-task, which made that the common case.

So advice is **spent by the consult that follows it**, and by nothing else. `lastConsultAt()` in
`codex-log.mjs` reads the `consult` entries — the ones a finished
review writes, so a consult killed mid-flight licenses its own retry rather than burning the advice
it never got to use — and the gate asks for an `advisor_tool_result` newer than the last of
them, and only from this checkout — one log holds them all, so a consult elsewhere must not spend the
advice given here. One call licenses one consult however many prompts arrive in between, a second
consult wants a second call, and an empty log lets any call in the session through so a fresh
checkout is not locked out. The check and the spend are not one act, and counting only finished
consults widens that window from launch to completion — minutes, now that a consult runs inline.
Two started before the first records itself both read the same advice as unspent. Left alone: this
gate orders a colleague who forgets, not a scheduler that races.

**It reads command position, not prose,** which is `bash-guard`'s rule applied here: the phrase turns
up in commit messages and in heredoc-written docs, and denying those teaches the agent to route around
the gate. An allowlist of wrappers cannot be completed — codex found four real shapes past the first
attempt, including `timeout 180 node .../cli.mjs codex consult ...`, the very command this repo had
just used to run that review. So heredoc bodies and quoted spans are removed as data and what survives
is read as tokens: `codex consult` counts when the token before it is `forge` or `cli.mjs`.

The interpreter-heredoc hole was here too, and closing it needed the opposite of quote-stripping: a
program's own commands live *inside* quotes, so an executed body is read with its quotes intact while
a command that merely mentions the phrase keeps having them stripped. `subprocess.run("forge codex
consult ...")` is gated; `git commit -m "... codex consult ..."` is not.

The residual is deliberate and it runs one way. A contrived command — a quoted `<<EOF` followed by a
line that is exactly `EOF` — can still hide an invocation, and this gate orders a colleague who
forgets, not an adversary who evades. A missed consult costs one duplicated review; a denied commit
message teaches the agent that the gate is noise, and that costs every consult after it.

Two ways out, and not one knob: `FORGE_CODEX_DISABLE=1` switches codex off entirely, while
`CLAUDE_CODE_DISABLE_ADVISOR_TOOL=1` stands only this gate down — where the advisor cannot be called,
an order to call it first is a wall. The transcript also lags the conversation by about a round-trip —
`advisor-first` above measures it — so the refusal says to re-run the command rather than call the
advisor twice.

A transcript that will not open reads as null, never as "no advice given" — a gate that fails closed
on a missing file stops the work it exists to order.
