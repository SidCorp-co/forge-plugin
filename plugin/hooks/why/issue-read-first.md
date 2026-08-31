# issue-read-first — the read that looks complete and is not

An issue's body says what was asked for months ago. Its **comments** say what the state is now: an
answer the client already gave, a decision already taken and its reason, a correction that never
made it back into the body. Writing a plan or a note without them posts something that carries the
tracker's authority while contradicting what is already on the issue.

`issue-flow` Phase 1 has said to read the comments from the beginning, and the instruction was
missed twice in one session with the user correcting it both times. That is the evidence prose does
not work here, and the reason is measurable rather than a matter of attention: **`forge issue ISS-nn
--full` returns no comments at all.** The command that reads as "the whole issue" omits the
discussion, so an agent that ran it has read the issue and knows none of its state, with nothing
anywhere saying so.

So the gate is on the write, not on the reading: a `forge comment`, `forge plan`, `forge attach`, or
a `forge_issues` call whose action is not `list` or `get` is refused while no comments listing for
that key appears in the transcript. Every key the command names must have been read, because a
command touching two issues has two states to be wrong about.

**An empty list satisfies it.** The condition is having looked, which is a fact the agent can clear
in one call — so, like `codex-second` and unlike `learning-gate`, this is a wall rather than a
question. A freshly created issue costs one listing that returns nothing.

Only the agent's own `tool_use` blocks are searched. The refusal names the exact command to run, and
that refusal reaches the transcript too — reading hook output back would let the second attempt
satisfy itself with the hook's own suggestion. The key shape is `[A-Z]{2,6}-\d+`, so a tracker whose
prefix is not `ISS` is covered without configuration. A transcript that will not open reads as null
and the gate stands down: it exists to order the work, not to stop it when its evidence is missing.

The key and the call have to be the **same invocation**, and the first version did not require that:
it searched the whole command for the key and for `forge_comments`, which a grep looking for one and
naming the other satisfies — the gate's own diagnostic command cleared it. Found by running the hook
against a real session transcript rather than a fixture, where two of the matches were spurious and
one of them was the measurement itself. A payload handed over as `@file` therefore does not clear the
gate, since the key is then in the file and not on the line; the inline form the refusal prints does.
