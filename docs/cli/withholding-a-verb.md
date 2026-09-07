# Withholding a verb

Two mechanisms, deliberately not merged: the server *refuses* a tool, and a human *chose* to withhold a
verb. A gated verb cannot run; a withheld one is unlisted and still works, so collapsing them loses the
distinction that makes each correct. `needs` is declared on every verb with a backing tool, not only the
probed ones, so if `forge_issues` is ever gated, six verbs disappear together rather than fail one at a
time. A gated tool's schema is not printed at all: it is an invitation to a call that cannot succeed.

The usage line has one home. It lived twice and the two had drifted four ways, so `forge -h` and the
error a caller hit disagreed about which payload forms exist.

**And where this copy or this credential cannot use a thing, `forge doctor` is the only surface
allowed to say so.** Not `-h`, not a list, not a near miss, not a closing line saying how many
things were left out. An agent that does not know a thing exists is better off than one that knows
and cannot use it: the first spends no turn on it, the second reads it, weighs it against what it
may use, and asks. So a gated verb is absent rather than annotated, a withheld one is unlisted, a
guide the table holds a row for is not named or counted, and a flag only a maintainer can act on is
in no help text.

That is a permission and not a promise. It says where the answer may be given, and `doctor` gives as
much of it as it has been built to give — today the verbs a human withheld by name, the capabilities
this credential is refused by count, the guide table by count, and a withheld guide's own text not
at all, which is ISS-71's half. What the rule
forbids is any *other* surface making up the difference: a gap in `doctor` is a gap to close there,
because a person debugging the copy is the one reader who should carry it.

A refusal answers what the caller named and volunteers nothing past it. Typing a gated verb still
says which tool it needs and that this credential may not call it, because the caller has already
spent the turn and a silent refusal costs a second one; what the refusal must not do is *describe*
the thing — asking `forge guide` for a withheld page with the `--tracker` flag echoes the flag and
refuses the shape, and says nowhere what the flag would have printed.

**A project's key and this machine's withholding are two answers to two questions, and the narrower
one is what a caller gets.** `feedback.plugin` is the project's: whether a run working here may file
about this plugin at all. `forge doctor --hide feedback` is this machine's: whether this machine
offers the verb. They are not a precedence puzzle, because neither can grant what the other
withholds — a channel the project turned off is not reopened by a machine that offers the verb, and a
verb this machine withheld is not offered by a project that allows the channel. So the routing names
the verb only where both allow it, and `doctor` prints each with its own source, which is how a person
debugging the copy learns which of the two spoke. What neither may do is leave a sentence behind: the
destination is rendered by the CLI off the key at the moment a filing is intended, so a channel that
closes takes its sentence with it, which is this page's rule applied to a setting rather than to a
release.

The machine's other option sits in the same file for the same reason. `forge doctor --ship
ready|self` says whether a run on this machine lands its own change or ends ready for another actor
to land it: the actor that lands runs on this checkout, so the level that owns the landing owns the
switch. Absent, it is `self`, which is what every run did before the option existed — a silence here
is the old behaviour and never a refusal to land.

**A replaced verb is retired, not redirected.** When a new verb or tool takes over what an old one
did, the old name leaves every surface at once — the dispatcher, `-h`, the CLI document, the skills,
the contract — and typing it afterwards gets exactly what a name that never existed gets: the
unknown-verb answer, with *did you mean* drawn from the live verbs alone. Where that ordinary
matching happens to offer the replacement because it is the nearest live name, that is a typo
answered and not a redirect: nothing in the CLI knows the old name. What is forbidden is anything
that does — a row saying *use X instead*, a refusal written to name the replacement, a deprecation
note in a skill. The user's rule,
2026-09-04, and the reason is the same one that withholds a gated verb: a redirect is a turn spent
reading a thing that cannot be used and a second turn retyping it, and a skill sentence naming the
old verb outlives the verb, with nothing to fail when it does. A checker holds the
retired names and refuses any occurrence under `plugin/` and `docs/` that is not in one of the trees
it exempts as history (ISS-108).

**Two exceptions, both bounded, and neither is a way round the rule.** The first is a release note on
the issue that made the change, which is history and lives on the tracker. The second is
**one write that had two verbs**: the name that loses gets one release of the refusal the rule
forbids — one line, naming the verb to type and nothing else. ISS-348, 2026-09-05, is the rule that
says so, and what earns it is that the two names were interchangeable up to the landing, so every
skill, guide and how page that named the losing one was written believing it and every agent that
learned the surface learned both. A retirement that takes nothing over gets no such line.

What makes it a window rather than a repeal is where the line lives and what ends it.
`plugin/src/resolve/retiring.mjs` holds one row per such name — the form a caller types, the release
that retired it, and the line to print — and nothing else in the CLI knows the old name. The release
after that one deletes the row and enters the name in the checker above, which is the landing that
closes the window; the row's own release is what says the window has been open a release too long.
The two registries may not both hold a name, and `retiringProblems` refuses a landing where they do:
a retired name carries no replacement and a retiring row is nothing but one, so a name in both is a
window somebody forgot to close.
