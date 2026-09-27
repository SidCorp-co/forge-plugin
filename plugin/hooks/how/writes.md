# writes — what counts as one, for every gate that asks

Why: most edits arrive as `sed -i`, a heredoc or an interpreter opening a path, so a gate watching
tool routes sees a fraction.

After the call, the disk answers: a named file stamped at or after the call's request, read as
written and with bindings resolved. Where the text claims none, the tree must also differ from HEAD:
a `git checkout` restamps what the next word only names. Where git cannot say, the stamp stands
alone.

Before it, the text does. A write verb in command position — a line's start, after `;` `&` `|` `(`
or `-exec`, an assignment prefix, or a wrapper (`sudo`, `xargs`, …) — counts every name in its
command, a pipeline being one; a redirect, its own target alone. A library call (`open(…, "w")`,
`writeFileSync`) counts anywhere. A variable takes an earlier command's assignment, not its own
prefix; `$(…)` is text.

To mention one without writing: out of command position (a `--name` value), in a data heredoc, or
quoted with a space, quote or bracket; a `-c` body is code, so a verb there counts.

Not judged: what the write contains, or whether it belongs.

Not seen: a name no spelling produces — a glob's match, a command's output, a variable set
elsewhere. Spell it, or reach for `Edit`.
