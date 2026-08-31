# codex-second — the second opinion happens

`codex-order` puts the two opinions in order and `advisor-first` makes the free one happen. Neither
makes the *second* one happen, and it did not: a commit landed, then an hour of hook changes, with
the advisor consulted four times and codex not once. The end-of-turn reminder is `additionalContext`
— an agent can ignore it, and did.

**Where it fires was the user's choice, and the alternatives were measured.** Claude Code 2.1.251
offers `PreToolUse`, `PostToolUse`, `Notification`, `Stop`, `SubagentStop`, `SessionStart`,
`SessionEnd`, `UserPromptSubmit` and `PreCompact`. There is no advisor event: the advisor is a
server-side tool handled in the streaming path, so nothing local is dispatched and no `PostToolUse`
follows it. `Stop` was tried twice — printing, which reached nobody, then blocking, which stopped a
turn whose only change was the hooks' own documentation — and removed. What is left is the write itself, which is
where the user asked for it: a `PreToolUse` on a write *that follows an advisor call*.

So the condition is four facts, all cheap: the call writes, the advisor has spoken this turn, no
consult has spent that advice, and `git status --porcelain` is non-empty. The last one matters — a
clean tree gives codex nothing to read, and a rule enforced where it cannot be satisfied usefully is
the kind that gets switched off. Before the advisor speaks this is `advisor-first`'s refusal to make,
not this gate's; two walls arguing over one write is the same failure.

**It decides once per advisor call, not once per write** — and that is a rule change codex named
before it shipped. Standing down when nothing dirty postdates the last consult stops the gate
demanding a review of bytes codex just cleared; alone, it also means the write it allows creates new
dirt, so the *second* write of a turn gets refused and the consult it demands reviews a fragment. So
the decision is stamped: a stand-down is remembered for that advisor call, a refusal is not, and a
new advisor call re-arms the question. The cost, accepted deliberately: work built after a stand-down
is not reviewed in that turn. It is reviewed at the first write of the next turn, when it is finished
rather than half-built. A deletion has no mtime and slips through; a turn that only deletes is not
what this is for.

One consult clears the turn, because the same spend accounting `codex-order` uses says the advice is
answered. `FORGE_CODEX_DISABLE=1` clears the session, and `CLAUDE_CODE_DISABLE_ADVISOR_TOOL=1` stands
it down too — with no advisor there is no first opinion for this to be second to.

The price is stated rather than hidden: a turn that takes advice and touches a dirty tree pays one
consult, around 30–60 seconds, before its first write lands. That is the trade the user asked for
twice — "not relax but forget to run" — after watching the reminder be ignored.

**The write has to be in the tree codex would read.** The root comes from the session's working
directory and the target was never consulted, so a memory file written under `~/.claude/projects/`
demanded a review of a repository that write was not part of. A target resolving outside the root
now stands the gate down — and that stand-down is not stamped: it is a fact about one write, not a
decision about this advice, and stamping it would let one stray write clear the turn.
