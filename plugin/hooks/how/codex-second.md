# codex-second — the second opinion actually happens, and is answered

Why: a commit landed after an hour of hook changes with the advisor consulted four times and codex not
once; later, 37 consults whose findings nobody ruled on, and 7 of 30 commits with the turn's documents
unread. A reminder is context, and an agent can ignore it.

How to clear it: one consult — `--diff --only blocker,major`, with an intent saying what you were
doing and what the advisor said — then re-send. One consult clears the turn's writes. For findings
nobody ruled on, `forge codex verdict --of <id> --accepted F1 --rejected F2=why`; a `--recheck` records
that for what it refutes. `forge codex pending --drop` discards unread documents.
`FORGE_CODEX_DISABLE=1` the session.

It arms on a write when the advisor spoke this turn, the advice is unspent and the tree holds work newer
than the last consult. A commit is asked for the same, and also, advisor or not, for documents this tree
recorded and never consulted on, and for the last consult here that made findings and heard no verdict.

The advisor's record reaches the transcript seconds late, so a write sent in the same breath is
refused for advice that has arrived. Re-send it.

Not judged: what the consult says, whether you take it, or a verdict's honesty.
