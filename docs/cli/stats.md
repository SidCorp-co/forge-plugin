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

## What the root is, and why no path is ever passed

The transcripts are the harness's, in its own scratch directory, and the directory is derived from
the project's absolute path rather than named by the caller: a flag that could name that directory
could name any directory, and this verb reads files a session wrote about work it did. So
`--project` takes a project directory and nothing else, and the only files opened are the ones a
fixed pattern one level under the derived root returns.

The obvious second guard — resolve each entry and refuse one that leaves the root — is the one thing
that must **not** be done here, and it is worth saying why, because it passes every test that uses a
fixture. The harness writes those entries as symlinks pointing back out into the session store under
the home directory. A containment check by resolved path therefore refuses all 121 of this project's
real transcripts and reports a clean, confident zero, while a fixture built from regular files goes
green. The refusal belongs at the argument, where a caller's input actually is.

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

## The parser this verb reaches for keeps any flag it is handed

So a mistyped `--since` profiled the whole corpus and said nothing about it. For a number meant to be
compared with next week's, a filter silently dropped is worse than a refusal, so a flag this verb
does not have is named back.

## The classifier, and three wrong rows it was built to avoid

The classifier is one table read top to bottom, and each of its three corrections is a row a hand
profile got wrong on this corpus:

- **A heredoc carries a document, not shell.** The criteria and plan files a run writes name
  `npm run check` inside their own text; read as commands, 423 of them were counted as gate runs
  that never happened. The body is cut before the line is classified.
- **A word after the binary's name is not a verb.** Taking it on trust turned prose into calls: a
  heredoc mentioning the tool minted a class named for whatever word came next, and a run that had
  put the binary behind a shell expansion minted one named for the expansion. What follows has to be
  a verb this CLI has, and the same verb reached by path and by name is one call and one row.
- **A bare space is not a command position.** Every row is anchored where a command actually
  starts — the beginning, or after one of the separators, with an assignment or a short list of
  leading words allowed in between. Read as a command position, a space made an echoed reminder into
  a record and a search argument into a claim, and each opened a phase the run had not reached.
- **A mention of a ship is not a ship.** A run waiting on one polls for the process by name; read as
  the invocation itself, that line moved every such run straight into its closing phase, which is
  what left the judging phase looking empty in the hand profile.

Two verbs earn a row per action, because their actions cost differently: a consult against a recheck,
and a verdict against the rest of the records. Every other verb is one row, or the guides alone would
be thirteen of them.

## The phase table

Phase boundaries are read off the first call of each kind, because no run writes a phase into its own
transcript — and off the **class** the call already carries rather than a second set of patterns, so
the two cannot disagree about what a call was. A phase already passed cannot pull a run backwards,
and the ship call is the last call of its own phase rather than the first of the next.

Each phase's minutes and calls are medians **over the runs that entered that phase**, with the count
of those runs beside them. A median over the whole window reports a phase most of it never reached as
costing nothing, which is the opposite of what it costs the runs that do reach it — and on this
corpus that read the judging phase as zero minutes and zero calls while a third of the runs were
spending five minutes there.
