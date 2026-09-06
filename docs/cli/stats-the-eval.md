# `stats` — the eval, and the line that says to run it

**The profile answered one window, and nobody could say whether the next release made it better.**
A hundred and fifty dry runs were folded by hand into a journal, one dated section each, and every
question of the form "did that guide change make runs cheaper" was answered from the feel of the last
few. The codex harness had already stopped doing that (ISS-310): its log says when to look at itself,
and the look is two windows side by side. This topic is the same arrangement for the flow the harness
serves, and the reasons it takes the shape it does.

## Why the eval adds no figure of its own

Every number the comparison prints is one the profile already computes over a list of runs. A window
is a slice of the corpus and a group is a filter over a window, so both are handed to the same reader
the screen uses. The alternative — a second reader with its own arithmetic for the comparison — is
two copies of every median, and the day either moves the two disagree about what a run cost. The
comparison therefore holds no measurement the profile lacks, and a figure added to the profile is in
the eval the same day with no second change.

## Why a window is fifty runs, ordered by the run's own last record

Fifty is what this device had two of when the verb was written, and the trigger's arithmetic wants
the window to be the same number it counts to. The order is by each run's last record and not its
first, because the comparison is of cost and a run's cost is known when it ends. A run that parked or
was dropped is a run: it spent its minutes and calls as fully as one that closed, and a window that
kept only the closed ones would flatter every release that parked more.

Two windows are adjacent and never overlap. When the corpus holds fewer than two full windows the
earlier one is compared as far as it reaches and the shortfall is printed beside it, because a window
padded or silently shortened reads exactly like a full one.

`--json` prints the comparison as one object — `size`, `total`, `now`, `before`, `moved`, `shifts` —
and each window is its `runs`, its `profile` and its `groups` by copy. Nothing in it can be derived
from another field: the bounds are the profile's and the shortfall is the size less the runs, so a
reader that parses it holds one spelling of each figure and the screen computes the rest where it
prints (ISS-492). `forge codex eval --json` answers in the same outer shape — `size`, `total`, `now`,
`before`, `shifts` — each window its `consults`, its `stats` and its `groups` per model, effort and
prompt, a group carrying its `score`, its `stats` and how many rows were `timed` and `metered`; the
two readers the harness-eval method names take the same argument and are quoted the same way
(ISS-484).

## What the copy installed at a run's start fixes, and what it does not

No transcript records the plugin version it ran under, and the device does. Each installed copy is a
directory under the plugin cache, and the directory's creation time is the moment it arrived; the
copy a run began under is the newest one created before the run's first record. That copy fixes the
guide text the run's calls were served, the CLI they ran and the gates that judged them — all three
are chosen per call from the copy on the path — until the next install. So the grouping is labelled
*the copy installed at the run's start* and never "the version the run followed": a run whose span
holds an install ran the newer copy after it, and the eval counts those runs rather than filing each
under one copy.

What it does not fix is the frozen set. A role definition, a skill stub or a hook registration reaches
a session at its next start, so the dispatching session may have loaded those from an older copy than
the one the run's calls used. That is why the copy is one dimension of what separates the windows and
not a verdict on which text a run followed.

A run older than every copy the cache still holds is grouped as unrecorded rather than under the
oldest copy present, and the screen folds copies with fewer than three runs on either side into one
line — on this device a release lands about every half hour, so most copies carry one or two runs —
while the JSON keeps every group.

## Why the ship prints the mark, and nothing remembers it

The consult that crosses a hundred-mark names the codex eval, and the run whose landing brings this
project's corpus to a multiple of fifty names this one, from the release step that already prints
what the release cost the gate and whether a reading is owed. The count is read off the corpus at
that moment and written nowhere: a file that remembered the last crossing is a second copy of a
number the transcripts already hold, wrong the first time a transcript is lost. The count is this
project's and not the device's, because the corpus root is derived per project and the ship runs
inside one.

## Why a role on the strongest model reads the result

The eval's output is the half no gate reaches: whether a figure that moved means the harness moved,
or the mix of work moved under it, is a judgement over evidence and not a diff. So the reading is a
dispatched role, defined beside the runner and the reviewer, on the strongest model the host offers,
with a method served the way every skill's is. Its method is what `forge guide harness-eval` prints,
and the method does not stop at the figures: the profile's own listings of refusals, repeated
commands and long waits, and the guides the runs followed, are where a saving is found, so the role
reads those wherever the numbers point and files what it finds with the count of runs that paid.
Its report is one line per figure and one per saving, and what it files lands on the issue that
owns the text or the check.
