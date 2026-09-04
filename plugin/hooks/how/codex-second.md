# codex-second — the second opinion actually happens, and is answered

Why: a commit landed after an hour of hook changes with codex not consulted once; later, 37 consults
whose findings nobody ruled on, and 7 of 30 commits with the turn's documents unread.

How to clear it: one consult — `--diff --only blocker,major`, with an intent — then re-send. For
findings nobody ruled on, `forge codex verdict --of <id> --accepted F1 --rejected F2=why`. `forge
codex pending --drop` discards them unread.

A commit is asked for what it stages, in the tree it names, which `forge codex pending` prints too.
One whose tree the command does not name — after a `cd -`, a bare `cd`, a destination held in a
value — is refused for that: spell it out, `cd <path> &&` or `git -C <path>`. A write stages nothing,
so the tree it lands in answers — in one too dirty to walk, only what the checkout recorded.
Consulting it clears it.

How to work through it: `forge hooks --off codex-second`, for the session. `FORGE_CODEX_DISABLE=1`
belongs to the session's environment; as a prefix on the refused command it reaches no hook.

The advisor's record lands seconds late: a write in the same breath is refused for it. Re-send.

Not judged: what the consult says, whether you take it, or a verdict's honesty.
