# codex-second — the second opinion is answered before the commit

Why: 37 consults made findings nobody ruled on, and 7 of 30 commits landed with the turn's own
documents recorded and never read.

How to clear it: one consult — `--diff --only blocker,major`, with an intent — then re-send. For
findings nobody ruled on, `forge codex verdict --of <id> --accepted F1 --rejected F2=why`. `forge
codex pending --drop` discards them unread.

A commit is asked for what it stages, in the tree it names, which `forge codex pending` prints too.
One whose tree the command does not name — after a `cd -`, a bare `cd`, a destination held in a
value — is refused for that: spell it out, `cd <path> &&` or `git -C <path>`. A commit whose staged
set cannot be enumerated is asked for the record whole.

How to work through it: `forge hooks --off codex-second`, for the session. `FORGE_CODEX_DISABLE=1`
belongs to the session's environment; as a prefix on the refused command it reaches no hook.

Not judged: what the consult says, whether you take it, a verdict's honesty, or anything a write
between commits does — only a commit is asked.
