# codex-order — the free reading first, the paid one second

Why: the advisor reads the conversation and costs nothing; codex reads files and has seen none of it.
Backwards, the paid reviewer pays to rediscover what the free one would have said.

How to clear it: call `advisor()`, act on it, then re-run the consult with its points in the intent. A
re-run clears the gate; a second advisor call does not. Carry the advice in the intent — the advisor's
own reply is unreadable once the turn moves on.

Advice is spent by the consult that follows it and by nothing else: typing mid-task does not spend it,
a consult killed mid-flight licenses a retry, and only this checkout's consults count.

A command that only mentions the phrase in data is not a consult. `CLAUDE_CODE_DISABLE_ADVISOR_TOOL=1`
stands this gate down, `FORGE_CODEX_DISABLE=1` every codex gate.

Not judged: whether the intent's account of the advice is any good — asked once per session, never
enforced.
