# codex-second — the second opinion actually happens

Why: nothing made it happen. A commit landed after an hour of hook changes with the advisor consulted
four times and codex not once, because the end-of-turn reminder is context an agent can ignore, and
did.

How to clear it: run one consult — an intent saying what you were doing and what the advisor said,
`--diff --only blocker,major` — weigh what comes back, then re-send the write. One consult clears the
rest of the turn. `FORGE_CODEX_DISABLE=1` clears the session.

It arms on four cheap facts: the call writes (`forge hooks --how writes`), the advisor has spoken this
turn, no consult has spent that advice, and the tree is dirty. A clean tree gives codex nothing to
read, so it stands down rather than demanding a review of nothing.

It decides once per advisor call, not once per write: otherwise the write it allows makes new dirt and
the second write is refused over a fragment. So work built after a stand-down is reviewed at the next
turn's first write, finished rather than half-built.

The advisor's record reaches the transcript a round-trip late — measured at eleven seconds. A write
dispatched in the same breath as the advice can therefore be refused for advice that has arrived;
re-send it.

**Not judged:** what the consult says, or whether you take any of it.
