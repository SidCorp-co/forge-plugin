# landing-gate — under ship `ready`, the whole-tree gate is the landing's alone

Why: under `ready` the landing gates every change against the base as it then is, so a builder's
or a judge's run of that gate measures nothing the landing will not, and a guide line saying so did
not stop runs looping on it.

How to clear it: prove what this change moved with the suites that exercise the files it touched,
then hand the branch over with `forge claim <key> --pushed --ready`.
The landing's own gate runs as a child of its verb, which no hook sees, so nothing here holds it.

Which command is the gate is the project's, in `stats.commands.gate`, and which mode is the
project's `ship`. A tree at `self`, with `ship` unset, or with no gate declared is refused nothing.

The gate is matched by the script it runs, so a gate declared once as an npm script also covers
the node script that script runs, any path to it, and a launcher before it; no script is a gate
for its name.

A refusal you believe is wrong: `forge hooks --off landing-gate`, account-wide until `--on`.

Not judged: a narrower suite, a lint or a single test file, and a command whose tree cannot be read.
