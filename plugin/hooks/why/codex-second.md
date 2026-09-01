# codex-second — the second opinion happens

`codex-order` puts the two opinions in order. Neither it nor the prompt makes the *second* one
happen, and it did not: a commit landed, then an hour of hook changes, with the advisor consulted
four times and codex not once. The end-of-turn reminder is `additionalContext` — an agent can ignore
it, and did.

The free opinion is not walled off, deliberately. A gate that refused every write until the built-in
advisor had spoken was removed at the user's instruction: the system prompt already asks for that
call, so the hook charged a refused write per turn to enforce an instruction already there. This one
asks for what no prompt asks for — a reading by another provider — and arms itself on the advisor
call rather than demanding it. Before the advisor speaks, nothing here fires.

**Where it fires, after the alternatives were measured.** There is no advisor event: the advisor is a
server-side tool handled in the streaming path, so nothing local is dispatched and no `PostToolUse`
follows it. `Stop` was tried twice — printing, which reached nobody, then blocking, which stopped a
turn whose only change was documentation — and removed. What is left is the write, which is where the
user asked for it.

So the condition is four cheap facts: the call writes (`forge hooks --why writes`), the advisor has spoken this turn,
no consult has spent that advice, and `git status --porcelain` is non-empty. The last one matters — a
clean tree gives codex nothing to read, and a rule enforced where it cannot be satisfied usefully is
the kind that gets switched off.

**It decides once per advisor call, not once per write** — a rule change codex named before it
shipped. Standing down when nothing dirty postdates the last consult stops the gate demanding a
review of bytes codex just cleared; alone, that means the write it allows creates new dirt, so the
*second* write of a turn is refused and the consult it demands reviews a fragment. So a stand-down is
stamped and a refusal is not, and a new advisor call re-arms the question. The accepted cost: work
built after a stand-down is reviewed at the first write of the next turn, finished rather than
half-built. A deletion has no mtime and slips through.

**The write has to be in the tree codex would read.** The root comes from the session's working
directory, so a memory file under `~/.claude/projects/` once demanded a review of a repository that
write was not part of. A target resolving outside the root stands the gate down, and that stand-down
is not stamped: it is a fact about one write, not a decision about this advice.

One consult clears the turn. `FORGE_CODEX_DISABLE=1` clears the session, and
`CLAUDE_CODE_DISABLE_ADVISOR_TOOL=1` stands it down too. The price, stated rather than hidden: a turn
that takes advice and touches a dirty tree pays one consult before its first write lands. That is the
trade the user asked for twice — "not relax but forget to run" — after watching a reminder be ignored.

**The advisor's record reaches the transcript a round-trip late, past a hook's timeout.** Measured:
generated 12:18:11, write dispatched 12:18:14, refusal returned 12:18:15, file written **12:18:26**.
No amount of waiting inside a hook reaches it — a `settle()` that re-read for a second never caught
the case and cost every honest refusal a second. `codex-order` reads the same lagging record, which
is why its refusal names re-running the command rather than calling the advisor again.
