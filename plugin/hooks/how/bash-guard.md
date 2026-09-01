# bash-guard — the shapes that lose work you cannot get back

Why: most refused shapes take something with nothing behind it — a process running for days,
uncommitted changes. `--fix` takes nothing, and is refused for answering the checker instead of the
code.

The refusal names the cause and the safer form. The rest:

Writing *about* a refused command: a rule is read where a command starts, so a phrase inside an
argument — `echo "…"`, a `grep` pattern, a literal in a body an interpreter runs — is prose. At a start
the quotes come off as the shell takes them off: `git add "-A"` is the flag. A body that can reach a
shell (`subprocess`, `os.system`, `child_process`, `execSync`, `spawnSync`, `shell=True`) has each of
its literals read as the command it hands over. A prefix reaches the verb — `sudo`, `xargs`, `-exec`,
a subshell, an assignment, a path — and both readings of a runner's options are offered, since whether
one took an argument cannot be known here: `sudo -u git stash` reads `git stash` as well.

A refusal you believe is wrong: put it to the user. Rewording until the pattern misses teaches that
the guard is noise, and costs every refusal after it.

Not judged: every shape not listed, and the git rules on a clean tree. `git commit`, `git push` and
`rm -rf` are not here.
