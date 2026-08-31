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

**A quoted span is an argument, not a command.** The rules matched the whole line, so a `python3`
heredoc holding `git add -A` in a *string literal* was refused twice in one session — the shell had
nothing to run, and the developer could not reword their own line, which is the shape the paragraph
above says costs every refusal after it. The command is read through `bodiless` first, as the write
gates read it, and then quoted spans are dropped.

Two exceptions, because a quoted string can become a command again. A span after `eval` or `-c` is
kept: `bash -c "git add -A"` runs it. And nothing is stripped at all from a body that can hand a
string to a shell — `subprocess`, `os.system`, `child_process`, `execSync`, `spawnSync`,
`shell=True` — because there the strip would be the guard silently not existing, and this is the one
gate whose misses cannot be undone.

Known and left: `git checkout "file.txt"` loses the evidence the rule reads (a quoted path with no
`--`), and `bash -lc` is not recognised as handing its argument to a shell. Both are narrower than
the false refusals they replace, and both are stated here rather than discovered.

