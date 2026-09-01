# claude-md — a claim CLAUDE.md makes that the repository does not bear out

Why: that file loads into every session, and a renamed path or a dead script reads as fact to an agent
with no reason to doubt it. Nothing fails loudly, so it is checked at the write — nobody suspects a
sentence they have just typed.

How to clear it: correct each claim it names, or delete it. Deleting is a real answer — the file the
claim names is the authority. Then re-send the edit.

The kinds are settled by a command rather than by taste: a path that does not exist, an npm script no
`package.json` holds, a `-h` a script does not handle, a tool not on PATH, an unresolvable git ref, a
file said to be absent that exists, a sha that is no ancestor of HEAD, an identifier cited nowhere
else. Only backticked spans and link targets count, so prose naming a file is not a claim, and shapes
that produced only false positives over 28 real files — a CIDR block, a date mask, a bare extension —
are excluded first.

Only claims *this write* introduces are refused: the baseline is `git show HEAD:CLAUDE.md`, so the
edit that fixes an inherited file always lands.

Not judged: whether the rule belongs in CLAUDE.md at all, whether a guide already says it, whether
a checker already enforces it. Those are judgements about prose, and `forge doctor` raises them where
a human is reading.
