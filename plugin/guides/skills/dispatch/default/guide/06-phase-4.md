## Phase 4 — Give each run its tree, and read the rest

One tree per run where more than one run shares a checkout. A judging run is given none: it
exercises what is deployed and writes no file.

Whatever else a run cannot learn for itself at its start, `forge brief ISS-nn --tree <its tree>` reads
now: what the other trees hold, uncommitted and committed, and whether the copy this session loaded
is older than the one installed. Leave out `--tree` for a run given no tree. A run whose files another
tree holds waits for that tree to land. When the brief says a restart is owed, the restart comes
before the dispatch.
