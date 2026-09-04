# codex — the log

**The log is the session.** There is no session id, so a consult opens with this repository's last
three answered ones and their verdicts. Findings are numbered `F1…` across angles and a verdict names
them — `--accepted F1,F3 --rejected F2=why`, never a count: 185 accepted to 14 rejected was the count
form saying nothing. What is replayed is the findings, the rulings and what became of each, not the
prose: the gateway reported no cache creation in 108 consults, so every replayed character was paid for
on every call. A recheck's REFUTED rulings record themselves as the verdict on the consult they judged
(CONFIRMED stays open), a verdict lands by default on the last consult that made findings and heard
nothing, and `--of` names another. The commit gate waits on both, and its how document carries the
counts. Usage is summed over a consult's calls; logged from the
last call alone, `log --score` counted a third of the input. A `started` entry is written before the call, because a consult
that dies mid-flight reaches no handler and a review that vanished is what an eval most wants to see.
Each entry carries the commit, a per-file sha256 and whether the file was clipped: advice that cannot
be tied to bytes cannot be checked.

**It is a file on disk, and `forge codex log` prints it back into a session.** So every string in a
record is masked at the write, at every depth, by the same seat the refusal log reads: a second set of
patterns is the one that misses the level the first set learned about. It does not take that log's
220-character clip with it — a reply is the eval set this log is kept for. Over-masking is the
direction chosen, so a review's own prose about a credential comes back with `***` in it, and the
masking runs on each value rather than over the finished line: a mask reaching to the next space would
eat a closing quote and leave an entry nothing can parse.

That mask reaches nothing written before it, and the log is append-only, so the printer masks again
over the entries it is about to print. The seat is the print and not the read: masking a 2,248-entry
log costs 377ms against the 23ms it takes to parse one, and the hook path parses it on every consult.
A line's counts are taken from the stored entry rather than the masked copy, because a mask shortens
a reply and an eval number that moved is a wrong one. The two ends answer different questions — what
accumulates on disk from here, and what reaches a transcript now — and neither makes the other
redundant.

What is deliberately not done is a pass that rewrites the file. Counted on the machine that raised
it, no on-sight credential shape matches any entry at all: only the two *named* patterns fire, on 42
entries of prose about credentials. So a rewrite would remove nothing and would destroy text in an
append-only eval set nothing backs up, on a file already at 0600 in the config directory. The residue
stays, and every route that prints an entry back to the caller is masked (ISS-266). What a consult
replays into its *next request* is a separate question with a different reason on each side, and
ISS-268 holds it rather than this paragraph.

**A harness with no numbers on itself is tuned by memory.** `forge codex stats` reads a window —
`--last n`, `--days n`, `--root p` or `--here` — and answers the questions a change to the harness is
judged by: how many consults ended at the budget they were given, how many replies said they could not
check, how many were retried at the ceiling, how many rechecks raised something New, the tokens by
kind, and which prompt versions ran. A row written before a field existed is counted from its own
reply, using the same predicate the field is written with, so the window before a change and the window
after it are read the same way rather than one of them looking clean for want of a column.

**A prompt is versioned because "it seems better" is not a comparison.** Every consult records the
system prompt's version and the digest of the text actually sent, so an edit nobody bumped for still
shows. `forge codex replay --prompt <file>` is the other half, and it is honest about how little of it
there is: the log keeps each sent file's sha256 and never its bytes, so a consult can only be rebuilt
where `git show <head>:<path>` still produces bytes that hash to what was sent. A consult is run on a
dirty tree by nature, so most cannot — over the last thirty, two rebuild. The verb prints the window,
what it kept, and what it lost with the reason, rather than replaying approximately and calling the
comparison a measurement. Storing the prompt whole would make it exact at roughly 140 KB a consult,
which is the trade the log does not take.

What counts as a document is `codex.pathRe`, `^docs/.*\.md$` by default, because prose is what nothing
else here checks — and a document written by a heredoc is a document. The turn is keyed by canonical git
root, one state file for every checkout, and a consult clears only the files it was given: one recorded
while the call was in flight survives it.

**Scoped to the working tree, the commit gate was a function of other people's work.** In a checkout
shared with another session, a three-file commit was refused five times over with a list of 726 paths
to review, 243 of them that session's uncommitted files; past five hundred status rows the walk stops
measuring and answers *changed now*, so no number of consults could ever spend it. What a commit closes
over is its index, plus whatever `-a` and a pathspec add, and that crossed with this root's unread
record is the whole of what is asked for — computed once, so the verb that prints the list and the gate
that compares it cannot drift apart. The 726 became one.

**A count standing in for a timestamp is never spent.** ISS-70 bounded the commit and left the other
half of that same cap arming itself forever: five consults, four verdicts and every finding ruled on,
and 727 dirty paths still said *changed now*, listing another agent's uncommitted files as work to go
and read. Above the cap the demand is now bounded by this root's unread record, so what a refusal
names is what consulting it clears, and where nothing is recorded nothing is owed. Two prices, both
taken deliberately. The record is the root's and carries no session dimension, so a co-tenant's
recordable file can still be demanded of you — satisfiably, which is the whole of the change. And what
it holds is what `codex.pathRe` matches, so above the cap a write outside that pattern is not asked
about at all; the commit carrying it still is, from its own index, which is where the pattern does not
reach.

**A kill switch nobody in the session can throw is not one.** `FORGE_CODEX_DISABLE=1` stays, for a
configuration too broken to read a switch out of, but it answers from the environment a hook process
was started in, which an agent inside that session cannot reach; written as a prefix on the refused
command it changed nothing, and the refusal read as offering a way out. `forge hooks --off codex-second` is what the refusals name now,
and the log says which gate is down.
