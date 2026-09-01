# issue-read-first — the read that looks complete and is not

Why: `forge issue ISS-nn --full` returns no comments at all. The body says what was asked months ago;
the comments say what the state is now.

How to clear it: list the comments for every key the command names, inline in the same call, then
re-send. An empty list satisfies it — the condition is having looked. A payload handed over as `@file`
does not clear it: the key and the listing have to be one invocation.

Any `[A-Z]{2,6}-\d+` counts as a key, so a tracker with another prefix needs no configuration.

Not judged: what you write once you have read. A transcript that will not open stands the gate down.
