# codex-order — what the advisor said travels into the consult

Why: the advisor's reply is unreadable once the turn moves on, and codex has seen none of the
conversation. An intent that leaves the advice out has codex rediscover it, and its agreement then reads
as confirmation when it is duplication.

How to clear it: add what the advisor said and what you did about it to the intent, then re-run. Asked
once per session, never enforced. A consult with no advisor before it is asked nothing — the order of
the two is yours.

A command that only mentions the phrase in data is not a consult — a heredoc body, a quoted argument, a
program's own string — and `-h` on the consult is not one either. `CLAUDE_CODE_DISABLE_ADVISOR_TOOL=1`
stands this gate down, `FORGE_CODEX_DISABLE=1` every codex gate.

Not judged: whether a consult follows an advisor call at all, advice from a turn a prompt has closed,
and whether the intent's account of the advice is any good.
