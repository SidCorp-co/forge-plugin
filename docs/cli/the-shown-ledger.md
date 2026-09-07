# The shown ledger

One store answers a single question for every surface that talks to a session: has this session been
shown this text before? A gate refusing a write, a hint after an edit and the line a record write
ends with all had their own answer to it, and three answers to one question drift the first time one
is corrected.

**The key is the session, the surface and the text — never the occasion.** A surface is what is
speaking: an issue's thread, `codex-turn`, a policy gate's name. The text is keyed by its own digest
rather than by a counter, so a paragraph that changed is owed again and one that did not is not.
Nothing counts firings, because a count answers *how often* when the question is *what has this
session already read*.

**A credit follows the printing and never leads it.** The reader is the delivery, so a text credited
before it reached anyone is a delivery that silently went missing; every surface therefore asks what
is owed, prints, and credits after. This is why the ask and the credit are two calls and not one
convenience.

**A session is whoever holds the id, and a subagent owes one of its own.** An id a run was handed
outranks the one a hook event carries, so delegated runs under one exported `CLAUDE_CODE_SESSION_ID`
share a ledger and pay a delivery once between them. That is a cost and not the other correct shape:
the shared id names a wave rather than a run, so the second agent is told a thing was already shown
to it when it was shown to a sibling, and what it gets back is the route to the reason instead of
the reason. `forge hooks --how` still carries the whole of it, which is what bounds the cost, and
the route out is the resolver's own — give each dispatched run its own `FORGE_SESSION_ID` and its
credits are its alone. This store keys on the string it is given and decides nothing about which
string that is.

## What a repeat costs, by surface

| Surface | First time | Repeat | Reading |
| --- | --- | --- | --- |
| a refusal a session must act on | the paragraph | one line naming the route to the reason | ever shown |
| a line reporting what is owed next | the whole of it | nothing | shown last |
| a hint that a document wants a second reader | the whole of it | the whole of it | credited only |

A refusal repeats as a line and never as nothing, because the call is still being refused and a
session shown nothing cannot tell a block from a pass. That line still reads as a refusal and names
`forge hooks --how <topic>`, which is where the reason, what the rule does not judge, and the escape
live. Nothing about the particular call is lost with the paragraph: a rule's cause, its *Instead* and
its topic belong to the rule, not to the command that tripped it.

**Two readings of "already shown", and the surface picks one.** *Ever shown* asks whether this text
was delivered at any point in the session, which is what a refusal wants: a paragraph read once has
been read. *Shown last* asks only whether this text was the one said at the previous write, which is
what a report of what-is-owed wants: a ladder that moved and came back is news again, because what a
session was told last is what it is acting on. Under the first reading that second reading is
unavailable, so the journal moves an item to the end when it is credited again, and the last item on
a surface is the last thing said on it.

The delta is per line, and belongs to the first reading. A text is credited both whole and line by
line, so a paragraph that grew by a sentence owes the sentence, not the paragraph again. Where no
line of a text was ever shown, the whole of it is owed — a delta equal to the text is the text.

## The surface that is credited and never held

The `codex-turn` hint asks for a second model to read what a turn changed. It is written into the
ledger and read back by nothing, which is deliberate rather than an omission. Its text names only
the file, so the same sentence is owed twice for good reason: once a consult has read that document
and it changes again, the ask is owed afresh, and a session held to one delivery would never be told
— then the commit gate would refuse the commit having never warned. What holds it to once per turn is
the stamp under `TMPDIR`, which is a different question (see below). What the credit buys is that one
reading of "shown" answers across every surface, a delegated run's included.

The same caution applies anywhere the text of a message is narrower than the occasion that owes it.
Keying on the text is only safe where the text is the whole of what the surface has to say.

## Why it is a journal and not a file that gets rewritten

Two processes of one session write this store at once, routinely: a single command can make four
tracker writes, and the gates fire in parallel with the verb they guard. A credit is therefore an
*append*, and a read is the fold of every appended line over the last folded state. Two appends lose
neither line, where two processes each rebuilding one file leave only the later's, and no lock closes
that window (ISS-661).

The fold rotates the journal aside before it reads it, which is what makes the append safe to
confirm: an appender that still sees its own inode under the journal's name knows no fold has taken
its line yet. A rotation that happens anyway is caught by the inode check or by the link count, and
the line is written again — items are a set, so twice is once. A fold that fails leaves its aside in
place and is simply owed again, so nothing unread is dropped.

It is bounded by what it keeps and how stale, never by a count of sessions: evicting a live run costs
it every delivery over again.

## What this store is not

It is not the hook stamps. `src/hooks/stamps.mjs` answers *did a gate already ask about this path*,
lives in `TMPDIR`, and is a session's memory of its own questions; this ledger answers *was this text
delivered*, lives in the config directory beside the credential, and is keyed by content. Four gates
hold both, which is worth revisiting when something forces it, and is not a merge either of them
needs today.
