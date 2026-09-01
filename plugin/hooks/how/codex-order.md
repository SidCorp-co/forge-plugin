# codex-order — the free reading first, the paid one second

Why: the advisor reads the conversation — the reasoning, every tool result, what was abandoned — and
costs nothing. `forge codex` reads files and has seen none of it. Backwards, the expensive reviewer
pays to rediscover what the free one would have said.

How to clear it: call `advisor()`, act on it, then re-run the consult with its points in the intent. A
re-run clears the gate; a second advisor call does not. Carry the advice in the intent, because the
advisor's own reply is unreadable once the turn moves on — the intent is the only place its content
survives to reach codex.

Advice is spent by the consult that follows it and by nothing else. So typing a correction mid-task
does not spend it, a consult killed mid-flight licenses its own retry, and only this checkout's
consults count. Two started together both read the advice as unspent: this orders a colleague who
forgets, not a scheduler that races.

A command that merely mentions the phrase is not a consult — quotes on your own line are stripped
before matching, while a heredoc an interpreter executes keeps them.

`CLAUDE_CODE_DISABLE_ADVISOR_TOOL=1` stands this gate down, `FORGE_CODEX_DISABLE=1` every codex gate.

Not judged: whether the intent's account of the advice is any good. That is asked once per session
and never enforced — no regular expression should rule on it.
