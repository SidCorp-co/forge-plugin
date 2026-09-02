# forge-plugin — the requirements tree

The BRD says what the product is for and what it may not do. The SRS says what it does, clause by
clause, under an identifier a commit message and a tracker verdict can cite. Start at
[brd/README.md](./brd/README.md) for the intent and [srs/README.md](./srs/README.md) for the
behaviour.

This tree is also the framework: it is written to be adopted by another project, and every rule
below is stated in a form a checker can hold rather than as advice a reader has to remember.

## The store and the surface

*Who reads which of them?*

**The tree is the agent's substrate.** Plain files, one clause per identifier, greppable, diffable,
and small enough that a phase can read the clause it is implementing and nothing else.

**A person reads a page, never the tree.** One page per capability — the BRD section, the
functional requirement with its derived status, its use cases and criteria in the product's
language, the trace table — rendered from these files by ISS-29. Nothing in this tree is written
for that reader's eye; it is written so the page can be generated and so a machine can check it.

**A business analyst changes the spec through a tracker issue, not through a file.** The issue
cites the clause, the agent applies it, and the clause's revision moves — so the change is
reviewed like code and the citations that depended on the old text fall out (R-10). A spec gap met
mid-implementation is a blocking spec-change issue, which is ISS-31's rule and not this tree's.

That is why every clause here keeps its machinery — identifier, revision, actors, the rule it
enforces, the test that proves it — on **a line of its own beside the clause**, and never inside
the sentence a person is meant to read. A clause is also complete without the prose around it: the
page renders the clause, not its neighbourhood.

## The rules of this tree

*What must be true of every document here?*

Each rule is stated once. Where a rule already has a checker in this repository, the clause cites
the checker and does not restate what it says.

| # | Rule | The form a checker holds | Checked by |
|---|---|---|---|
| R-01 | One functional-requirement sequence, and one only. | `FR-` ids form one run from 01 with no gap, and each has exactly one `srs/fr-NN-<slug>.md`. | the spec gate |
| R-02 | The index and the files agree. | The identifier set in `srs/README.md` equals the set the `srs/fr-*.md` filenames carry. | the spec gate |
| R-03 | A clause is referenced by its identifier. A section number names a document and never a clause, and a line number names nothing. | No line number anywhere. A section number appears only in a document title, a navigation line, a contents row, or the label of a link whose target is that section's own file; every identifier cited resolves to a clause. | the spec gate |
| R-04 | A count is read from the list, never restated. | No prose gives the size of a list this tree holds. | a person |
| R-05 | The reason sits beside the clause. | Every clause has a because-clause or a `Source:` field. | a person |
| R-06 | A deviation names its decision or its issue. | Every deviation mark carries an issue key or a decision id, and that reference resolves. | the spec gate |
| R-07 | An open question is an issue, never a marker in a clause. | No clause contains a deferral marker; every row of `brd/08-open-items.md` carries an issue key. | the spec gate |
| R-08 | Every use case has at least one acceptance criterion. | Each `UC-` heading is followed, before the next `UC-`, by at least one `AC-` line. | the spec gate |
| R-09 | Every business rule is enforced somewhere. | Each `BR-` in `brd/04-business-rules.md` appears in at least one clause's `Enforces:` field. | the spec gate |
| R-10 | A citation carries the revision it was written against. | Every citation is `<id>~<rev>`; the gate hashes the clause's content, compares it with the hash recorded for that revision, and reports the citation suspect when the two differ. | the spec gate |
| R-11 | An acceptance criterion is in EARS form and names its proof. | Two lines: a field line opening with the identifier and carrying `Proof:` — a path that resolves, or `none yet` with an issue key — then a sentence opening with `WHEN`, `IF`, `WHILE` or `WHERE`, holding `SHALL`, and holding `THEN` when it opened with `WHEN` or `IF`. | the spec gate |
| R-12 | An identifier is never reused and never renumbered. | A retired clause keeps its number and is marked retired; no number appears twice in the tree. | the spec gate |
| R-13 | Each document carries the sections its kind declares. | The section list below, matched against the headings of each file. | the spec gate |
| R-14 | A section heading is followed by the question it answers. | The first non-blank line after a `##` heading ends in a question mark. | the spec gate |
| R-15 | A clause heading is followed by its field line. | The first non-blank line after an `FR-`, `UC-`, `NFR-` or `EI-` heading opens with `Rev:`; where a document carries a proposal line that line comes first and the field line is the first non-blank line after it; an acceptance criterion is a list item and its own first line is its field line. | the spec gate |
| R-16 | Machinery never sits inside the sentence a person reads. | No identifier, revision, hash or path inside a `SHALL` sentence or a business rule statement, except the system the criterion names. | a person |
| R-17 | Every list is renderable as a table. | Each list of clauses is a table, or a sequence of clauses with identical field keys. | the page lint |
| R-18 | A clause never restates the argument for a rule; it states the duty and cites the argument's home. | No sentence of the tree overlaps a sentence of the rules file, a skill, a gate document or another document under `docs/` at 0.55 or above by the measure in `plugin/src/duplication.mjs`, over sentences of five words or more — counting prose, list items **and the text of table cells**, which that module strips and the gate therefore has to put back. | the spec gate |
| R-19 | The tree names nothing that does not resolve. | Every path in a code span or a link exists, read from the repository root or from the document's own directory; every verb named is one the CLI has, or one declared on the document's proposal line. | `plugin/test/doc-claims.test.mjs`, then the spec gate |

