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

**A literal inside a program is data; the line that ran it is not.** The rules matched the whole
command, so a `python3` heredoc holding a refused command in a *string literal* was refused twice in
one session — the shell had nothing to run, and the developer could not reword their own line, which
is the shape the paragraph above says costs every refusal after it. The command is read through
`bodiless` first, as the write gates read it, and inside a body an interpreter executes, the quoted
literals are dropped.

Only there. A first version stripped every quoted span in the command, and codex named the cost: the
shell removes a quote and keeps what is inside it, so a quoted `--fix` stopped being seen — one real
bypass, shipped in 3.8.0 and closed the same day. The operator's own line keeps its quotes, and a
command handed to `bash -c` is refused because of that rather than because of a rule about `-c`. A
body that can hand a string to a shell — `subprocess`, `os.system`, `child_process`, `execSync`,
`spawnSync`, `shell=True` — keeps every literal, because a strip there would be the guard silently
not existing, and this is the one gate whose misses cannot be undone.

Two prices, both the safe direction. A commit message quoting a rule reads as the rule, and is one
re-word away. And the pairing is naive: prose apostrophes inside a body pair with each other, so a
quoted command can lose its quotes and be seen anyway. This document tripped that while being
written.

**A quoted flag is the flag.** A quoted `-A`, `--hard`, `stash` or `--fix` was allowed by every
version of this guard until codex read it — four patterns matched the flag directly and a quote in
front of it was enough. Each tolerates one now. The lesson is not about quoting: a rule that reads a
command as text is only as good as the shapes someone has actually tried, which is why this file has
a suite now.

