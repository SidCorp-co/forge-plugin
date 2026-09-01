# claude-md — a claim CLAUDE.md makes that the repository does not bear out

Why: that file loads into every session, so a dead path or script is read as fact. Nothing fails
loudly, which is why it is checked at the write rather than by `forge doctor` later.

How to clear it: correct each claim it names, or delete it — the file a claim names is the authority.
Then re-send the edit. Only claims this write introduces are refused; the baseline is
`git show HEAD:CLAUDE.md`, so the edit that fixes an inherited file lands.

Each kind is settled by a command: a path that does not exist, an npm script no `package.json` holds,
a `-h` a script does not handle, a tool not on PATH, an unresolvable git ref, a file said to be absent
that exists, a sha that is no ancestor of HEAD, an identifier cited nowhere else. Only backticked
spans and link targets count, so prose naming a file is not a claim.

Not judged: whether the rule belongs there, whether a guide already says it, whether a checker already
enforces it. `forge doctor` raises those, where a human is reading.
