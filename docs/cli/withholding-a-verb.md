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
the thing — `forge guide --tracker` echoes the flag and refuses the shape, and says nowhere what
the flag would have printed.

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
old verb outlives the verb, with nothing to fail when it does. The one exception is a release
note on the issue that made the change, which is history and lives on the tracker. A checker holds the
retired names and refuses any occurrence under `plugin/` and `docs/` (ISS-108).
