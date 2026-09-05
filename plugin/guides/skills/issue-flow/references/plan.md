# The plan, and the criteria it will be judged by

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

The field, never a comment: a comment is a message in a thread rather than the issue's answer to
what the plan is, and a reader looking for the plan finds whichever comment they reach first.

The plan also carries the declarations the flow reads before `in_progress` is earned — whether
a screen changes, whether a schema is coupled, what the user sees — and their exact lines are the
contract's, not this reference's: `forge guide contract approved` prints them.

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
