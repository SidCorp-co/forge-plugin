# writes — what counts as one, for every gate that asks

Why: most edits here arrive as `sed -i`, a heredoc or an interpreter opening a path, so a gate watching
the tool routes alone sees a fraction of them. Six gates decide by this test.

After the call, the disk answers: a path-shaped token naming a real file whose mtime is inside the last
breath was written by this call.

Before the call there is only the text. A write verb counts in command position — start of a line,
after `;` `&` `|` `(`, after `-exec`, after an assignment prefix, or after a wrapper that runs it
(`sudo`, `env`, `xargs`, `time`, `do`, `then`, `if` and the rest). Library calls — `open(…, "w")`,
`write_text`, `writeFileSync`, `shutil.copy`, `os.replace` — count anywhere.

To mention a verb without writing: keep it out of command position — a `--name` value, a commit
message — or inside a data heredoc, which is
dropped whole. Quoting is not the route — quotes are stripped for `bash-guard`, not here.

Only a redirect names its target, and one under `/dev/` writes nothing. A bare verb counts as inside
the tree. Variables resolve first (`H=/tmp/d` then `> $H/t.jsonl`); a value that runs a command is
left alone.

Not judged: what the write contains, or whether it should happen.
