# codex-second — the second opinion is answered before the commit

Why: 37 consults made findings nobody ruled on, and 7 of 30 commits landed with the turn's own
documents recorded and never read.

How to clear it: one consult — `--diff --only blocker,major`, with an intent — then re-send. For
findings nobody ruled on, `forge codex verdict --of <id> --accepted F1 --rejected F2=why`. `forge
codex pending --drop` discards them unread. A document staged at a copy the disk does not hold is no
consult's to clear: `git add` it, or use `-a`.

A commit is asked for what it stages, in the tree it names, which `forge codex pending` prints too.
Both name the config directory they read. One whose tree the command does not name is refused for
that: spell it out, `cd <path> &&` or `git -C <path>`. A commit whose staged set cannot be
enumerated is asked for the record whole.

How to work through it: `forge hooks --off codex-second`, for the session. `FORGE_CODEX_DISABLE=1`
belongs to the session's environment; as a prefix it reaches no hook.

Not judged: what the consult says, whether you take it, a verdict's honesty, or a write between
commits — only a commit is asked. Not asked either: the bytes a consult was shown, or a path the
tree no longer holds and git reports no change of.
