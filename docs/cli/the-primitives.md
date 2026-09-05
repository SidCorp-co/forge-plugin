# The primitives live in one module

Two verbs could not reach them and each grew its own copy; one lost the full-page guard on the way,
and a truncated dependency graph reported itself as complete. One list per process, not one per
reference: `dep <a> <b>` fetched the same 41 KB twice.

## The same choice again, for the markdown set

Five modules each kept a private copy of stripping a span, of recognising a table row or its
separator, and of reading a link target. None could reach another's, so a later run added one of
each without ever seeing the set, and it surfaced only in a review reading several runs at once
(ISS-101).

A primitive is a pattern source rather than a compiled object. Two copies of the link target
differed by one flag and nothing else: `matchAll` requires `g`, `exec` is unsafe with it, and a
shared object carries its position to whoever asks next. Leaving the flags to the reader is what
lets one declaration serve both.

Two measurements settled the margins. Any whitespace at both ends is impossible where a pattern is
compiled over a whole document at once — it consumes the line break and takes the next line's indent
with it, which is why the one copy compiled that way had already narrowed to a space and a tab.
Narrowing all three to a space and a tab was the plain reading and the wrong one: the CLAUDE.md
checker runs wherever this plugin is installed, a Windows checkout's line ending is live input, and
a table row closing on a carriage return would have stopped reading as one, with nothing here to
fail. Admitting the carriage return matches that row and leaves the document-wide form untouched. An
exotic space in a margin is the accepted loss.

The two separators disagreed about leading whitespace and the strict one lost, for a reason neither
copy had recorded: it also rejected a *trailing* space, so a docs index whose separator carried one
invisible character was told its table had no header at all. A refusal a reader cannot act on is
worth more than the indentation the two were arguing about.

## And again for the SSE frame, where the copy carried a number

The reader that pulls a payload out of a Server-Sent Events frame stood twice — once in the
tracker's transport, once in the reviewer's — as the same four calls in the same order, ending
`.slice(5).trim()`. Five is the width of `data:`, and neither site said so. A line written `data :`
is not the field at all and its payload is dropped whole; a field of any other length is cut at the
wrong offset. Either way the fix would have been applied to whichever transport happened to break,
and the other would have stayed wrong. Two providers were being read, but the framing is neither
provider's — it is the wire format, and there is one of it. So the width now comes from the field
name, and the name is declared once.

What did **not** move is the half that looked like it belonged with it. The reviewer's reader also
swallows the `[DONE]` sentinel and parses, answering `null` on either; the tracker's caller hands
the joined text to its own parse and stops with *unparseable body*. Sharing those two statements
would have changed what the tracker does with a malformed frame while the diff still read as a pure
move. A shared primitive stops where the provider's own reading of its stream begins.

**And the shared form is not the standard's**, which is the trap in giving a private idiom a public
name. The wire format strips one leading space from a value and joins several with a line feed; this
one trims each value whole and concatenates. That is what both transports have always done, so
matching the standard here would change two callers rather than fix one function — a consumer that
needs the specified answer is asking for a different function, and the test pins the divergence so
a later run reaching for compliance sees it is a behaviour change. The module says so at its head.

A third copy sat in `vi-natural`'s gateway client, and clearing it needed a rule nobody had written:
whether that CLI may import from `plugin/src/`. Nothing forbade it — the absence of an upward import
there had been read as a boundary, which is inferring one from a measurement. It may, downward only;
`README.md`'s Layout section carries the direction and what would reverse it. What crossed is the
constant. That reader is a *different* reader — it trims a line before testing the field and parses
each line off an incremental buffer — so `sseData` cannot serve it and was not asked to, and sharing
the value rather than the behaviour is what keeps the import from being a coupling. The guard's scan
is owed the widening to that tree and has not had it: the file is another run's, so the row is
posted there with its measurement.

The guard's needle is the typed width and not the field name. `startsWith("data:")` would also fire
on a module testing a `data:` URI, and the refusal would send it to a frame reader it has no use
for — a refusal a developer cannot act on. What that leaves uncaught is a copy that spells the field
and derives the width from it, which carries no count and is not the drift the pair was filed for.

## The tracker's fence, and why it lands in `flow/`

The wrapper the tracker returns a field inside is one wrapper, and it was declared twice — once
where a plan's declarations are read, once where a filing's shape is measured. Neither module sits
under the two directories the guard was scanning at the time, so nothing looked (ISS-256).

Its home is the flow module rather than the tracker module whose wrapper it is, which reads backwards
until the import graph is drawn. The flow module imports nothing, deliberately, so that either side
can reach it; the tracker module reaches it already, through the transport and the prose rewrite, and
is itself loaded by a gate on every tool call. The edge that keeps the graph acyclic runs from the
tracker to the flow, and the one the issue proposed would have closed a cycle. Where a primitive
lives is decided by which module can be imported without dragging a graph behind it, not by whose
subject matter it names.

## The help predicate, and the two readings that are not it

`wantsHelp` had been exported from `plugin/src/resolve/flags.mjs` and imported by four modules while
seven others wrote the same comparison by hand — the CLI's own entry sharpest of them, importing it
on one line and writing it out fifty lines above (ISS-259). Nothing would have failed if one had lost
`--help`, and this is the surface a caller reaches when it does *not* know the verb, so a spelling
that drifts on one side is a verb answering a question its siblings answer differently.

One of the seven was unreachable, and finding out which cost a wrong answer worth recording. The
entry answers `-h` itself for any verb that does not set `answersHelp`, and the mark is set beside
each verb's own export rather than in one table — so reading the table alone says three verbs carry
it and the tree says ten. Six of the seven sites are live on that count, and the eight commands the
issue named do judge them. The seventh, `cloudflare`, is unmarked: `helpOf` answers for it, and its
own `USAGE` — the fuller of the two, listing subcommands the verb row omits — is text nothing
reaches. That is a defect of its own and is filed as ISS-291, not answered here; what this change
owed it was conversion, since a verb given the mark later makes its own test live again.

The lesson is the guard's, not the verb's: a predicate whose answer is spelled in ten places is one
a reader will summarise from whichever place they found. Each site was proven neutral by reverting
that one file alone and re-running both the eight commands and a direct invocation of every exported
verb — seven reverts, no difference anywhere, and the guard naming the reverted file each time.

**The guard's exclusions are two paths, not a cleverer needle.** The codex verb reads a help flag in
*any* position, because the CLI hands a verb its tail and `forge codex consult -h` puts the flag
second; the gate that orders a consult reads one out of a shell command line somebody else typed.
Both spell the same two words as the seven did, so no needle over text distinguishes either from a
copy — and both ask a different question, so neither is one. Making the words a shared constant the
two could import would have unified the spelling at the cost of the distinction: the first-word
reading is the one with a home, and where a flag may stand is the caller's question, not the
predicate's. So the two are named beside the scan, with the reason, on the second of the two routes
the frame reader above was left alone by.

The needles are the comparison, `=== "-h"`, and the word pair a copy declaring a list would write
instead. Anything looser — the word `--help` alone — refuses the doctor spawning another program
with it and the CLAUDE.md checker reading `-h` out of a document, neither of which is asking this
question at all.
