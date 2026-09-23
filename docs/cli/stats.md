# `stats` — measuring the flow instead of remembering it

**The measurement existed before the verb, twice, and neither copy survived its afternoon.** On
2026-09-04 and 2026-09-05 three throwaway scripts profiled 97 runs of this project and 58 of another
and found, among other things, that 58% of a run's wall time is model generation across a median 173
calls, that `forge record -h` had been typed 140 times, and that one project had spent 1344 minutes
in polling loops. Every one of those numbers was true once and could not be taken again: the scripts
were not in a repository, and no two of them counted the same way. That is what `forge stats runs`
is — the same reading, in the tree, with a case holding its arithmetic.

**One verb, one subject.** The next thing worth profiling is not runs, and a verb per subject widens
the surface faster than a subject per verb; `forge codex` had already settled that shape here.

## What the roots are, and why no path is ever passed

The transcripts are the harness's, and this verb reads two places for them. Both are derived from
the project's absolute path rather than named by the caller: a flag that could name a directory
could name any directory, and this verb reads files a session wrote about work it did. So
`--checkout` takes a directory and nothing else, and the only files opened are the ones a
fixed pattern one level under each derived root returns.

The obvious second guard — resolve each entry and refuse one that leaves the root — is the one thing
that must **not** be done here, and it is worth saying why, because it passes every test that uses a
fixture. The harness writes the scratch directory's entries as symlinks pointing back out into the
session store under the home directory. A containment check by resolved path therefore refuses all
121 of this project's real transcripts and reports a clean, confident zero, while a fixture built
from regular files goes green. The refusal belongs at the argument, where a caller's input actually
is.

**That symlink is also why the scratch directory is the thinner of the two.** It is on a temporary
filesystem, swept on reboot and between; the store it points into is not. Read through the scratch
directory alone, this project's corpus reached back four days and 110 runs while the store still
held 434 from twelve days earlier, and `stats runs` reported depth it had never looked at as depth
that was gone. So the store is read first and the scratch directory beside it, an entry both reach
is counted once by the path it resolves to, and each place prints what it held and what it added —
because a store swept an hour ago holds as few runs as a young project's, and only the two counts
side by side tell them apart (ISS-1578).

The slug is the project path with every non-alphanumeric character replaced. Both that and the
narrower reading — slashes alone — fit every slug on this disk; only this one survives a project
path with a dot in it.

## What a wait is, and what a run's clock is

A call's wait is the time from the call to its result. A call whose result never came waits **zero**
and is counted, on its own line, as unanswered. The three hand profilers took a different answer each
— zero, skip it, stretch it to the next call — which is the plainest reason none of their totals
could be read against another's. A run cut short mid-gate is the common case, and stretching that
call would inflate exactly the class that was interrupted.

**Two different figures, deliberately.** The wall clock is split into waiting and generating by the
*union* of the waiting intervals, because the harness issues several calls in one turn and they run
at once: summed instead, two ten-minute calls sharing one ten-minute interval report twenty minutes
of waiting inside a ten-minute run, which can put the tool share over 100% and make generation
negative. A class's own row is the plain sum of its calls — tool-seconds, and the row says so — since
a class's cost is what it spent, not what it spent alone.

A run begins and ends at the transcript's own first and last record, not at its first and last call:
the brief that opened the run and the report that closed it are generation the run spent. Window
membership is decided by that last moment and never by the file's modification time — the entries
being symlinks, a modification time is when the link was made, and a measurement that moves when
nothing moved is not one anybody can rerun.

## Which transcripts are runs

A subagent's transcript is an issue-flow run when its **brief** says so or when it took an issue's
lease. Matching the words anywhere in the file — which is what the hand profilers did — admits every
code-review angle agent that happened to read a file naming the skill: 27 of them on this corpus,
each counted as a run and each dragging the medians toward a thirty-call read that judged nothing.

The one transcript that is never a run is the session that dispatched them, which is why `stats
waves` reads the top-level files this reading skips: [stats — the waves](stats-the-waves.md).

## The parser this verb reaches for keeps any flag it is handed

So a mistyped `--since` profiled the whole corpus and said nothing about it. For a number meant to be
compared with next week's, a filter silently dropped is worse than a refusal, so a flag this verb
does not have is named back.

For the same reason `--json` answers in JSON on a week with no run in it. The empty-window sentence
is prose and once stood in front of the flag, so the one shape a two-week diff is written against
stopped being a shape on exactly the quiet week the diff is about — and the caller got a zero exit
with it. The zero-run profile is a profile, and it prints as one (ISS-308).

What each row of the profile is — the classifier and the wrong rows it was built to avoid:
[`stats-rows.md`](stats-rows.md); the refusals listing keyed by it:
[`stats-the-refusals.md`](stats-the-refusals.md). The phase table and the rung table:
[`stats-the-tables.md`](stats-the-tables.md).
