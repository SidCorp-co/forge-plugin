# codex-second — the second opinion actually happens

Why: a commit landed after an hour of hook changes with the advisor consulted four times and codex not
once. The end-of-turn reminder is context, and an agent can ignore it.

How to clear it: one consult — `--diff --only blocker,major`, with an intent saying what you were
doing and what the advisor said — then re-send. One consult clears the turn's writes;
`FORGE_CODEX_DISABLE=1` the session.

It arms when the advisor spoke this turn and the tree holds work newer than the last consult — on a
write (`forge hooks --how writes`), or on the commit that ends the draft. A write also needs the
advice unspent; the commit does not, because a consult spends the advice while work written after
it stays unread. A write outside the root is not this tree's work; a commit is judged by the tree it
names, whatever it redirects.

Asked at every write: decided once, it stayed decided on the tree the advisor left.

The advisor's record reaches the transcript seconds late, so a write sent in the same breath is
refused for advice that has arrived. Re-send it.

Not judged: what the consult says, whether you take it, or a turn the advisor never spoke in — a
second opinion needs a first, and a commit there is between you and `forge codex pending`.
