# Clarifying, planning, and the release note

## Decide first; ask only when the wrong branch is expensive

Most choices are yours. Take the reading that is cheaper to reverse, write the assumption
into the plan with the sentence that would undo it, and carry on — an assumption recorded
where the next reader finds it costs less than a round trip, and it is correctable for as
long as nothing was built on it.

Ask when reversing would mean unpicking work rather than changing a value: a decision that
moves code between packages, fixes a wire format, or sets what other decisions are made
against. A number in a config file is not one of those; a package boundary is.

## How to ask, when you must

Not a paragraph asking what they meant. **Enumerate the readings as concrete cases with the
outcome each produces** — a table of before/after rows, a literal example record, the two
screens side by side. The person answering should be choosing between visible results.

Then park the issue in whatever status the tracker uses for "waiting on the reporter", with
the reason recorded, and go work another issue.

## What a postable plan names

- The files it will touch.
- The behaviour before, and after.
- **Where the acceptance criteria are** — they have a field of their own, below, and the plan
  points at it rather than paraphrasing it.
- What it deliberately does **not** change. The boundary is half the value of a plan.
- The one thing you had to verify in code to be sure the plan is possible, so a reviewer can
  check the load-bearing assumption instead of the whole plan.
- Any documented convention this change reverses — the same change rewrites the document,
  and the plan says so.

It goes in the issue's own plan field, and is read back after writing. Not a comment: a
comment is a message in a thread rather than the issue's answer to what the plan is, and a
reader looking for the plan finds whichever comment they reach first.

## Acceptance criteria are a field, not a paragraph

The tracker keeps one beside `plan` and expects this step to fill it — `forge schema` says so
in the tool's own words. Left empty it is not a formality skipped: Phase 5 has nothing to
judge against, so "done" quietly becomes whatever the implementer still remembers wanting.

Write them numbered, each one an outcome a reader could check without opening the diff — what
it holds, where it sorts, what an empty value shows, who may see it, whether the export
follows. **One criterion per line and no conjunctions**: a criterion joined by "and" is two,
and the half nobody checks is the half that fails.

They are written before the code and they are not quietly relaxed to match what got built.
A criterion that turns out to be wrong is corrected the way a wrong plan is — below, in the
open, with the reason.

## When the plan turns out to be wrong

**Replace the field**, so the issue carries one plan and it is the current one, and **say in
a comment what moved and why**. The field is the instruction; the comment is the history of
it. An unverified claim already carried the tracker's authority once — leaving the old text
in place means the next reader inherits it.

## Prose the tracker will translate

Whether anything is translated at all is the **tracker CLI's** business, configured per
project; `forge -h` says how it resolves and what it does. Two things are yours:

**Write the English source well** — it is what stays, and what someone fixes later.

**Read back what actually went out.** Grammar survives translation; meaning is what drifts,
and the drift is invisible to a reviewer who reads only one of the two languages.

## The release note

Not the plan. The plan is for whoever implements and reviews; the note is for whoever filed
the issue: what they will now see, in their vocabulary. No file paths, no commit hashes, no
framework names, no mention of what was refactored.

Phase 7 owns when it is posted. The reason it waits: a note published before the change
ships announces something that has not happened, and a tracker rarely deletes.

Not every issue earns one. Internal maintenance, a security fix whose disclosure is a
decision, an abandoned experiment — say the note is being withheld and why, rather than
writing one because the phase exists.
