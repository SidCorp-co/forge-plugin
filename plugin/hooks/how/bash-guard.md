# bash-guard — the shapes that lose work you cannot get back

Why: most refused shapes take something with nothing behind it — a process running for days,
uncommitted changes. `--fix` takes nothing, and is refused for answering the checker instead of the
code.

The refusal names the cause and the safer form. The rest:

Writing *about* a refused command: a rule is read where a command starts, so a phrase inside an
argument — `echo "…"`, a `grep` pattern — is prose. At a start the quotes come off as a shell takes
them off: `git add "-A"` is the flag. A body reaching a shell by a name its own language has —
python's `subprocess`, node's `execSync` — has its literals read as commands; an unnamed runner
counts them all, and a shell's body is commands whatever it names. A prefix reaches the verb:
`sudo`, `xargs`, `-exec`, a subshell, an assignment, a path, and both readings of a runner's
options.

A refusal you believe is wrong: put it to the user. Rewording until the pattern misses teaches that
the guard is noise.

Not judged: every shape not listed, `git add -A` under a pathspec, and the git rules on a clean
tree, bar a stash where a second worktree shares the stack — named with `-C`, against a `cd` before
it, else the shell's. `git commit`, `git push` and `rm -rf` are not here.
