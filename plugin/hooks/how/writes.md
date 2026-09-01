# writes — what counts as one, for every gate that asks

Why: most edits here arrive as `sed -i`, a heredoc or an interpreter opening a path, so a gate watching
the tool routes alone sees a fraction of them.

After the call, the disk answers: a token naming a real file whose mtime is inside the last breath was
written by it.

Before the call there is only the text. A write verb counts in command position — a line's start,
after `;` `&` `|` `(`, after `-exec`, an assignment prefix, or a wrapper that runs it (`sudo`, `env`,
`xargs`, `do`, `if` and the rest). A library call (`open(…, "w")`, `write_text`,
`writeFileSync`, …) counts anywhere.

To mention one without writing: keep it out of command position — a `--name` value, a commit message
— or inside a data heredoc. A `-c` body is run by the shell that takes it, so a verb inside
`sh -c '…'` is in command position and quoting is no route out, one body inside another included.

Only a redirect names its target, and one under `/dev/` writes nothing. A bare verb counts as inside
the tree. A variable resolves to the assignment before the use, a name holding another is followed,
`$(…)` is carried as text; what only looks like an assignment sets nothing.

Not judged: what the write contains, or whether it should happen.
