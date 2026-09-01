# codex-order — the second opinion goes second

The two are not interchangeable. The built-in advisor reads the conversation — the reasoning, every
tool result, what was tried and abandoned — and costs nothing. `forge codex` reads the files and has
never seen any of it. In that order each earns its tokens; backwards, the expensive reviewer pays to
rediscover what the free one would have said.

The order was written into a skill first, which is why this hook exists: **a rule in prose fires only
if it is read.** Measured mid-session, six consults had run with no advisor call in the turn that ran
them, while the skill said plainly to call it first.

**The advisor cannot be hooked, but it can be witnessed.** Every call leaves an assistant record
carrying an `advisor_tool_result` block, and every hook event is handed `transcript_path`. A consult
with none behind it is refused. The second half — whether the intent actually carries what the advisor
said — is a nudge, once per session, because no regular expression should judge that.

**"Before" is bookkeeping, not a boundary in the conversation.** Asking whether the advisor had spoken
since the last user prompt was wrong in one direction every time: a compaction summary is a user
record written *after* the call it summarises, and keying on `promptSource` left a worse case — advice
at 11:16:49, a typed correction at 11:17:36, the re-run refused 47 seconds after the advice arrived.
This user types mid-task, so that was the common case.

So advice is **spent by the consult that follows it** and by nothing else — read from the entries a
*finished* review writes, so a consult killed mid-flight licenses its own retry, and only this
checkout's, since one log holds every project's. An empty log lets any call through. Two consults
started together both read the advice as unspent: this gate orders a colleague who forgets, not a
scheduler that races.

**It reads command position, not prose.** The phrase turns up in commit messages and heredoc-written
docs. An allowlist of wrappers cannot be completed — codex found four shapes past the first attempt,
including the very command this repo had just used — so data is removed and what survives is read as
tokens. A program's own commands live *inside* quotes, so an executed body keeps its quotes while a
command merely mentioning the phrase has them stripped.

`FORGE_CODEX_DISABLE=1` switches codex off; `CLAUDE_CODE_DISABLE_ADVISOR_TOOL=1` stands only this gate
down. A transcript that will not open reads as null, never as "no advice given".
