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
