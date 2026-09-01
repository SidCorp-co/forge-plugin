# bash-guard — what cannot be undone, and what launders a finding

A rule in prose is read by an agent that decided to read it, and these are the cases where one missed
reading costs work nobody can reconstruct: a process the user has been running for days, or
uncommitted changes with no history to restore from.

`--fix` is the second kind. Nothing is lost — the rewrite is in git if the tree was clean — but the run
comes back green without anyone deciding which findings were real, the one outcome a checker exists to
prevent. So it is refused whatever the tree looks like, and the message names the single case where the
sweep is the point: adopting a formatting rule, which is the user's decision first.

It is deliberately narrow, because a guard that refuses too much gets disabled. Each pattern names one
command shape with a stated safer form, anything unrecognised is allowed through, and the git rules
bite only on a dirty tree, where any doubt counts as dirty. `pkill` selects by name rather than
identity, so its refusal asks for the pid.

**The way out is not a rephrasing.** A refusal states one safer form, and a case the guard reads
wrongly is a case to put to the user: a command reworded until it slips past teaches that the guard is
noise, which costs every refusal after it.

**A literal inside a program is data; the line that ran it is not.** Matching the whole command
refused a `python3` heredoc holding a refused command in a string literal — twice in one session, with
nothing for the shell to run. Inside a body an interpreter executes, quoted literals are dropped.

Only there. Stripping every quoted span cost one real bypass, which codex named: the shell removes a
quote and keeps what is inside it, so a quoted `--fix` stopped being seen. A body that can hand a
string to a shell — `subprocess`, `os.system`, `child_process`, `execSync`, `spawnSync`, `shell=True`
— keeps every literal, because a strip there would be the guard silently not existing.

Two prices, both the safe direction: a commit message quoting a rule reads as the rule, one re-word
away; and the pairing is naive, so prose apostrophes inside a body can expose a command, which this
document tripped while being written.

**A quoted flag is the flag.** A quoted `-A`, `--hard`, `stash` or `--fix` was allowed by every
version of this guard until codex read it. The lesson is not about quoting: a rule that reads a
command as text is only as good as the shapes someone has actually tried, which is why this file has a
suite now.
