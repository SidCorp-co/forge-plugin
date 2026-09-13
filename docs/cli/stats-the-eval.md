# `stats` — the eval, and the line that says to run it

**The profile answered one window, and nobody could say whether the next release made it better.**
A hundred and fifty runs were folded by hand, one written account each, and every
question of the form "did that guide change make runs cheaper" was answered from the feel of the last
few. The codex harness had already stopped doing that (ISS-310): its log says when to look at itself,
and the look is two windows side by side. This topic is the same arrangement for the flow the harness
serves, and the reasons it takes the shape it does.

## Why every cost figure is the profile's, and why no outcome figure can be

Every **cost** the comparison prints is one the profile already computes over a list of runs. A window
is a slice of the corpus and a group is a filter over a window, so both are handed to the same reader
the screen uses. The alternative — a second reader with its own arithmetic for the comparison — is
two copies of every median, and the day either moves the two disagree about what a run cost. So a
cost figure added to the profile is in the eval the same day with no second change.

No **outcome** can come that way, and for one reason: the profile reads transcripts and nothing else,
and what became of an issue is on the tracker. `stats runs` keeps that rule — it sends the tracker no
request and prints no outcome — so the four outcome figures are the eval's own, computed by
`outcomes.mjs` and by nothing the profile can be asked for.

What those four claim, and the release mark a comparison since one change needs, is
[stats — the outcome](stats-the-outcome.md).

## Why a window is fifty runs, ordered by the run's own last record

Fifty is what this device had two of when the verb was written, and the trigger's arithmetic wants
the window to be the same number it counts to. The order is by each run's last record and not its
first, because the comparison is of cost and a run's cost is known when it ends. A run that parked or
was dropped is a run: it spent its minutes and calls as fully as one that closed, and a window that
kept only the closed ones would flatter every release that parked more.

Two windows are adjacent and never overlap. When the corpus holds fewer than two full windows the
earlier one is compared as far as it reaches and the shortfall is printed beside it, because a window
padded or silently shortened reads exactly like a full one.

The shortfall alone was not enough. Printing what was selected leaves the reader to decide whether it
was evidence, and this project's corpus fell from seventy runs to two inside ninety minutes on
2026-09-12, after which eighteen releases were marked against a window that never filled and not one
of the marks said so. So either window falling short of the size is also **judged**, in a line that
says the reading is not a comparison and what bounded it — and the bound is read off the marks rather
than off the store, because a store swept an hour ago holds as few runs as a young project's and only
a reading taken when it was deeper separates them. That reading says depth was once here and is gone;
it never says why, and where none is held it says the record is silent rather than that the corpus was
never deeper. `forge stats runs` reports the same reach over the whole corpus, before a comparison is
taken off it, and reports none under `--since`, where the floor is the flag's own boundary (ISS-1328).

Two things about how the record is read. **Both kinds of mark are searched**, count and release
alike: a count mark is written only at a multiple of the window, so between two crossings the release
marks are the only readings there are, and on this project they outnumber the counts about twenty to
one. **And a mark is read for the corpus floor it carries, not the floor of its own window** — a
window on a deep corpus begins long after the corpus does, so a mark read by its window alone hides
most of the depth it was taken over. A mark written before the reading carried a corpus floor is read
by its window floor instead, which is later than the corpus reached and so understates how much depth
is gone. Understating it is the safe direction: the reading claims only depth somebody demonstrably
read, and never invents a loss.

`--json` prints the comparison as one object — `size`, `total`, `now`, `before`, `comparability`,
`moved`, `shifts` —
each window its `runs`, `profile`, `groups` by copy and `outcomes`. Nothing in it can be derived from
another field: the bounds are the profile's and the shortfall is the size less the runs, so a reader
holds one spelling of each figure and the screen computes the rest (ISS-492). `comparability` is the
exception the mark earned — the judgement rides on the record because the corpus it was taken against
cannot be asked later what it held. `forge codex eval --json` answers in the same outer shape, each window its
`consults`, its `stats` and its `groups` per model, effort and prompt; the two readers the
harness-eval method names take the same argument and are quoted the same way (ISS-484).

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

Three runs is also the floor a median is worth printing above. A copy listed because one side has
runs to count prints, on its thin side, that count and no median; a whole window under the floor
prints insufficient evidence in place of every median it would otherwise carry. A median of two runs
is a number that reads like a finding and is one run's accident.

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
