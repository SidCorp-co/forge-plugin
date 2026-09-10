# The handler

A word this CLI performs through a verb it already has, rather than a word it lists. Why that is not
a redirect, and why a form is never offered anywhere, is
[withholding a verb](withholding-a-verb.md)'s; what a form may be, where it is read and what keeps
the table honest is here.

## What made a whole class of word worth serving

*Why perform a word instead of adding a verb or leaving it unknown?*

An unknown verb answers with the verb list, so a caller who typed the wrong word for a move it was
entitled to make paid the turn twice — once for the list, once for the retype — and the word it
typed was, every time, the name of the status it wanted. The user's decision of 2026-09-07 is that
those words are served. The alternative shapes were both worse: a verb per status is a row in
every help text for every spelling of one transition, and a *did you mean* row is the redirect that
costs the second turn anyway.

So the class is bounded by what it is: a form names a thing the CLI can already do and adds no
capability. A word that would reach the tracker in a way no verb does is a verb, argued for on its
own; a word that only re-spells a flag is neither.

## The table is the order table's, and says so by having a row per status

The flow's own order table is what a status form performs *to*, so the forms are one row per status
something advances to — `open` having none, because nothing advances to where an issue begins. Two
statuses are outside that table and are the two exceptional forms: a disposition and a park are
reached by the advance verb's own flags, not by naming a target, so their rows carry the flag to
insert rather than a target to name.

`plugin/src/resolve/handler.mjs` imports nothing. That is not tidiness: the near-miss reader reads
this table, and the order table's own tree reads that reader, so an import back into the flow would
close a circle around the surface a caller reaches when they do not know the verb.

## Every refusal a form can earn is the verb's own

A form that made up its own refusal would be a second authority on the same rule, and the run that
hit it would be reading two answers to one question. So a park with nothing to park on, a
disposition on an issue that has landed, and a transition the record has not earned all print what
the advance verb prints — and the form's whole job is to arrive at that refusal with the arguments
that produce it. Two consequences are in the table rather than in prose:

- A kind is asked for by `--kind` everywhere else, so the park form translates that spelling instead
  of teaching a second one.
- A bare park must reach the verb's own refusal, not be completed into an ordinary move, so the row
  names the flag whose presence *stops* the insertion.

The one refusal a form owns is the one only a form can cause: a status form carries its target in
its own name, so naming a target as well is one question answered twice, and a parser taking the
last answer would have turned a close into a move somewhere else. That is refused before anything
runs, naming the verb that does take a target.

## Where the slot is, and what it is deliberately behind

The dispatcher's, after the retired-name refusal and ahead of the near miss. Behind the
retirement because a retired name that came back as a form would be the redirect the retirement
exists to prevent; ahead of the near miss because a word this CLI *runs* must not be answered with a
guess at what it meant.

A form never shadows a live verb — the lookup happens only for a word the command table does not
hold — so the table cannot quietly reroute a verb by gaining a row.

The availability checks are the subtle one. They sit between, and they judge **the verb that will
run** rather than the word that was typed: judged on the typed word, a form would walk past a
channel that is closed or a capability this credential is refused, and print a line for a verb it
was never going to reach. For the same reason a help ask on a form prints the target verb's help. A
form has no help of its own to print, and inventing one would put it on a surface it is not allowed
to appear on.

## One line, on stderr, naming what ran

The line is what makes this a performance rather than a silent rewrite: a run reading its own
transcript can see which verb answered. It goes to stderr because stdout is read by machines — a
form that prefixed a line onto JSON would break every caller that parses it — and it names the form
and the verb as a pair, because that pair is also the record `forge stats runs` counts a form off.

Counting is what keeps the table from growing on taste. A form is worth its row if runs type it, and
the profile says how often each was typed and read as what; a form nobody typed in a window is a row
to argue about with a figure. Nothing else in the CLI knows a form exists, so that line is the only
evidence there is, which is why the tally refuses a line whose pair the table does not hold.
