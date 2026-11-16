# stop-check — a turn does not end while what it touched is still red

Why: whoever left a thing red is the cheapest to fix it and is still there; every other
reader pays a round.

It holds the stop only on kernel input: an issue taken and not written to since, and a process
the turn began and left standing — anywhere in its worktree, or running a command one of its calls
made, in that call's window. The rest is taught as a warning and the stop goes ahead: the linter
over what this turn wrote, findings with no verdict, tracked changes left in the turn's worktree.
Each names its command; once per item per turn.

Whose stop: the main agent's always. A subagent's on its own transcript, only where a project names
its agent type in `stop.agents`.

How to stand it down: `forge hooks --off stop-check`, account-wide until `--on`, or `FORGE_STOP_DISABLE=1`
where it started.

Not judged: the handback, whether tests pass, an issue another session holds, a file
written through the shell, a lease taken in a turn that never names the issue again, a tree dirty
before the turn began, a subagent this plugin did not dispatch, a `cd -` or `$` destination, judged
at the event's cwd, another run's process, unless in one of those windows it ran a command of this
turn's whole, or the words of one.
