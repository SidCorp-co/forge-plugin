# polling — a wait that asks again is a turn spent asking

Why: poll-shaped waits cost one session 143 minutes over three days and another 1,344; and 11 runs
of 60 in a day spent 228 turns reading a log while it was written.

Three routes wait without asking: a timeout of the call's own, up to the shell's ten-minute cap; the
background completion notice, which has no cap and says the work ended, never what it decided; or,
where the work writes a verdict, the call that waits for that verdict and exits on it. Re-send with
the wait taken off; a lone `sleep` is untouched.

A wait also spreads over turns — the sleep taken out, one read of the log per turn — so an
identical read repeated with nothing done between is refused too: a `tail` showing a failure and a
`grep` chasing it are two questions.

Nothing here sees the notice arrive, so where the work has finished the read before this one came
too early: ask the finished log something else. It says this once and clears what it was made from
— one turn is all a wrong reading costs.

Not judged: how long the work takes, a `for` bounded by a count, a wait inside a body handed to
another interpreter, a file not named like a log, and the same read by another session. `--off
bash-guard` takes that gate's other refusals with it.
