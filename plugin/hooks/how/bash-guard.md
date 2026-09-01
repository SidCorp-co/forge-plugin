# bash-guard — the shapes that lose work you cannot get back

Why: two harms, and the git rules only fire on a dirty tree. Most refused shapes take something with
nothing behind it — a process the user has run for days, uncommitted changes. `--fix` takes nothing,
and is refused anyway: it answers the checker by rewriting the source, and no finding was judged.

The refusal names the cause and the safer form. This is the rest.

**Writing *about* a refused command.** A quoted literal inside a body an interpreter runs is data and
is dropped, so a heredoc may hold one as a string. Your own line is not: `git add "-A"` is the flag,
quoted. So put a refused command inside an interpreter body, or assemble it from parts. A body that
can hand a string to a shell — `subprocess`, `os.system`, `child_process`, `execSync`, `spawnSync`,
`shell=True` — keeps every literal and is read as a command.

**A refusal you believe is wrong.** Put it to the user. Do not reword the command until the pattern
misses: a guard that can be talked past is noise on every refusal after it. Quote pairing here is
naive, so an apostrophe in prose can expose a command that follows it.

Not judged: every shape not listed, and the git rules on a clean tree. `git commit`, `git push`,
`rm -rf` are not here. It is deliberately narrow, because a guard that refuses too much gets switched
off, and each pattern has to name one shape with one safer form.
