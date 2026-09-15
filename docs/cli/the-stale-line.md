# the narrow writes to the brief

## Fixing one stale line without rewriting the other fifty

*Why is there a flag that only re-stamps, when the whole-body form exists?*

Because rewriting fifty lines to fix the one whose source moved is a whole-file write to a store
with no revision — the shape a run declines to make while another session may be reading the brief,
and on 2026-09-05 two of them did. The brief then stays stale, and the first thing the next Phase 0
reads is a line telling it to do the work by hand. A route nobody takes is not a route.

What the section above says has to hold is that a freshening is deliberate and names what it covers.
Both narrow writes are:

- `--confirm <source>` is the caller saying the lines naming that source were read against the file
  as it now is and their prose still holds. The body goes back byte for byte, one digest is
  re-stamped, and the lines it just vouched for are printed. It is the common case: the file moved
  and the fact did not.
- `--line <n> <text>` replaces one line's prose, for where the fact did move.

**A digest is keyed by path and not by line, and that is what decides the second flag.** Two lines
of a brief often read the same file. Stamping that path because one of them was rewritten would
clear the other line's staleness over prose nobody looked at — the exact silence the `stale:` line
exists to break. So `--line` stamps a source only where the rewritten line is that source's *only*
reader, and where it is not, it names the lines that keep it stale and the `--confirm` that closes
it once those have been judged too. The two flags compose; neither alone can lie about the other's
lines.

The alternative — stamp always, list the other lines as a courtesy — was refused for the reason the
`not hashed:` listing exists at all: a listing beside a write nobody can undo is not the same as not
making it.

## Why a line number is not enough to aim a write with

*Why does `--line` make the caller retype the line it is replacing?*

Because the number is obtained from a printed view and no printed view counts what the flag counts.
The store's own read puts nine rows over the body; this verb's brief block puts three to six and a
blank, and that block sits eighty lines down a full report. A caller who greps one of those and
spends the number here lands on some other line, and there is nothing behind the write: the entry
has no revision and no conditional write, so the repair is retyping the lost prose out of a
scrollback the next session has not got. It happened twice, both times recovered only because the
`line n was:` echo was still on the screen.

So the number stopped being the only thing the write is aimed by. `--was` is the prose the replaced
line begins with, checked against the stored body before anything is sent — the precondition the
tracker's own update already rides beside a write, where the caller says what they believe is there
and a write over anything else is refused with what is actually there. It is a prefix because the
caller retypes it, and it has to open **exactly one** line: a prefix two lines share cannot tell the
line meant from the line about to be lost, so an ambiguous one is refused asking for more of the
line rather than resolved in the caller's favour.

The other half is the view. The body prints with its own numbers down the margin, so the numbering
the caller reads and the numbering the flag counts are the same one, and the offset this document
would otherwise have to state does not exist to be stated — it is a different number in each view,
and a constant written down here would be wrong in two of them.

**A narrow write carries nothing a body carries.** `--title`, `--confidence` and `--meta` are
refused beside `--confirm` and `--line` rather than ignored, and the stored entry's own are carried
forward. Three routes to one entry, and a call takes one, because a call that quietly preferred a
route would report success about a write nobody asked for.

**The window a review found, and why it is made loud rather than closed.** Every route here reads
the entry, decides, and writes the whole entry back: the store takes no conditional write.
`--refresh` at least has a caller who just looked at what they replace. A narrow write does not — it
would restore prose another session put there while this one was deciding and report that it changed
nothing, which is worse than the staleness it set out to fix. So it reads once more immediately
before writing and refuses if the body or the digests moved. Nothing here can make the write atomic;
this turns a silent overwrite into a refusal naming the read to redo.
