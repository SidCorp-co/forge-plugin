# writes — what counts as one, for every gate that asks

Why: most edits here arrive as `sed -i`, a heredoc, or an interpreter opening a path, so a gate
watching the tool routes alone sees a fraction of them. Six gates decide by this one test, kept in
`plugin/hooks/`, since only that directory travels into an installed copy.

How it decides, after the call: the disk answers. A path-shaped token naming a real file whose mtime
is inside the last breath was written by this call, which catches `sed`, a heredoc, `tee`, `cp` and a
script that opened a path it mentioned, without parsing any of them.

Before the call there is only the text. A write verb counts in command position — start of a line,
after `;` `&` `|` `(`, after `-exec`, after an assignment prefix, or after `sudo`, `command`, `nohup`,
`time`, `env`, `xargs`, `do`, `then`, `else`, `if`, `elif`, `while`, `until`. Library calls —
`open(…, "w")`, `write_text`, `writeFileSync`, `shutil.copy`, `os.replace` — count anywhere, because
nothing else looks like them.

How to write a command that only *mentions* a verb: keep it in a data heredoc, or in quotes on your
own line. Both are dropped before matching, which is what a DNS query holding `cp` in a `--name` and a
commit message quoting `mv` needed.

Only a redirect names its target. A bare verb names nothing a line can be read for, so it counts as
inside the tree — a gate that stands down on doubt is not a gate. Variables resolve first, so
`H=/tmp/d` then `> $H/t.jsonl` is read; a value that runs a command is left alone.
