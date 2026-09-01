# codex-second — the second opinion happens

`codex-order` orders the two opinions; nothing made the *second* one happen. A commit landed, then an
hour of hook changes, with the advisor consulted four times and codex not once — the end-of-turn
reminder is `additionalContext`, which an agent can ignore, and did.

The free opinion is not walled off. A gate demanding the built-in advisor was removed at the user's
instruction: the system prompt already asks for that call, so the hook charged a refused write per
turn to enforce an instruction already there. This asks for what no prompt asks for — a reading by
another provider — and arms on the advisor call rather than demanding it. No advisor event exists to
hook, and `Stop` was tried twice: printing reached nobody, blocking stopped a turn whose only change
was documentation. What is left is the write.

Four cheap facts: the call writes (`forge hooks --why writes`), the advisor has spoken this turn, no
consult has spent that advice, and `git status --porcelain` is non-empty. The last matters — a clean
tree gives codex nothing to read, and a rule enforced where it cannot be satisfied gets switched off.
A target resolving outside the root stands the gate down, since the root is only the session's working
directory and a memory file elsewhere is not what codex would read.

**It decides once per advisor call, not once per write** — codex named that before it shipped.
Otherwise the write it allows creates new dirt, so the *second* write is refused and the consult it
demands reviews a fragment. A stand-down is stamped, a refusal is not. Accepted cost: work built after
a stand-down is reviewed at the next turn's first write, finished rather than half-built. A deletion
has no mtime and slips through.

One consult clears the turn; `FORGE_CODEX_DISABLE=1` the session. The price, stated rather than
hidden: a turn that takes advice and touches a dirty tree pays one consult before its first write.

**The advisor's record reaches the transcript a round-trip late, past a hook's timeout.** Measured:
generated 12:18:11, write dispatched 12:18:14, refused 12:18:15, file written **12:18:26**. No waiting
inside a hook reaches it — a `settle()` that re-read for a second never caught the case and cost every
honest refusal a second.
