# The guides are the tracker's, and seven of them are not this flow's

Read guide by guide on 2026-09-03, five of the twelve the tracker serves state a rule this plugin's
contract has replaced, and `pipeline-and-issue-lifecycle` disagrees with itself inside one page: use
`dropped` for anything discarded, and three paragraphs later, the recommended discard for non-work is
`closed` plus `unmark`. None of it is the tracker's fault — those pages describe the pipeline runner
it ships. The cost is what a passthrough did to agents in another project the same week: one wrote a
body to `writing-an-issue`'s six blocks and the filing lint refused it heading by heading, and the
same agent paid four calls taking non-work down the `closed`-plus-`unmark` route. An agent reads the
guides on its first call of a run, and two contracts at that moment cost a round every time.

So the verb reads them through a disposition of its own, one row per guide in
`plugin/src/tracker/guides.mjs`: a slug, why, the rules replaced in the guide's own words beside
what holds instead, and where to go — a verb this CLI has, or a file the installed copy carries. It is
code and not a project setting because it is this plugin's reading of the tracker, and a
contradiction is not a thing a project can rightly turn back on.

**Having a row is what withholds the guide**, and the two other pages are the reason the rule is
stated that way rather than by disposition. `memory-and-knowledge` and
`issue-dependencies-and-decompose` are the tracker's in one half and the runner's in the other, and
for two releases the verb served them whole under a first line withdrawing the half that does not
apply — which asks an agent to read a page and then hold part of it aside. Neither is a page it can
follow whole, so neither is listed. The disposition decides one thing now and it is not visibility:
`superseded` is what the overlap measure in [doctor](doctor.md) scores, which is a different question — whether a
project's own file restates a guide's authority, not whether this verb serves the page. What a
maintainer's read prints is decided by the rules the row enumerates, and a row may enumerate none.

Nothing the CLI volunteers names a withheld guide — not the listing, not a count of what it left
out, not a near miss, not `-h`. Asking for one by slug echoes the slug the caller typed and answers
in the words a slug the tracker never served gets, from the same line of code, so the answer carries
no evidence that the guide is anywhere. ISS-66 hid the five and left four traces; the rule that took
them out is the user's, 2026-09-04, and [*Withholding a verb*](withholding-a-verb.md) states it once for the whole CLI.

A maintainer reviewing the table still has to read what it hides, and that read belongs under
`forge doctor`, which is the surface for everything this copy or this credential cannot use. It is
not there yet: `forge guide <slug> --tracker` is the escape in the meantime, documented here and
nowhere the CLI prints, and ISS-71 holds `src/tools/doctor.mjs` — the need is filed against it.

What is decidable by code is the slug and nothing more. `forge doctor` reports a row the tracker has
stopped serving, and notes a guide it has started serving that no row has been read against; whether
that new guide contradicts the contract is meaning, and the one mechanical signal available — the
overlap measure in [doctor](doctor.md) — is blind to negation, so a restatement and a contradiction score alike. The
list of twelve beside the table is not a copy of names the server publishes in the sense the rule
in [what the projections leave out](the-projections.md) forbids: nothing answers a guide from it, its whole purpose is to differ from the live list
when the tracker moves, and a row this record lacks fails the suite, so the change that notices a
retirement is the change that drops the row.

The contract those rows send a reader to is answered by the same verb, and it had to move to be
answerable at all: installing copies `plugin/` and nothing beside it, so for six releases every one
of those rows named a file that existed on one machine. It is `plugin/guides/issue-flow-contract.md`
now, and `docs/` keeps a pointer so the requirement clauses citing a section still land. Whole it is
fifty thousand characters, most of them about a stage the reader is not at, so the verb serves it cut
at its own headings: a bare `forge guide contract` answers with the parts, their sizes and the call
for each, and a named part answers with that part. Two consequences worth knowing before either
surprises somebody. A heading is the address, so renaming one moves the call that reaches it and the
suite fails until the change admits that. And `forge doctor` prints the file's absolute path and the
contract number it declares, because a copy that arrived without it is indistinguishable, from
inside, from a copy whose rules simply say nothing.

The overlap measure has the same premise the verb just abandoned — the guide is the authority, the
project's own file the copy — so it no longer scores a superseded guide. It would otherwise ask a
developer to delete their line and defer to the rule the CLI stopped serving. An `overrides:` marker
still resolves against all twelve: a waiver names a guide, and which of them this plugin stands
behind is not the waiver's business.
