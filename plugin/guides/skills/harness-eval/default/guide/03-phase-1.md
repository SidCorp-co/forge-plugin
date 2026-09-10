## Phase 1 — Take the windows

Run both readers from the checkout the runs were worked in, or name it: `forge codex eval` for the
consult log, `forge stats eval` for the issue-flow corpus. Neither writes at your call. Take their
`--json` where a figure has to be quoted exactly, and keep the screen form for the shape of the
comparison.

Two comparisons, and the question decides which. The sliding one — the default — puts the latest
window against the one before it, and answers *what changed lately*. The pinned one, `--against
<mark>`, puts the latest window against the reading written when the corpus or the log last crossed
a mark, and answers *whether the change that landed since is better than the state before it*: the
before window is the same bytes every time you ask, so two readings a day apart compare against one
benchmark. `forge stats marks` and `forge codex marks` list what is held; `--against` alone takes the
newest. A pinned before may overlap the recent window, and the head says so when it does; read the
figures of an overlapping pair as a partial move, not a clean one.

Note what each says about its own completeness: a window short of full, a copy no longer in the
cache, a run that saw a release land. Those qualify every figure below them.
