# issue-read-first — the write delivers the comments it owes

Why: `forge issue ISS-nn --full` returns no comments at all. The body says what was asked; the
comments say the state now.

How to clear it: re-send the command. The refusal carries every comment on the issue this session
has not been shown, the reader walking the thread to its end; one it cannot walk holds the write
once, then says how far it got on every write. An issue with no comments refuses nothing, and this
CLI says so in one line.

How to work through it: what a session has been shown is remembered per issue, so later writes pass
in silence until a comment nobody here has seen appears — a person's, or the audit line a merged
mark leaves. It is not kept forever: your comment budget sheds what you touched longest ago, and a
run that stops writing for a day is forgotten. A record through this CLI never refuses you. A run
that names itself owes its own delivery, not yours: the name is read off the command judged.

Not judged: what you write once you have read, whether you read it, or a mention of a write verb —
the target is the argument the verb takes, so one in a heredoc, a path or prose is not one.
Silent with no endpoint configured, on a tracker that will not answer, and outside a project.
