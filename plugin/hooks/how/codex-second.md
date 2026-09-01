# codex-second — the second opinion actually happens

Why: a commit landed after an hour of hook changes with the advisor consulted four times and codex not
once. The end-of-turn reminder is context, and an agent can ignore it.

How to clear it: one consult — `--diff --only blocker,major`, with an intent saying what you were
doing and what the advisor said — then re-send. One consult clears the turn; `FORGE_CODEX_DISABLE=1`
the session.

It arms when the call writes (`forge hooks --how writes`), the advisor spoke this turn, no consult has spent that advice, and
something in the tree has an mtime newer than the last consult. So it stands down on a clean tree, on
dirt already consulted on, on deletion-only dirt — a deleted file has no mtime — and on a target
outside the repository root.

It decides once per advisor call, not per write, so work built after a stand-down is reviewed at the
next turn's first write rather than half-built.

The advisor's record reaches the transcript eleven seconds late, so a write sent in the same breath
can be refused for advice that has arrived. Re-send it.

Not judged: what the consult says, or whether you take any of it.
