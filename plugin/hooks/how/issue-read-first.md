# issue-read-first — the read that looks complete and is not

An issue's body says what was asked for months ago. Its **comments** say what the state is now: an
answer the client already gave, a decision already taken and its reason, a correction that never made
it back into the body. Writing a plan or a note without them posts something carrying the tracker's
authority while contradicting what is already on the issue.

`issue-flow` Phase 1 has always said to read the comments, and the instruction was missed twice in one
session with the user correcting it both times. The reason is measurable rather than a matter of
attention: **`forge issue ISS-nn --full` returns no comments at all.** The command that reads as "the
whole issue" omits the discussion, so an agent that ran it has read the issue and knows none of its
state, with nothing anywhere saying so.

So the gate is on the write, not on the reading: a `forge comment`, `forge plan`, `forge attach`, or a
`forge_issues` call whose action is not `list` or `get` is refused while no comments listing for that
key appears in the transcript. Every key the command names must have been read, because a command
touching two issues has two states to be wrong about.

**An empty list satisfies it.** The condition is having looked, which the agent can clear in one call —
so this is a wall rather than a question. A freshly created issue costs one listing that returns
nothing.

Only the agent's own `tool_use` blocks are searched, so the refusal cannot satisfy the next attempt with
its own suggestion. The key shape is `[A-Z]{2,6}-\d+`, so a tracker whose prefix is not `ISS` needs no
configuration. A transcript that will not open reads as null and the gate stands down: it exists to
order the work, not to stop it when its evidence is missing.

The key and the call have to be the **same invocation** — searching the command for each separately was
cleared by the gate's own diagnostic command. So a payload handed over as `@file` does not clear the
gate; the inline form the refusal prints does.
