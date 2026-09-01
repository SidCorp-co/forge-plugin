# writes — what counts as one, for every gate that asks

Why: most edits here arrive as `sed -i`, a heredoc or an interpreter opening a path, so a gate
watching the tool routes alone sees a fraction of them. Six gates decide by this one test.

How it decides, after the call: the disk answers. A path-shaped token naming a real file whose mtime
is inside the last breath was written by this call, which catches `sed`, `tee`, `cp` and a script that
opened a path it mentioned, none of them parsed.

Before the call there is only the text. A write verb counts in command position — start of a line,
after `;` `&` `|` `(`, after `-exec`, after an assignment prefix, or after a wrapper that runs it:
`sudo`, `env`, `xargs`, `time`, `do`, `then`, `if` and the rest. Library calls — `open(…, "w")`,
`write_text`, `writeFileSync`, `shutil.copy`, `os.replace` — count anywhere.

How to write a command that only *mentions* a verb: keep it out of command position, where a `--name`
holding `cp` and a commit message quoting `mv` sit, or inside a data heredoc, which is dropped whole.
Quoting alone is not the route: quotes are stripped for `bash-guard`, not here.

Only a redirect names its target, and one under `/dev/` writes nothing. A bare verb names nothing a
line can be read for, so it counts as inside the tree — a gate standing down on doubt is not a gate.
Variables resolve first (`H=/tmp/d` then `> $H/t.jsonl`); a value that runs a command is left alone.

Not judged: what the write contains, or whether it should happen. Each gate decides that itself.
