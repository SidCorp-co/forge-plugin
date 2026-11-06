# The brief each dispatched run is sent

The wave's method is core's page, `forge guide dispatch`. What this plugin adds to a dispatch is the
message: `forge brief` generates it from the record, so nothing a run needs at its start is typed by
hand, and its `-h` carries every flag.

| The run | Its message |
|---|---|
| A builder, in a tree of its own | `forge brief ISS-nn --tree <its tree>` |
| A builder taking a batch on one branch | `forge brief ISS-nn --batch ISS-mm,ISS-kk --tree <its tree>` |
| A judge of a deployed change | `forge brief ISS-nn --judge --url <where the deployment answers> --criteria <the numbers it judges>`, with `--identity` where the record holds one |
| A judge of an installed program | `forge brief ISS-nn --judge --program <path> --criteria <numbers>`, `--tree` naming where to run it |
| A judge of a requirement's criterion | `forge brief --requirement REQ-nn --criterion BC-n --url <where the deployment answers>` |

A judge is given no tree, because what it judges is already deployed; it still writes captures, and
in a wave of more than one they go to a directory of its own. The brief prints a run's own
directory as `TMPDIR` where the project mints one, and where it prints none the run makes its own.

Whether the copy this session loaded is behind the installed one arrives on standard error beside
the brief and never in it, because only this session can restart. When that line says a restart is
owed, the restart comes before the dispatch.
