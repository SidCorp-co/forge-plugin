# writes — what counts as one, for every gate that asks

Why: most edits arrive as `sed -i`, a heredoc or an interpreter opening a path, so a gate watching
tool routes sees a fraction of them.

After the call, the disk answers: a token naming a real file whose mtime is at or after this call's
request was written by it. The token is looked for in the command as written and again with a shell binding resolved
and a heredoc body's own assembly folded. A checkout stamps a tree, so young is not written.

Before the call there is only the text. A write verb counts in command position — a line's start,
after `;` `&` `|` `(` or `-exec`, an assignment prefix, or a wrapper (`sudo`, `env`, `xargs`, …). A
library call (`open(…, "w")`, `writeFileSync`) counts anywhere. Only a redirect names its target. A
variable takes an earlier command's assignment, not its own prefix, and `$(…)` is text.

To mention one without writing: out of command position — a `--name` value — or in a data heredoc.
A shell's `-c` body is code, so a write verb there counts.

Not judged: what the write contains, or whether it should happen.

Not seen: a name no spelling produces — a glob's match, a command's output, a variable set
elsewhere, an interpreter's inline `-c` assembly. Spell it, or reach for `Edit`.
