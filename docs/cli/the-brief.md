# the project's brief

## The brief, and the one thing the CLI refuses to generate

*Why does `--refresh` take the answer it is supposed to produce?*

Measured 2026-09-04 across fifty-two delegated runs in two projects: a median of three to four
minutes and sixteen to twenty-four tool calls before the first claim, four to five per cent of a
run, and the same six sources read in nearly every one. The answers do not change between runs; the
reading does not get shorter. So the brief is stored once — one `forge_knowledge` entry, slug
`project-brief`, kind `overview`, injection `always` so a runner-driven session carries it without
a call — and this verb serves it beside the branches it already served.

The obvious shape was a flag that regenerates the brief's fields from the sources. **No program
reads "what is dangerous and fails silently" out of a README**, and the ones a program could
extract are the ones a run least needs. So the halves are split: the run owns the prose, the CLI
owns the arithmetic that says whether the files it was read from have moved.

**What stamping the digests beside the body does and does not buy.** `--refresh` takes the body and
stamps the digests in the same call, and the first reading of that coupling claimed too much: it
does not prove the body was *corrected*. A caller can save what `forge project` just printed and
hand the same bytes back, and the digests go fresh over prose nothing changed. Nothing here can tell
those bytes from corrected ones, and a mechanism that could would have to diff prose against files
it cannot read the meaning of. What the coupling buys is narrower and still worth having: a
freshening is never a *side effect* of some other command. It is one deliberate act, naming what it
covers, by whoever decided the brief was right — which is the property the next section keeps while
dropping the whole body from the call.

The generic writer is closed against the same hole rather than left to the caller's care: `forge
knowledge write project-brief` is refused, naming this verb, because that route replaces the body
and carries forward the digests of the body it replaced.

**A brief this CLI cannot judge is a brief it does not label.** Kind, injection and slug are fixed
here because the entry has one job; `--confidence` is the caller's, because whether every line was
read off a statement or some off a convention is a reading, not a shape.

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

## Which files a digest covers, and why not the ones you would list first

*What is a source of the brief?*

The obvious answer — the rules file, the readme, the manifest, the gate script — knows only the
ecosystems whoever wrote the list had met, and this repository refuses a checker that hard-codes
its cases for exactly that reason. The other obvious answer, every path the brief cites, over-fires:
a brief maps the tree, so hashing `plugin/src/tracker/rpc.mjs` would call the brief stale on any
release that touched a module, and a stale line that is always on is read as noise within two runs.

So a source is **what a line names as its own** — the tail after the line's `←`, run through the
same reader that checks a document's cited paths resolve, and resolved against the project root. A
line with no source contributes no digest, which is the brief's own rule arriving as a mechanism: a
line nobody can check is a line nobody should trust.

That reader's grammar is the contract, and it is narrower than "anything that looks like a file":
it wants an extension it knows, and a bare filename only inside a code span. A tail naming
`Makefile` is not a source and is not hashed. Writing a second parser for the tail was refused —
"what is a cited path" would then have two definitions in one repository and they would drift.

**So the omission is said rather than absorbed.** A review pressed twice on this, and printing only
what *was* hashed was not enough: a writer reading a list of eight has no way to know they meant
nine. `--refresh` therefore also names every code span sitting in a source position that the reader
took nothing from — *not hashed: `forge doctor`, `Makefile`*. It is a listing and not a refusal,
because a command's output is a legitimate source and is not a file; what it removes is the silence.
Every span in a source position now leaves the call either with a digest or on that line.

**A source the checkout does not hold is kept, not dropped.** Dropping it was the first shape and it
reached no reader at all: a brief naming one file that is not here would have reported as a brief
naming no sources. So it is stored unresolved, printed at the write as *named and not here*, and
read back as **gone** until it appears.

`docs/cli/knowledge.md` declined to resolve a cited path against the working directory, and this is
not a reversal of that: an *entry* may be written from a repository this checkout cannot see, but
the brief is this project's, read inside the checkout `.forge.json` already pins. A source that
does not resolve is reported as **gone** rather than refused, because a checkout that dropped a
file the brief was read from is exactly the thing worth saying.

**A manifest is a poor source and the brief here names none.** Its version line moves on every
release, so a brief citing it reports stale every release for a reason that never changed an
answer. Cite the file that *states* the thing — the rules file for the gate command, the script's
own help for the steps around a change.

## The read that is not an absence

A store that refuses a read is not a store with no brief. Printing the first as the second sends
the next run down the write path with a brief it never saw, which is the same clobber
`forge knowledge write` guards against and the reason both readers share one seat. The verb prints
the tracker's own not-found as *none stored*, with the command that writes one, and anything else
as a refusal quoted whole. A narrow write reads through the same seat and stops on both: there is
no line to confirm in a brief that is not there, and none in one this call could not read.
