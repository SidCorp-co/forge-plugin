# codex-owed — the calls a project names wait for the reading the commit waits for

Why: over 437 runs the commit's consult demand landed after a gate 89 times of 154, a gate ran again
in 81 of those, and 230 gate minutes went on judging content the consult was about to move.

How to clear it: consult the files it names, then re-send — the same reading the commit asks for, in
the same words, so meeting it once meets both. `forge codex pending --drop` discards this
checkout's record whole, read or not; where a finding holds it, rule on it.

Which calls ask is the project's, in `codex.owed`: a list out of `gate`, `commit` and `ship`. The
key **absent** is `commit` alone, which is what this did before the key, so a tree that has not
decided is unchanged. An **empty list** asks at no door — that is the off switch, and it is a
different answer from leaving the key out. A name the list does not take is never guessed
at: it is refused at the first call reaching a door this project armed, and reported by
`forge doctor` either way.

Which command stands at each of those doors is the project's as well, in `stats.commands`: the
gate door fires at what that key names under `gate`, the ship door at what it names under `ship`,
and neither fires at anything else. A door named with no command under it is **unarmed** and holds
nothing — a value that is no command, an empty string or an empty list among them, arms nothing
either. This gate guesses no command for a repository it has never seen, and a guess is what a
refusal cannot afford. `forge doctor` names an unarmed door and the key that arms it. The commit
door is spelled by this plugin and is armed wherever it is named.

Naming the gate and not the commit buys one reading, early, and gives up this: a commit that never
went through a gate carries no demand at all.

`FORGE_CODEX_DISABLE=1` silences it with the rest of the review; for the session,
`forge hooks --off codex-owed`.

Not judged: whether the call should run at all, and whether what a consult would find is worth having.
