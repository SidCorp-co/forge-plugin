# Retiring a name

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

**A handled form is not a redirect, because a redirect does not run.** A form is a word the
dispatcher performs through a verb it has — `forge close ISS-45` as `forge advance` — for one line on
stderr naming what ran. A redirect spends the turn and asks for another; a form spends it and
answers. That is why the rule above forbids the one and this allows the other: the objection was
never to the old word but to hearing about a better one instead of being served. So a form is
*performed and never listed* — in no help text, verb list or near miss, for the reason a withheld
verb is not. Typing it is served; not knowing it costs nothing. A word that is neither verb nor form
gets the unknown-verb answer, and `plugin/src/resolve/handler.mjs` is the table.

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
