# writes — what counts as one, for every gate that asks

Why: most edits arrive as `sed -i`, a heredoc or an interpreter opening a path, so a gate watching
tool routes sees a fraction of them.

After the call, the disk answers: a token naming a real file whose mtime is at or after this call's
request was written by it. A checkout stamps a whole tree, so young is not written.

Before the call there is only the text. A write verb counts in command position — a line's start,
after `;` `&` `|` `(`, after `-exec`, an assignment prefix, or a wrapper that runs it (`sudo`,
`env`, `xargs` and the rest). A library call (`open(…, "w")`, `writeFileSync`, …) counts anywhere.

To mention one without writing: keep it out of command position — a `--name` value — or inside a
data heredoc. A `-c` body is run by the shell that takes it, so a verb inside
`sh -c '…'` is in command position, nested or not.

Only a redirect names its target; one under `/dev/` writes nothing, nor does a verb aimed there
(`curl -o /dev/null`). A bare verb counts as inside the tree. A variable takes an assignment from an
earlier command, not its own prefix; a name holding another is followed, `$(…)` is text, and
what only looks like one sets nothing.

Not judged: what the write contains, or whether it should happen.
