# codex — the stats

What `forge codex stats` reads off the consult log, and why it is the log's one aggregation. What the
log holds and what makes anyone read it: [the log](codex-the-log.md). The eval over two windows:
[the eval](codex-the-eval.md).

**A harness with no numbers on itself is tuned by memory.** `forge codex stats` reads a window —
`--last n`, `--days n`, `--root p` or `--here` — and answers the questions a change to the harness is
judged by: how many consults ended at the budget they were given, how many replies said they could not
check, how many were retried at the ceiling, how many rechecks raised something New, the tokens by
kind, and which prompt versions ran. A row written before a field existed is counted from its own
reply, using the same predicate the field is written with, so the window before a change and the window
after it are read the same way rather than one of them looking clean for want of a column.

**`stats` is the one aggregation of the log, and `eval` is `stats` over two windows.** Two readers of
one set of rows, the per-model score and the window's stats, were caught copied from each other
mid-drift (ISS-327), so a group of rows becomes figures in one place whatever it was grouped by:
`--by model` and `--by prompt` print each group's findings, what was kept of them, its median and its
cache share beside its rechecks and budget, and the window left ungrouped prints the same figures
once for itself. The verdicts are the whole log's, as the eval's are, because a verdict lands after
its consult. `log --score` printed the per-model half over every consult the log held, and is now
refused with the `forge codex stats --by model --last <n>` that reads those same rows (ISS-349).

**An angle is kept only while its row says it pays.** The window prints one row per angle: how many
consults asked for it, how many findings sit under it, and how many of those the verdicts kept and
dropped. A finding is placed from the reply itself, because the log records which angles reviewed a
consult and not which angle raised each finding. With one angle, every finding is that angle's. On a
board, a finding belongs to the heading it sits under, which the prompt asks each angle to open with.
A finding under no heading goes in a row of its own and is never given to the first angle, since that
guess would move one angle's figure with another's findings. Kept and dropped are counted by id only.
A verdict written as counts says how many were kept but not which, so it rules on no angle's row.

**A pass and a recheck are two shapes of round, so `stats` prices them apart.** Each gets its own
count, cache share and calls histogram, read off the row's own `recheck`, which a pass leaves absent:
one cache figure over both kinds read rechecks shifting from three calls to one as the harness
caching less, when a one-call round reads no cache by construction (ISS-83). A retried consult is counted in its
kind's retried figure and in no bucket of its histogram, because its `calls` counted the retry
attempt alone until ISS-540 and the whole conversation after, and nothing on the row but its date
says which.
