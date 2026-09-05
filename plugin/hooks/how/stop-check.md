# stop-check — a turn does not end while what it touched is still red

Why: the agent that left a thing red is the cheapest one to fix it and is still there at the stop.
Every other reader — the parent at the fold, the next run at its start — pays a round to find it.

How to clear it: each line names the command. A finding is an edit, a consult a verdict, a lease a
park or an advance, a worktree a commit. Then stop again.

How often it asks: once per item per turn, so a run that cannot clear one says so and ends. Four
checks, in the budget one event gets: the project's linter over the files this turn wrote through
the file tools; findings with no verdict; an issue taken and never written against since; tracked
changes a turn left in a worktree it stood in.

How to work through it: `forge hooks --off stop-check` for the session, which stands both stop
events down together. `FORGE_STOP_DISABLE=1` does too, and has to be in the environment the session
started in — there is nothing to prefix at a stop.

Not judged: the handback's prose, whether tests pass, an issue another session holds, a file written
through the shell, a lease taken in a turn that never names the issue again, and a tree already
dirty when the turn began. Nothing here runs the project's gate; the ship spends that.
