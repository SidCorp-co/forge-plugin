# The proposed fields — a missing priority or complexity, written at filing

A filing that names no priority or no complexity is given the missing field by the model its project
names, written onto the issue with a correction saying which model proposed it. `forge new -h` and
`forge issue -h` carry the flags; this page carries the decisions behind that shape.

## Why at filing

On 2026-09-28 every open issue of this project was ranked and sized by hand: 813 of 1132 needed a
priority, a complexity or both. By the end of that day the day's runs had filed five more with
neither. Every issue missing one starts at a filing, so the filing is where the field is written
(G-13). A proposal that is only read and never written leaves each later reader deriving again a
value nobody can see.

## A field given is never asked for, and a field held is never replaced

What a filer typed is theirs. A proposal fills an absent field only. `forge issue ISS-nn --propose`
fills what an issue already filed lacks, and never touches a priority or complexity the tracker
holds. A priority of `none` counts as absent, since `none` is the tracker's word for nobody having
judged it ([`new`](new.md)).

## The record says who proposed it

The write goes through the field writer, and the same correction every hand-set field leaves goes
with it. Its reason names the model, the confidence the model gave and its one sentence, so a later
reader can tell a proposed field from a judged one and can see what the proposal rested on. A person
who disagrees replaces it with `forge issue ISS-nn --set <field>=<value> --why <w>`. The confidence is
printed and recorded, and it gates nothing, for the reason
[`codex-the-complexity`](codex-the-complexity.md) gives.

## The scale is the project's

What makes an issue critical or low is a judgement about one project's work, so the priority question
is given the project's own text for each level: `priorities.<level>` in the project's record, one
sentence per level. Urgency is judged differently from one project to the next, so a scale fixed in
code would be wrong for most of them (G-12). The levels are the tracker's, less `none`, because a proposal is
a judgement and can never answer with the word for none. A level the record leaves out is not offered
to the model.

## The switch is the project's record, and nothing else

The complexity is proposed where the project's record names `codex.complexityModel`, and the priority
where it names `codex.priorityModel` and states a scale. There is no second switch. The model key sat
in the machine's own config until this change. There it answered for every project on the box, so a
machine that set a model for one project's measurement would have had other projects' issues written
without their deciding it. It was also not carried into a run home that borrows the machine's
credentials. So it is the project's now, and `forge doctor` reports the machine's old key as ignored.

Where a field is off, the reply says so and names the setting that turns it on. A filer who expected a
field learns why there is none while the command is still in their hand.

## No fallback

A proposal that fails leaves the issue filed and that field unset. The failure can be no gateway, a
model the profile cannot resolve, a refused request, or an answer outside the set. The reply names
the failure and prints `forge issue <key> --propose`, and nothing retries it on another model or
guesses a value in its place. What to do next is the caller's decision.

## The defect route is proposed like any filing, by the destination's record

`forge feedback` takes no rank from its finder, and before this ruling it took none at all. Three of
the five unbanded filings of 2026-09-28 were runs' notes, so the notes are where much of the gap
starts, and they take the same step as `forge new`. The record that decides the step is the project the note is
filed on, which is the plugin's own. So the note is proposed where the checkout it is filed from is
that project. From any other checkout, the reply says the fields were left unset and names the
`--propose` call to run from a checkout of the plugin. Proposing there would judge this backlog on
another project's scale.
