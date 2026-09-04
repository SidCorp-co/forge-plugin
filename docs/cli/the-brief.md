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

That split has a second consequence worth stating, because it is the one that makes the digest
worth anything: `--refresh` takes the body and stamps the digests **in the same call**, so no
sequence of commands freshens a hash without a body passing through the caller's hands. A flag that
only re-stamped would have written the exact silent staleness the `stale:` line exists to prevent,
in a form the next run trusts.

**The edge, since a review pressed on it and the claim was too wide.** This does not prove the body
was *corrected*: a caller can save what `forge project` just printed and hand the same bytes back,
and the digests go fresh over prose nothing changed. Nothing here can tell those bytes from
corrected ones, and a mechanism that could would have to diff prose against files it cannot read
the meaning of. What the coupling buys is that the freshening is never a side effect of some other
command — it is one act, with a body in it, done by whoever decided the brief was right.

The generic writer is closed against the same hole rather than left to the caller's care: `forge
knowledge write project-brief` is refused, naming this verb, because that route replaces the body
and carries forward the digests of the body it replaced.

**A brief this CLI cannot judge is a brief it does not label.** Kind, injection and slug are fixed
here because the entry has one job; `--confidence` is the caller's, because whether every line was
read off a statement or some off a convention is a reading, not a shape.

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
it wants an extension it knows, and a bare filename only inside a code span or a link. A tail naming
`Makefile`, or `CLAUDE.md` with no span around it, is not a source and is not hashed. Writing a
second parser for the tail was refused — "what is a cited path" would then have two definitions and
they would drift — and the same-call answer covers it instead: `--refresh` prints the sources it
hashed, so a file the writer meant and the reader did not see is missing from a list they are
looking at.

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
as a refusal quoted whole.
