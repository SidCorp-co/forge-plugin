# The goals a `Serves:` may name — whose list it is, and why two sources answer for one line

A decision record and a filed body may each carry one identifier saying what the change is for.
Where that identifier is allowed to come from took three arguments to settle, and the third of them
is about something the line deliberately does not do.

## The list belongs to the project, never to this repository

*Why is it read from a stored brief rather than from `docs/requirements/brd/03-goals-non-goals.md`?*

Because a session runs in whatever repository has this plugin installed. This one keeps a
requirements tree with ten G-rows; the next has a paragraph in its README, or a founder's memory, or
nothing at all. A list read off a path only this repository has would answer for no other backlog —
and worse than not answering, because a value refused there would have been weighed against a file
that is not that project's.

So the source is the project brief, the one artefact every project has: it is read before any code
is, and `forge doctor --line` writes into it where nothing was written before. This repository's own
ten goals arrived by exactly that route, one `forge doctor --refresh` naming the file above as each
line's provenance. That path is a source arrow on a stored line, and nothing goes looking for it at
a write.

## Two sources answer, and the brief is asked first

*A project writes its goals as clauses of its requirements tree. Which of the two does its
`Serves:` resolve against?*

Both. The sets overlap wherever a project keeps a tree, and the temptation is to treat the overlap
as sameness — collapse them and a run naming the clause its change is genuinely against is refused
for naming something that resolves, since a tree holds far more clauses than a brief lists goals.
So a value the brief's section lists resolves there; one it does not list is put to the tree, and
stands if a clause answers to it.

The order is not cosmetic. Reaching the tree costs a directory walk, so asking the brief first means
only a value the brief lacks pays for the second source. It is also why the refusal prints what each
of the two held rather than the bare word: told that a value is not a goal, a caller cannot tell a
mistyped identifier from a goal the brief never gained, and those want opposite corrections.

## The line is read for a long time before anything is weighed on it

*What happens to a change that serves nothing anybody wrote down?*

It is recorded, saying so. An absent line reads as *none stated*, the literal is legal, and two
different things are bought by that.

The first is that a project whose goals nobody has written down would otherwise be one where no
decision can be recorded at all. The line would be a gate on a document somebody else owns, which is
the opposite of something a run can use.

The second is the one worth defending. `forge next --why` prints the line beside the score and no
weight looks at it. Whether what a change is for ought to move it up the queue is a question to
answer off a few hundred of these lines rather than off a guess made the day the field was added —
and a field that refuses values, or that reorders a queue, stops recording what people would have
written in it. Reading first and weighing later is recoverable. The other order is not.
