## Phase 4 — Give each run its tree, and read the rest

One tree per run where more than one run shares a checkout, and for the same reason one scratch
directory per run where the wave holds more than one. The host keys its scratchpad on the session
id, and each run a dispatcher sends carries the dispatcher's own, so that scratchpad, like anything
else keyed on the id, is the wave's and not the run's: two runs writing the obvious name for a plan
into it leave one plan, and neither is told.
The brief prints a run's own directory as `TMPDIR` where the project mints one; nothing typed beside
the brief can hand one over, so where it prints none the run makes its own. A wave of one shares
nothing and needs neither.

A judging run is given no tree, because what it judges is already deployed. It still writes files —
its captures — and in a wave of more than one they need a directory of its own like any run's.

Whatever else a run cannot learn for itself at its start, `forge brief ISS-nn --tree <its tree>` reads
now: what the other trees hold, uncommitted and committed, and whether the copy this session loaded
is older than the one installed. Leave out `--tree` for a run given no tree. A run whose files another
tree holds waits for that tree to land. When the brief says a restart is owed, the restart comes
before the dispatch.
