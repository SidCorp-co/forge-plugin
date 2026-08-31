# codex-order — the second opinion goes second

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
`forge hooks --why codex-second` measures it — so the refusal says to re-run the command rather than call the
advisor twice.

A transcript that will not open reads as null, never as "no advice given" — a gate that fails closed
on a missing file stops the work it exists to order.
