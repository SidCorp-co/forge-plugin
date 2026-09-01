# writes — what counts as one, for every gate that asks

Not a hook: the shared test six gates read a write through, in `_hook.mjs`. Kept here because only
`plugin/` travels into an installed copy.

**Afterwards, the disk answers; before, only the text can.** A gate firing after the call — `claude-md`,
`code-quality` — asks which files exist with an mtime inside the last breath, and gets `sed`, a heredoc,
`tee`, `cp` and a script that opened a path it mentioned, without parsing any of them. A gate that must
refuse *before* the write has no such evidence, so it reads the command, and everything below is that
harder half.

Most edits in this repository arrive as an interpreter writing a file, or as `cat > file <<EOF`,
rather than through the `Write` tool — so `WRITES` covers the shell verbs and the library calls, and
`REDIRECT` covers the target. A redirect under `/dev/` writes nothing.

**A verb counts in command position; prose is not command.** Three false refusals in one session came
from one matcher: a DNS query whose `--name` held `cp`, a commit message quoting `mv`, and a codex
intent whose heredoc quoted `writeFileSync`. So the command runs through `bodiless` first and the
verbs are anchored — start of string or line, after `;` `&` `|` `(`, after `-exec`, after an
assignment prefix, or after `sudo`, `command`, `nohup`, `time`, `env`, `xargs`, `do`, `then`, `else`,
`if`, `elif`, `while`, `until`. That list is generous because codex found the narrow version missing
`MODE=fast cp a b`, `command mv a b` and `if cp a b; then`; `^` without `/m` missed `cd repo\ncp a b`,
the shape most commands here take. The library calls — `open(…, "w")`, `write_text`,
`writeFileSync`, `shutil.copy`, `os.replace` — need no anchor, because nothing else looks like them.

The two errors are not symmetric, and that sets the direction: a false refusal costs one consult, a
missed write is the gate silently not existing.

**Only a redirect names its target.** A write verb names nothing a line can be read for, so it counts
as inside the tree — a gate that stands down on doubt is not a gate. Variables are substituted first,
because `H=/tmp/d` then `> $H/t.jsonl` names the directory in no single token; a value that runs a
command is left alone, since substituting `$(mktemp -d)` once named a file after the command.
