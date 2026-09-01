# codex-order — the second opinion goes second

Two second opinions exist here and they are not interchangeable. The built-in advisor reads the
conversation — the reasoning, every tool result, what was tried and abandoned — and costs nothing.
`forge codex` reads the files and has never seen any of it. In that order each is worth its tokens;
backwards, the expensive reviewer pays to rediscover what the free one would have said.

The order was written into a skill first, and that is why this hook exists: **a rule in prose fires
only if it is read.** Measured mid-session, six consults had run with no advisor call in the turn that
ran them, while the skill said plainly to call it first.

**The advisor cannot be hooked, but it can be witnessed.** It is a server-side tool, so nothing is
dispatched locally and no `PreToolUse` fires. Every call still leaves an assistant record carrying an
`advisor_tool_result` block, and every hook event is handed `transcript_path` — so `unspentAdvice()`
reads those records, and a consult with none behind it is refused.

The second half is a nudge, not a refusal: whether a paragraph really carries the advice is not
something a regular expression should judge. The advisor's reply is unreadable once the turn moves on,
so the intent piped to codex is the only place its content can survive — a consult whose intent never
mentions it is stopped **once** per session.

**"Before" is bookkeeping, not a boundary in the conversation.** Asking whether the advisor had spoken
since the last user prompt was wrong in one direction every time: a compaction summary is a user
record written *after* the call it summarises, and keying on `promptSource` left a worse case —
advice at 11:16:49, a typed correction at 11:17:36, the re-run refused 47 seconds after the advice
arrived. A prompt is not evidence that advice went stale, and this user types mid-task.

So advice is **spent by the consult that follows it**, and by nothing else. `lastConsultAt()` reads
the entries a *finished* review writes — so a consult killed mid-flight licenses its own retry — and
only this checkout's, since one log holds every project's. An empty log lets any call through, so a
fresh checkout is not locked out. Counting only finished consults widens the gap between check and
spend to minutes, so two consults started together both read the advice as unspent. Left alone: this
gate orders a colleague who forgets, not a scheduler that races.

**It reads command position, not prose** — `bash-guard`'s rule applied here, because the phrase turns
up in commit messages and in heredoc-written docs. An allowlist of wrappers cannot be completed: codex
found four shapes past the first attempt, including `timeout 180 node .../cli.mjs codex consult`, the
very command this repo had just used. So data is removed and what survives is read as tokens —
`codex consult` counts when the token before it is `forge` or `cli.mjs`.

Closing the interpreter-heredoc hole needed the opposite of quote-stripping: a program's own commands
live *inside* quotes, so an executed body is read with its quotes intact while a command that merely
mentions the phrase keeps having them stripped. `subprocess.run("forge codex consult …")` is gated;
`git commit -m "… codex consult …"` is not. A contrived heredoc can still hide an invocation, and that
is deliberate — a missed consult costs one duplicated review, while a denied commit message teaches
the agent that the gate is noise, which costs every consult after it.

Two ways out, not one knob: `FORGE_CODEX_DISABLE=1` switches codex off entirely, and
`CLAUDE_CODE_DISABLE_ADVISOR_TOOL=1` stands only this gate down — with no advisor, an order to call it
first is a wall. The transcript lags by about a round-trip (`forge hooks --why codex-second` measures
it), so the refusal says to re-run the command. A transcript that will not open reads as null, never
as "no advice given": a gate that fails closed on a missing file stops the work it orders.
