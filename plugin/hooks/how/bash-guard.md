# bash-guard — the shapes that lose work you cannot get back

Why: most refused shapes take something with nothing behind it — a process running for days,
uncommitted changes. `--fix` takes nothing, and is refused for answering the checker instead of the
code.

The refusal names the cause and the safer form. The rest:

Writing *about* a refused command: quoted literals inside a body an interpreter runs are data and are
dropped, so keep it there or assemble it from parts. Your own line keeps its quotes — `git add "-A"`
is the flag. A body that can reach a shell (`subprocess`, `os.system`, `child_process`, `execSync`,
`spawnSync`, `shell=True`) keeps every literal.

A refusal you believe is wrong: put it to the user. Rewording until the pattern misses teaches that
the guard is noise, and costs every refusal after it.

Not judged: every shape not listed, and the git rules on a clean tree. `git commit`, `git push` and
`rm -rf` are not here.
