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

A third copy sits in `vi-natural`'s gateway client, and this change leaves it alone. Not because an
import could not reach the home — it could, and nothing enforces a boundary there. It is left
because that is the repository's other CLI, with its own document and its own configuration, and
because its reader is a *different* reader: it trims a line before testing the field and parses each
line on its own, so the shared form cannot serve it and only the constant could travel. Its typed
width is a real instance of this rule and is filed as its own issue rather than answered here. The
rule asks a run either to widen the guard to the new home's tree or to write down why it should not
reach there; this is the writing down, and it also sits beside the scan itself, where the next run
widening it will read it.

The guard's needle is the typed width and not the field name. `startsWith("data:")` would also fire
on a module testing a `data:` URI, and the refusal would send it to a frame reader it has no use
for — a refusal a developer cannot act on. What that leaves uncaught is a copy that spells the field
and derives the width from it, which carries no count and is not the drift the pair was filed for.
