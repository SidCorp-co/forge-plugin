# Skill: harness-eval

One session judges the harness by what its own records say, and files what it finds. It writes no
code, changes no weight, threshold or prompt, and takes no lease: a number that moved is a pointer to
a change somebody landed, and the issue that landed it is where the reading goes.

**Arguments.** A project directory names the checkout whose runs are read; without one, the working
directory. A second argument naming a change — a release, an issue key, a prompt version — is the
thing the numbers are read against first.

## The three rules

1. **A figure is compared with its own earlier self, never with a target.** There is no number a run
   is supposed to cost; the only question is whether the latest fifty cost more or less than their
   predecessors, and why.
2. **Attribute before you judge.** A moved figure is explained by a difference between the windows
   — the copies installed, the prompt versions, the model behind the slot, the mix of tiers and
   efforts — and one that moved with the mix is the mix, not the harness.
3. **Thin is said, not smoothed.** A row resting on few runs on either side is reported as thin, with
   the counts, and no judgement is built on it alone.
4. **The numbers say where to look, not what to change.** A window that cost more is the start of a
   reading, and the reading goes to the transcripts, the guides and the gates the runs actually met.
   Room to save a round is found there, wherever it is, and not only under a figure that moved.

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

## Phase 2 — Attribute

The evals list the differences between the windows. For each one, find the change: the release
commits between the two windows' dates, the commit that moved a prompt version, the issue that moved
the reviewer's slot. `git log` over the window's span and `forge issue` on the keys those commits
name are the sources; a change the dispatcher named is read first.

Where the windows differ in mix — more feature-tier runs, a higher effort default — say so before
any harness figure is read, because the mix moves the medians on its own.

## Phase 3 — Judge, figure by figure

For each figure the evals print as moved, one of four readings, each with the two values and the
counts on both sides:

- **better** — moved the way the figure's own doc calls good, attributable to a named change;
- **worse** — moved the other way, attributable to a named change;
- **the mix** — moved with a shift in tiers, efforts or spanned releases, and the harness is not
  shown to have moved;
- **unattributable** — moved, and nothing named separates the windows on that axis.

A row the eval marks thin is reported with that word, whatever else is said of it.

## Phase 3b — Look for room the figures do not name

The profile keeps three listings the comparison does not compare: the refusals and errors by their
first line, the commands a run typed three or more times, and the single waits of ten minutes or
more. Read them for the recent window with `forge stats runs`, whose window is a span of time: take the
span the eval printed beside the window as `--since`. Read the consult side with
`forge codex stats`: where a review ran out of calls, where a reply gave up on part of the set,
where a recheck found nothing new to confirm. Each entry is a round somebody paid for; ask of each whether a guide sentence,
a refusal's wording, a default or a gate's scope would have saved it, and read that text before
answering.

The profile's `edits` line says which route the runs wrote files through and what a call on each
route carried, and its `ships` line says how many passes a landing took, how many were resumed and in
how many runs a push came back rejected. A route that carries twice another's characters for the same
kind of change, or a second pass per landing, is a saving with its count already beside it.

Then read what the runs read: the guide a run follows at the phase where its minutes went, the
refusal it met most often, the gate step that grew. A saving may sit in a sentence no figure points
at — a phase that asks for a read the previous one already made, a refusal whose route costs a call
to discover — and this phase exists to find those.

Every saving proposed is measured before it is filed: how many runs in the window paid it, and what
each paid, off the listings above. A proposal with no count is an opinion.

## Phase 4 — File, and report

A figure read as *worse* becomes a filing on the issue whose change it is attributed to, through
`forge comment`, marked `Size: fix.`, carrying the two values, the counts and the attribution. A
figure read as *better* is reported and not filed. Nothing goes to the knowledge store: what was
learned about a change belongs on that change's issue.

A saving Phase 3b found becomes a filing on the issue that owns the text or the check it names, or a
new enhancement where none does, carrying the count of runs that paid and what each paid.

Report one line per figure — what moved, which way, the reading, and the key filed if any — one
line per saving proposed with its count and its key, and one line naming what the windows were and
what qualified them.

## Reference material

| Read | At |
|---|---|
| `forge codex eval`, `forge stats eval -h` | Phase 1 |
| `forge stats runs -h`, `forge codex stats` | Phase 3b |
| `forge new -h` | Phase 4 |