**Why a revision by hand and a hash by machine (R-10).** Doorstop stores a parent's fingerprint in
the child link and marks the link suspect when the parent changes; OpenFastTrace puts a revision in
the identifier itself. A fingerprint typed by an author is unmaintainable and silently wrong, and a
revision alone cannot tell an obligation that changed from a typo that did not. So the author owns
one integer and the tool owns the hash: a text change makes every citation of that clause suspect,
and the author either bumps the revision — which drops the verdicts that cited the old one — or
clears the suspicion, which moves the recorded hash and leaves the verdicts standing.

**Why 0.55 and not the threshold the documents use (R-18).** The gate over `docs/*.md` measures at
0.25, which is right for a document that narrates alongside its sources. A specification is not that
document: its job is to state the obligations those sources argue for, so it must name the same
objects in the same words, and at 0.25 this tree reports over a hundred pairs of which almost none
is a second copy of anything. Measured against the rules file, the skills, the gate documents and
the other documents under `docs/`: every pair at 0.55 or above was a borrowed *argument* and was
rewritten to a duty plus a citation, and what remains at 0.50 is clauses stating the very behaviour
their source describes — the specification doing its job. So the threshold is a measurement rather
than a preference, recalibrated the way this repository already recalibrates one.

**And the measure has to reach a table cell.** `plugin/src/duplication.mjs` strips every table row
before it extracts sentences, so a rule restated in a cell is scored by nothing — and a cell is
where a restated rule in this tree would most naturally sit, since the business rules, the
constraints, the assumptions and the glossary are all tables. Measured separately with the cells put
back, this tree carries no overlap with those sources at 0.40 or above. A gate built on that module
unchanged would be blind to the half of the tree that most needs the check, which is the kind of
selector that looks exactly like a clean repository.

**A proposal line, where a document has one.** Exactly one line, immediately after the title:
`**Status: proposal for` followed by the verbs the document names, each in a code span, then a full
stop. It exists because a document specifying a verb the CLI does not have would otherwise fail the
check that every command a document names is one a reader can run (R-19), and the exemption has to
name the verbs it covers so it cannot excuse a typo. Nothing else in the document may name a verb
the CLI lacks.

**What is hashed, and where the hash lives.** A clause's content is its normative text with
Markdown markup stripped and runs of whitespace collapsed: for an acceptance criterion, the EARS
sentence alone; for a requirement, a use case, a non-functional requirement or an interface, the
heading text plus every line down to the next clause heading, excluding its own field line.
Explanatory prose inside a clause counts, because a clause is meant to be complete on its own and
anything inside it can change what it obliges; the `Rev` value itself does not, or bumping it would
never settle. The hash of each clause at its current revision is a **generated file in this tree,
committed beside the clauses**, so a spec edit and its hashes move in one commit and a citation can
be judged with no network. The gate that writes it (ISS-27) fixes its name and format; until then a
citation carries its revision and nothing compares it.

