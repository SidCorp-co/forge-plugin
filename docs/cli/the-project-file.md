# the project's own file, written one key at a time

The third resource `forge doctor --set` writes: the `.forge.json` a checkout resolves, whose keys this
plugin declares rather than discovers. [doctor](doctor.md) carries the rest of that report, and
README's Configuration section carries what each key decides.

## Declared, so the route holds where the tracker does not

Every key this plugin reads out of that file is known before any call goes out, so a bare one of them
routes there and no tracker resource is read for it. That is the only way a slug reaches a checkout
that has not got one yet — the read that would route it needs the very value it is being asked to
write — and it is why the route holds while the tracker is down or has retired a resource beside it. A
tracker fact carrying the same bare name is reached by `fact.<k>`.

A key nothing here reads is refused with the list of what the file holds, and is offered no
`project.<k>` route at all: a value written under it would be a line in somebody's committed file that
nothing ever looks at, and a refusal naming a route that cannot work is a refusal recommending a
second one. The suite holds that list to the keys the code reads, in both directions, so a key added
to one side and not the other fails rather than drifting. `flow` is refused with `forge doctor --flow
<slug>`, which writes it together with everything that flow asks the project for.

## One key's span, and the diff that proves it

The file is committed and read by every session, so a document re-serialized from its parse turns a
one-key change into a diff nobody can review: an inline array reflowed across eight lines, a key order
rewritten, seventy insertions standing in for one value. What is written is therefore the one key's
span in the file's own text. A table on the way to that key is created holding the key alone, nothing
beside it gains a default, and a document whose span this cannot find is refused rather than rewritten
whole — that once, the key is set by hand.

The value is then read back **off the disk** rather than off the text the call composed. A file
declaring one key twice parses to the last of them, so an edit to the first would report set a value
nothing reads; the bytes go back and the refusal says which.

## Judged by the reader that already reads it

A value hand-edited is a value nothing checked until the call that happens to read it, which is the
whole reason this route exists. So the judgement is not restated here: the candidate the write would
leave is handed to whichever reader reads that key, and what comes back is the sentence that reader
would have printed anyway. A `review.lines` that is not a whole number above zero, a `rank` weight
naming no row of its table, a `jobs` entry that is neither a list of verbs nor a table of them, a
`lease.workingRe` that will not compile: each is refused in its own words, before a byte is written.

One judgement had to be reached for rather than borrowed. The reader of `codex.checkMs` answers
nothing at all until `codex.check` is a string, so a budget written on its own was judged by nobody
until a command arrived beside it; that budget is now its own reading, which both the reader and this
write take.

A command-line word becomes JSON by what the key takes — a whole number, a comma-separated list,
`null`, a command, or text — and a word that is not the shape it was asked for is passed through as
typed, so the key's own reader is what says so rather than a coercion inventing a second answer. No key
of this file takes a boolean, so `true` is the word `true`, which is a command a shell runs and a
project may well declare as its test. A command is the word as typed until a comma makes it several,
because the reader of a stats command takes one or a list of alternatives and this route has to be
able to write either; a single command carrying a comma is therefore split, which the value read back
and printed is what shows.
