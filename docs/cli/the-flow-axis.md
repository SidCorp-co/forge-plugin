# A flow is what projects differ by, and it is a slug rather than a number

For six releases the axis over served text was an integer: `method` in `.forge.json`, and
`plugin/guides/v<n>/` holding what it chose between. It never held a second value, and the reason it
could not is that a version is a property of the tree rather than of the text — two texts that
version at different rates cannot both be addressed under one.

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

Serving used to look in a pinned version's root and then a plain one, and for a number this copy had
no directory for the call fell through to a root holding no method at all. The verb then answered in
two confident false sentences — that the method was inline in the `SKILL.md`, and that the copy
served none of its references. The contract was worse rather than better: with no fallback it named
the absent file, which reads as an install that arrived broken when the copy is whole and the key is
the project's own.

So a `flow` the declaration does not name is one refusal, given at the moment the key is read rather
than at the moment a file turns out to be missing. It names the value set, the flows this copy
serves and the key to change, and every surface that would otherwise have answered gives that same
line: the method, every other skill, the contract, the listing row, and `forge doctor`'s contract
line. That coverage is the whole point — a refusal one surface gives and another does not is how a
project came to be refused the method and served the other skills without a word. A refusal a reader
cannot act on is the defect this replaces, and the two sentences it replaces were not silence: they
were wrong.

## A flow's directory is the whole of what that flow serves

The path is the answer. `plugin/guides/contract/<flow>/` holds every contract part that flow serves
and `plugin/guides/skills/<skill>/<flow>/` every method part and reference, with no base, no merge
and nothing to declare: reading what `erp-flow` is served is `ls` on one directory. `default` is the
flow a project falls back to when its config names none — it is not a base, and nothing resolves
through it.

**A flow is not a patch on another flow.** It is a way of working, and the parts it needs are its
own: `18-release-and-routes.md` means nothing to a flow with one branch, and a staged-QA flow wants a
part about exercising a screen no other flow should be shown. An override layer can say neither — it
expresses *the same part, said differently*, which is the narrowest of the three things a flow does.
So part names and their order are the flow's, and a part `default` has not got needs no permission.

**Duplication between flows is legal, and it is unchecked.** Shared prose exists once per flow, so a
correction to a rule every flow shares is made once per flow. That cost buys the two things a base
cannot: text no reader has to assemble from two files, and a part `default` has not got. So a
shared-text report or a drift check is refused here, because either would re-import the base by the
back door.

**This restores the rule that serving must not fall back.** Its objection was to a combination nobody
declared supported, and the earlier shape amended it to permit a declared base. Complete sets need no
amendment: there is no combination, so every part a reader is served is the served flow's own, and
that is why an answer names one flow and never a second.

**The slugs stay declared, and nothing about parts is.** One constant names the flows this copy
serves and, per flow, the plan declarations it requires — because a flow whose directory vanished has
to be a refusal rather than a silently shorter list. What a flow *holds* needs no declaration at all,
its directory being that.

**Skill text is under the same rule**, and [the guides](the-guides.md) carries what that makes of its
directory. The consequence here is that `flow` is not a fence condition: a
`<!-- forge:when flow <slug> -->` fence anywhere in served text is refused by a checker naming the
part file to write instead, because two routes for one axis is a precedence rule with nothing to
decide it. What stays a fence is a fact orthogonal to the flow that belongs inside a part — the
machine's ship mode, the project's feedback channel; [the parts](the-parts.md) carries the fence.

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

## What the checker holds, and why only two findings are left

Two findings, each on a planted flow rather than the shipped one, and both about a slug:

- a declared flow whose directory holds no part, which is the incomplete installation;
- a directory the declaration does not name, which nothing would serve.

Four findings went with the override layer, each having policed a declaration that no longer exists.
The last of them is the one worth naming: a flow file byte-identical to the one it overrode was
refused because a per-part fallback let a flow carry a copy it did not need, and under complete sets
that copy *is* what the flow serves.

The check keeps its own question. *Which text am I served* is a project's, and the flow answers it.
*What does this copy ship* is a check's, and no `.forge.json` is part of that answer: a gate step
whose verdict moved with a setting it does not declare would be reused stale, and declaring the
settings resolver as its input would re-run the check every time an unrelated key changed.

## The one completeness reading, and why it reports

`forge doctor` prints one line per declared flow: how many parts that flow's contract holds, and
which statuses of the ladder it leaves unanswered. **It reports and it does not refuse.** A flow
deliberately without a part is legal, and `stageLine` already answers for an absent one at the call,
so the line exists to make the choice visible where a set is chosen — it catches the flow that is
*accidentally* without a part. Turning it into a gate would make a flow's own set a refusal, which is
the layer this axis just stopped being.

**Every answer names the flow it was served for, `default` included**, and it names one flow, because
every part a reader is served is that flow's own. A reader that cannot ask what it just read is the
thing being fixed; the missing version line the old shape appended only for versioned slugs was the
same defect from the other side.
