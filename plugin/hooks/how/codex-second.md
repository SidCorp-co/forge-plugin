# codex-second — the second opinion actually happens, and is answered

Why: a commit landed after an hour of hook changes with codex not consulted once; later, 37 consults
whose findings nobody ruled on, and 7 of 30 commits with the turn's documents unread.

How to clear it: one consult — `--diff --only blocker,major`, with an intent — then re-send. The
refusal names the files, and the tree to send it from. For findings nobody ruled on, `forge codex
verdict --of <id> --accepted F1 --rejected F2=why`. `forge codex pending --drop` discards them unread.

A commit is asked for what it stages, in the tree it names: a file nobody staged is not its to
review, whoever wrote it, and `forge codex pending` prints the same set. A write stages
nothing, so the tree it lands in answers — and in one too dirty to walk, only what the checkout
recorded, every session in it and not yours alone. Consulting it clears it.

How to work through it: `forge hooks --off codex-second`, for the session. `FORGE_CODEX_DISABLE=1`
belongs to the session's environment; as a prefix on the refused command it reaches no hook.

The advisor's record lands seconds late: a write in the same breath is refused for it. Re-send.

Not judged: what the consult says, whether you take it, or a verdict's honesty.
