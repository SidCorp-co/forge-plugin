# codex-second — the second opinion actually happens

Why: nothing made it happen. A commit landed after an hour of hook changes with the advisor consulted
four times and codex not once — the end-of-turn reminder is context, and an agent can ignore it.

How to clear it: run one consult — `--diff --only blocker,major`, with an intent saying what you were
doing and what the advisor said — weigh what comes back, then re-send. One consult clears the turn;
`FORGE_CODEX_DISABLE=1` the session.

It arms on four cheap facts: the call writes (`forge hooks --how writes`), the advisor spoke this turn,
no consult has spent that advice, and something in the tree has an mtime newer than the last consult.
That last one is what a reviewer would read, so it stands down on a clean tree, on a change already
consulted on, and on dirt that is only deletions — a deleted file has no mtime. A target outside the
repository root stands it down too: the root is the session's working directory.

It decides once per advisor call, not per write: otherwise the write it allows makes new dirt and the
second is refused over a fragment. Work built after a stand-down is reviewed at the next turn's first
write, finished rather than half-built.

The advisor's record reaches the transcript a round-trip late — eleven seconds, measured. A write sent
in the same breath as the advice can be refused for advice that has arrived; re-send it.

Not judged: what the consult says, or whether you take any of it.
