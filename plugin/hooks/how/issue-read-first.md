# issue-read-first — the read that looks complete and is not

Why: `forge issue ISS-nn --full` returns no comments at all. The body says what was asked months ago;
the comments say what the state is now — an answer the client already gave, a decision already taken.
Writing without them posts something carrying the tracker's authority and contradicting the issue.

How to clear it: list the comments for every key the command names, inline in the same call, then
re-send. An empty list satisfies it — the condition is having looked, so a freshly created issue costs
one listing that returns nothing.

Every key the command names must have been read, because a command touching two issues has two states
to be wrong about. The key and the listing have to be the same invocation, so a payload handed over as
`@file` does not clear the gate; the inline form the refusal prints does. Any `[A-Z]{2,6}-\d+` key
counts, so a tracker whose prefix is not `ISS` needs no configuration.

Not judged: what you write once you have read. A transcript that will not open stands the gate
down: it exists to order the work, not to stop it when its own evidence is missing.
