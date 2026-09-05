# `deps` — what the measurement decided

Only the marker sentence counts, and its trailing period separates the claim from prose about the
claim: ISS-11 says "those four edges are recorded here" mid-row about a different set. Measured
2026-08-27, "Blocked by" and "blocks the" each returned a strict subset of it. A phrase is ranked
against *every* issue, because an issue can be named as a dependent without saying anything itself.

One line per blocker, ASCII: on this tracker's nine edges, 595 bytes and 19 arrows became 180 bytes
and none — a box-drawing tree is fewer characters and more tokens. A literal NUL in the source once
made git read the whole file as binary: no diff, no blame, no `git grep`.

## The write is gated on an action, not on a tool

`forge dep` wraps `forge_project_pm set_dependency`, which the tracker gives to a paired device
alone, and `~/.config/forge/config.json` is documented to hold a personal access token. So the verb
is withheld rather than re-routed onto a second transport: two ways to write one edge is a
precedence rule and a report that has to explain which one ran.

The capability record it is withheld by is keyed `<tool>.<action>`, because the same tool answers
`snapshot`, `graph` and `runner_load` to the credential that cannot spend `set_dependency` —
gating the tool would take a printable schema and three working reads away to hide one verb. The
probe names the action and none of its ids: the credential class is checked before the arguments
are, so it stops there and writes nothing, and only a `PM_REQUIRES_DEVICE` refusal counts. Any other
refusal is the probe's own missing arguments, which is what a paired device gets back, and reading
that as a gate would hide the verb from the one credential it is for.

The read above and the write are therefore two stores: this graph is what the bodies claim, and the
tracker's own relations are set where an issue is filed (`forge new --with`, a `relates` edge) or by
the call a refusal hands over where the record demands a `blocks` edge.
