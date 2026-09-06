# codex — the finding

What one finding has to carry before it is worth the round it costs, and where the two boundaries a
reviewer cannot see for itself come from. What travels in the request: [the
consult](codex-the-consult.md). What the log then reads back off a reply, and what a commit gate
demands of it: [the log](codex-the-log.md).

**A finding the reader has to finish is a round.** Prompt v2 asked for an anchor, a quotation and a
severity, and left the reader to derive the failing case, the smallest fix and what would prove it —
which is the derivation a round is spent on. From v3 a finding is not made unless it carries five
clauses: the anchor and quoted line, **Fails when**, **Fix**, **Proven by**, and either **Read**
naming the tool call that grounded it or the bare word **Inferred**. That last one exists because a
model that inspected and a model that guessed write the same confident sentence otherwise — a hand
eval over five landed diffs had one arm assert an inspection it never made, and nothing in the
prompt made the two distinguishable. Clauses two to five are indented under the bullet, which is
what lets `numbered()` keep them with the finding while the bullet alone stays the thing that places
it: the anchor a file filter reads and the New-or-Still-open a recheck counts are the bullet's, and a
`Fix` clause naming a second file is not a claim about where the finding lives. A recheck is the one
pass that does not owe the five: it answers findings it already made, and only **Read** or
**Inferred** on a genuinely new one is something the earlier round could not have supplied.

**Where the issue ends and what the gate already refuses are the caller's to say.** Of 149 dropped
findings on the live log, 56 were real and outside the issue — each costing a verdict round and a
filing — and 16 were something a checker or a test already holds. Neither is a model error: the
reviewer was never told the issue's scope or which checks run. `--out-of-scope` and `--checks` are
where those two go, and they are *copied* rather than composed — the first from the issue's own Out
of scope text, the second from `codex.check` in `.forge.json`, which is also the fallback when the
flag is absent. A scope this end invented would move the boundary the reviewer is judged against,
and a check list written from memory is one the gate contradicts. Neither section appears when
nothing was given, so a caller who filled neither asks the reviewer for nothing it cannot see. A real
finding falling inside the scope text comes back under one closing `OUT OF SCOPE` heading,
unnumbered and unqualified by severity, and those lines are not counted in the findings line —
counting them would put back the number the heading exists to take out — so the section may follow
`CODEX: 0 findings`, which is the case where everything real the reviewer saw was out of scope. It
does not compete with `PRE-EXISTING`: a finding true of the code before this turn is pre-existing
whatever the scope says, and two closing headings claiming one finding is what a reader cannot act
on.

**A prompt change is verified by running it, and the verb in front of the switch answers on part of
a window rather than on all of it.** `forge codex replay --prompt <file>` rebuilds a past consult's
payload wherever git provably holds it and refuses every row it cannot prove, so its share is a real
sample and never the whole window: what it cannot reach is a file dirty at every commit, whose text
the log holds no copy of by design (`cli/codex-the-replay.md`). So a prompt switch still stands on that
sample, on the first live run of the new prompt read by hand, and on `forge codex eval` a hundred
consults later; the replay's figures are read for the share they are rather than treated as a score.