**Why no machine identifier beside the human one.** StrictDoc keeps a machine id so a rename stays
traceable. Here R-12 buys the same stability for nothing: a number that is never reused and never
renumbered is already a permanent handle, and a second identity typed into every clause is one
more field to maintain and no reader for it until a diff tool exists.

## What is checked, and what is judged

*Which of these does a machine settle?*

- **The spec gate (ISS-27) checks presence and resolution.** Every rule above marked *the spec
  gate* is a shape: an identifier that exists, a citation that resolves, a section that is there, a
  marker that is absent. It never asks whether a clause is right.
- **The reader (ISS-26) is what makes the citations usable.** It is the one place the storage of
  this tree is known, so a phase can ask for `UC-05-3` without knowing there is a file.
- **A person judges fit.** Whether a use case describes the product, whether an acceptance
  criterion actually proves the behaviour, whether a business rule is the rule the business wants:
  none of that is checkable, and a gate that tried would refuse honest clauses and pass dishonest
  ones. This is the same division the issue-flow contract draws over its payloads.

## The sections each document carries

*What must be in the file before it counts as written?*

| Document | Sections, in order |
|---|---|
| `brd/01-problem.md` … `brd/08-open-items.md` | one section per file, its own heading, then the question it answers |
| `srs/01-introduction.md` | purpose · notation · what this specification does not cover |
| `srs/02-system-overview.md` | the parts · the actors · what holds the state |
| `srs/fr-NN-<slug>.md` | title with its section number and identifier · purpose · actors · use cases, each with its criteria · business rules enforced · the way back, when the requirement declares schema or deploy coupling |
| `srs/17-nfr.md` | one clause per `NFR-` identifier |
| `srs/18-data.md` | the fields this CLI owns, one table per store |
| `srs/19-external-interfaces.md` | one clause per interface crossed |
| `srs/traceability.md` | generated; the placeholder says by what |

The way back is a section of the requirement that needs one rather than a document of its own,
because "when schema or deploy coupling exists" is a condition on a requirement (ISS-30) and an
absent section is then checkable where an absent paragraph in a shared document is not.

## Adopting this tree in another project

*What does a second project have to do?*

1. **Create the two directories and the index files.** Until the scaffold verb exists (ISS-30),
   copy the section lists above; the templates it will ship are these documents.
2. **Decide the language.** The clauses are written in the language of that product's readers; the
   identifiers, the field keys and the section names stay as they are here, so a tool reads every
   project's tree the same way. This tree is English because the product is a developer's tool.
3. **Write the BRD first, and its business rules from the rules the project already states.** A
   `BR-` that is not already enforced somewhere in the repository is a wish, not a rule.
4. **Write one functional requirement per capability, not per screen or per module.** The test is
   whether an issue could cite it: a requirement nothing can cite is too big.
5. **Point the checks at the tree.** The spec gate joins that project's own check suite, and its
   failures are read as its own.
6. **Move nothing.** Where a rule already lives in a checker, a skill or a project's own rules
   file, the clause cites it. A rule with two homes drifts, and the second copy is the one nobody
   corrects.
7. **File the migration as an issue in that project.** This tree does not migrate anybody.

## Deviations from the trees this one learned from

*Where does this differ from the projects that already carry the shape, and why?*

- **The business rules live in the BRD, and the SRS points at them.** The sibling trees keep the
  quick table in the SRS index because neither of them has a BRD. Here `brd/04-business-rules.md`
  holds the sequence, and the map from a rule to the requirements that enforce it is generated by
  ISS-29 rather than kept by hand — a hand-kept map is the drift one of those trees had to add a
  column to find.
- **A business rule is a name and a home, not a statement.** In a project whose rules were written
  before this tree, every one of them is already argued for somewhere a developer reads, and BR-09
  is the rule about what a second copy of one costs. So a row carries the rule's name and the
  document that states it, and nothing else. A name also comes in far under R-18's measure, which
  reaches into a table cell for exactly this reason. A project whose tree
  comes before its rules has nowhere to point, and states the rule in the row instead.
- **No decision ledger of its own.** A decision that was applied is in `git` and in the record of
  the issue that applied it; a decision still open is a row in `brd/08-open-items.md` with the
  issue that will settle it. Nothing here is a third place to look.
- **Traceability is not written.** `srs/traceability.md` is a placeholder. A hand-kept trace table
  is a second copy of what the tracker already knows.
