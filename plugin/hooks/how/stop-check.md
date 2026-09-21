# stop-check — a turn does not end while what it touched is still red

Why: whoever left a thing red is the cheapest to fix it and is still there; every other
reader pays a round.

How to clear it: each line names its command — an edit, a verdict, a park, a commit.

How often: once per item per turn. Five checks: the linter over what this turn wrote; findings
with no verdict; an issue taken and not written against since; tracked changes left in the turn's
worktree; a process it began and left standing — anything in that worktree, and anywhere else
whatever runs a command one of its calls made, in that call's window.

Whose stop: the main agent's always. A subagent's on its own transcript, and only where a project
names its agent type in `stop.agents` — absent, no subagent's.

How to stand it down: `forge hooks --off stop-check` for the session, or `FORGE_STOP_DISABLE=1`
in the environment it started in.

Not judged: the handback's prose, whether tests pass, an issue another session holds, a file
written through the shell, a lease taken in a turn that never names the issue again, a tree dirty
before the turn began, a subagent this plugin did not dispatch, another run's process, unless
in one of those windows it ran a command this turn's own contains, or is contained by.
