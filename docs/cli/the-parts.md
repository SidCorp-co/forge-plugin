# A part is what `forge guide` serves, and two projects may be owed different text

[The guides](the-guides.md) says where served text lives and [the flow axis](the-flow-axis.md) what
selects it. This page is the other half: what one project's own answers take out of a part before it
arrives, and how a part is addressed. Neither question is the tracker's — both are about this copy
and the checkout it stands in.

## What varies is fenced, and the text has one copy

A project that closed this plugin's feedback channel is not told where to file against it, so the
part it reads is shorter than the part another project reads. The source still holds the paragraph
once: what varies is fenced between `<!-- forge:when <condition> <value>… -->` and
`<!-- forge:end -->`, and the renderer only ever takes lines away, so no branch of the text has a
second wording to keep in step with the first. A rendering never adds a word — what the CLI
contributes around a part, like the line naming the flow it was rendered for, is assembled beside the
part and is not written into it.

The fence is an HTML comment because the source has to stay a document. It is read in an editor, in
a diff, and by this repository's own prose checks, and a notation those three do not recognise costs
the method text every time somebody maintains it in exchange for a rendering no reader sees. Only
the opener carries the condition: a fence naming it at both ends can disagree with itself, and the
closer has nothing to add.

A value may carry a hyphen, and that is not a widening for its own sake. Every value the fence had
ever carried — `self`, `ready`, `bugs all` — needed none, so the class had none; a flow slug is
kebab-case like every other slug in this repository, and without the hyphen `flow erp-flow` opens
nothing, the closer reports closing a block nobody opened, and the block's body is served to every
flow alike. A charset that cannot spell the value it governs is a fence that governs nothing.

Every silence this mechanism can produce is refused rather than tolerated, each with a case that
watches it fire, because they share one shape: a rendering that looks well-formed and is missing
instructions nobody was told about. A fence
written wrong — an opener nothing closes, a closer nothing opened, an opener inside another — is
answered by naming the line and the shape to write instead, because a renderer that treats a broken
opener as the end of the file drops the rest of the method and looks exactly like one that had
nothing to drop. `forge:` inside a comment is reserved for that reason: the two forms are matched
strictly, so a line reaching for a fence and missing by a space or a letter would otherwise be taken
for prose and served with the text it meant to condition. And a condition the CLI cannot resolve is a
problem rather than a false: a block dropped for a key nobody answered is method text gone with
nothing to say so, so the block stays and the answer is a refusal naming the condition. Adding a
condition to a text therefore means adding it where the answers are assembled, and forgetting to is
loud.

**One condition is the call's and not the checkout's.** `feedback.plugin` and `ship` are read off
the project, one answer per checkout; `rung` is read off the issue in hand, and one checkout serves
every rung. So it arrives as an argument — `--rung <name>` on the guide verb, and on the verbs that
act the effective rung they already computed for the lane — and a call naming none is served the top
rung's text and told so in a line, the upward rule being what an unstated rung resolves to
everywhere else. That it is an argument rather than a lookup is the point: the guide answers off disk
before the transport is touched, and a method read that died on a tracker rate limit would cost a run
the very text it needs to work around one.

**And the rounds a rung buys are the second thing assembled beside a part.** They are read off
`SPARES` at the call, so the ladder keeps one spelling of a ceiling and gains a second reader rather
than a second wording — the same rule that keeps the flow line out of the source. A rung is told what
it buys and never what it was spared: a count of dropped demands is an annotation, and a lighter run
shown the heavier demand reads it, weighs it against what it may use, and does it.

**A fence's values are checked against what its key takes, not merely against what this project
answered.** They are the same test only when the fence is right. `feedback.plugin bug` names a
condition that exists and a channel that does not, so it matches no project's answer and the block
disappears for *everyone* — the one failure here with no wrong-looking output at all, since a
rendering short an instruction reads exactly like a rendering that never had it. So each answer
carries the domain its key takes, read off that key's own declared list rather than a second copy
kept beside it, and a value outside it is refused with both the value and the domain named. A block
under any refusal is kept rather than dropped, for the same reason throughout: what a reader gets is
an error they can act on, never a part with a hole in it.

**Ordinary Markdown does not change what a project is shown.** Two directions, and both were live.
A marker quoted as an example — inside a code fence, or in an indented code block — is the subject
of a sentence rather than an instruction, so it is served whole and raises nothing; a page
documenting the syntax would otherwise have its own example executed. And a real marker indented by
a space or two is still an instruction, so it is still matched: read as prose, it left a project
that closed a channel receiving the very text the channel closes. Four spaces or more is where
Markdown itself says code, and that is the line drawn.
