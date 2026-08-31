# bash-guard — what cannot be undone, and what launders a finding

Every rule here used to be a sentence in a skill. A sentence is read by an agent that decided
to read it, and these are the cases where one missed reading costs work nobody can
reconstruct: a process the user has been running for days, or uncommitted changes with no
history to restore from.

`--fix` is the second kind. Nothing is lost — the rewrite is in git if the tree was clean —
but the run comes back green without anyone deciding which findings were real, which is the
one outcome a checker exists to prevent. So it is refused whatever the tree looks like, and
the message names the single case where the sweep is the point: adopting a new formatting
rule, which is a decision to put to the user rather than a step to take.

It is deliberately narrow. A guard that refuses too much gets disabled, and a disabled guard
protects nothing — so each pattern names one command shape with a stated safer form, and
anything it cannot recognise is allowed through. The git rules only bite when the tree is
dirty, because there is nothing to lose otherwise, and any doubt counts as dirty. The
`--fix` rule is anchored on command position for the same reason a narrow guard survives: a
commit message or a doc line that quotes the flag is prose, and refusing it would teach the
agent to route around the guard rather than obey it.

A rule that selects by **name** rather than by identity is here for the same reason: a name matches
whatever else happens to carry it, including processes the user started days ago, so the refusal
asks for the pid and the one command that ends it.

**The way out is not a rephrasing.** A refusal states one safer form, and a case the guard reads
wrongly is a case to put to the user — a command reworded until it slips past teaches the agent
that the guard is noise, and that costs every refusal after it.
