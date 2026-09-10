# A flow is what projects differ by, and it is a slug rather than a number

For six releases the axis over served text was an integer: `method` in `.forge.json`, and
`plugin/guides/v<n>/` holding what it chose between. `SHIPPED` never held a second value, so the
number carried no information from the day it was built, and the reason is that a version is a
property of the tree rather than of the text — two texts that version at different rates cannot both
be addressed under one. That is why there were two homes and a resolver searching between them.

What projects actually differ by is **which flow they run**: where the merge sits, who judges, what
a plan must declare. A number cannot say `erp-flow`. So the axis is a slug, `flow`, and an absent key
**is** the string `default` rather than a null the resolver substitutes a constant for. That
difference is the point: with an integer, raising the constant moved every project that had pinned
nothing, and adding a flow directory cannot move any project at all.

`method` is retired with a stated precedence, because a key that half-answers is worse than one that
does not. `flow` present wins, declared or not — declared is served, undeclared is refused naming
the flows this copy serves. With no `flow`, a `method` reading as `1` is `default` and the answer
says the key is retired; a `method` present and reading as anything else resolves to nothing and is
refused naming `flow`. Presence is read rather than truthiness, so an explicit `null` is a value a
project wrote and not an absence. Both keys absent is `default`.

## A flow nobody serves is refused where the key is read

Serving used to look in a pinned version's root and then a plain one. That fallback was right for a
skill no version had an opinion about, and wrong for a number this copy had no directory for: the
call fell through to a root holding no method at all, and the verb answered in two confident false
sentences — that the method was inline in the `SKILL.md`, and that the copy served none of its
references. The contract was worse rather than better, because it had no fallback and named the
absent file instead, which reads as an install that arrived broken when the copy is whole and the
key is the project's own.

So a `flow` the declaration does not name is one refusal, given at the moment the key is read rather
than at the moment a file turns out to be missing. It names the value set, the flows this copy
serves and the key to change, and every surface that would otherwise have answered gives that same
line: the method, every other skill, the contract, the listing row, and `forge doctor`'s contract
line. That coverage is the whole point — a refusal one surface gives and another does not is how a
project came to be refused the method and served the other skills without a word. A refusal a reader
cannot act on is the defect this replaces, and the two sentences it replaces were not silence: they
were wrong.

## Declared, never discovered

One constant names the flows this copy serves and, per flow, the contract parts it overrides and the
plan declarations it requires. The installed directory is not the declaration, and the reason is a
failure the filesystem cannot report: a flow that loses a part it was meant to override still has
its directory, and nothing reading the tree can tell that from deliberate inheritance. So the
declaration is the claim and the tree is the inventory, and a checker holds them against each other.

Every flow's base is `default`, named by nothing and walked by no chain, so resolution is one lookup
and there is no order to get wrong. **Contract resolution is per part**: a declared override resolves
to the flow's own file, a part the flow does not declare resolves to `default`'s, and a part the flow
declares and has not got is an incomplete installation — refused by name, never inherited, with the
parts around it still served. What stays forbidden is probing a *sibling* flow for a part the
asked-for flow does not name, which is the search this layout exists without.

The earlier rule that serving must not fall back is amended here deliberately. Its objection was to a
combination nobody declared supported. `default` as every flow's declared base, with each part's
source named in the answer, is a declared combination; a silent substitution is not.

**A flow overrides a part and never inserts one.** The order is the filename prefix, so a part added
mid-sequence renumbers everything after it — ten renames, paid twice already. A flow needing a part
between two others waits for the reading that derives the number instead of encoding it.

**Skill text is one copy and a flow never overrides a file of it.** Copying a file so a flow can
change part of it is how the two homes grew: `guide.md` is one text of eight phases, and a flow
changing one phase would carry the other seven with no byte comparison able to catch a copy that
differs by a paragraph. What a flow changes it changes inside the file, in a
`<!-- forge:when flow <slug> -->` fence — [the parts](the-parts.md) carries the fence itself. A
reference one flow alone cites ships in the shared `references/` directory and is named by the fenced
reference table, so a document exists once however many flows cite it.

## What a flow may not decide

A flow sets which declarations a plan is *required* to make. It does not set what a rung demands: the
entry checks are one code set, so a UI flow can require `screen` of every plan while the
screen-evidence refusal stays the single place that charges for it.

**The declaration vocabulary itself is global**, and a flow may neither add a name nor remove one.
The reason is where the flags are read from: they are parsed out of the issue's *persisted plan text*
with no flow as an input, so a plan's declaration means the same thing forever. Let a flow own the
vocabulary and a plan reading `screen change: yes` parses to nothing under a flow whose table lacks
`screen` — changing a project's flow would retroactively reinterpret every plan already written, with
no check firing. A case holds the same persisted plan and the same evidence to the same verdict under
two different flows.

A flow requiring a person's look on a project whose release policy waives it is **refused, not
reconciled**: the declaration would promise a look nobody takes, and `forge doctor` reports the
conflict beside the release-policy one it already reports. No precedence rule between the two sources
is introduced, because there is none to introduce.

The record-contract identity stays separate. One number stamps records and is compared against what
a served text declares; neither is derived from the flow, and nothing here diverges what a rung
demands, so no record becomes ambiguous. The pin is also one value for the whole set rather than a
per-skill map: the method and the contract are co-designed, and a project mixing them runs text
nobody tested.

## What the checker holds, and why each finding exists

Six findings, each on a planted flow rather than on the shipped one:

- a declared flow with no directory, and a directory the declaration does not name;
- an override the flow declares and has not got, which is the incomplete installation;
- an override naming a part `default` has not got, which is a flow inserting a part;
- a file the flow has and declares no override for, which nothing would serve;
- **a flow file byte-identical to the `default` file it overrides**, because a per-part fallback lets
  a flow carry a copy it did not need.

The check keeps its own question. *Which text am I served* is a project's, and the flow answers it.
*What does this copy ship* is a check's, and no `.forge.json` is part of that answer: a gate step
whose verdict moved with a setting it does not declare would be reused stale, and declaring the
settings resolver as its input would re-run the check every time an unrelated key changed.

**Every answer names the flow it was served for, `default` included**, and a contract part that came
from another flow names that flow too. A reader that cannot ask what it just read is the thing being
fixed; the missing version line the old shape appended only for versioned slugs was the same defect
from the other side.
