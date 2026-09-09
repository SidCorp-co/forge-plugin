# `stats` — what became of the work, beside what it cost

**Every figure the eval printed was a cost, and a cost is a figure an optimizer moves by making
runs worse.** A run that skips the consult, parks less and ships something wrong is cheaper on every
line of the profile. ISS-821 put something beside each of them that gets worse when the work does.
This topic is what each of those four figures claims, what none of them claims, the budget the
tracker reads behind them are held to, and the release mark a comparison since one change needs.
The eval they sit inside — its windows, its copy grouping and its own mark — is
[stats — the eval](stats-the-eval.md).

**The unit is a run and one issue, not an issue.** A dispatch may carry a batch and an issue may be
worked twice, so the eval derives per run the issues its own `forge claim` calls' output shows it
came to own, and each run-and-issue pair is one observation. Two runs owning one issue are two pairs,
which is what decides whose clock an outcome is measured against: runs of different age have
different follow-up intervals, and an outcome falls inside one and not the other. A pair carries no
cost, so an issue worked twice multiplies nothing above.

**Every ownership counts, not the fresh claim alone.** `claim`, `reclaim`, `renewed`, `take`,
`judged` and `reconciled` are all forms of coming to own an issue, and the recovery runs — the one
that took an expired lease, the one that took a handoff — are the runs whose outcomes matter most.
The reference has to be the printed line's own subject: a refusal reads `ISS-nn is claimed:` and a
`--next` line prints behind `Next: `, so neither can forge an ownership. A run with no ownership this
reading can establish is `unread` and stands in no figure — a run admitted by its brief alone is
unread by definition. A claim grants an issue by its key or by its id, so the reading resolves either
name to the one row, walks that thread once, and keys the pair on the row: one run that named one
issue twice is one observation, and two runs that named it differently are two owners competing for
the same record.

**Two figures are observed after the run and two during it, and the screen groups them so.** The
rates are not interchangeable.

| Figure | Read from | Counted over |
|---|---|---|
| reopened | a `finding` record dated inside the horizon after that run's end | pairs read and matured |
| criteria judged twice | more than one `verdict` record for one criterion, dated the same way | pairs read and matured |
| parked or dropped | a `park` record the pair's own run wrote | pairs read |
| consult findings rejected | the consult log, paired to the run's own ruling calls | findings ruled |

**The horizon is a common follow-up interval, not a minimum age.** An outcome counts only inside a
fixed interval after its own run's end, and a pair whose run has not finished that interval is in
neither after-the-run figure. Without that the older window has weeks in which to accumulate a
reopen and the newer one a day, and unchanged work reads as improved. An outcome landing later is
counted and named apart. `--horizon` sets it and the output names it.

**The parked figure is a record's claim and never a state.** Nothing here can establish what an
issue's state was when a run ended: the tracker's `activity` column answers empty on every issue, a
verdict written after a park does not un-park it, and a park record can precede a transition the
tracker refused. What it counts is a run that had to park — a round the harness cost, whether the
issue resumed or not — and the screen says as much on the line. Which run wrote a park is decided per
issue: among that issue's owners, the one whose own park-writing call the record landed inside, and
exactly one of them, or the record is disclosed as unattributed and counted for no pair. Both routes
that write the record are candidates, `forge record park` and `forge advance --park`/`--drop`, and
keying on the issue rather than the call is what lets one call that parked two answer for both. That
resolution is taken over the whole corpus before either window is cut, as the ruling pairing below
is: two owners either side of a boundary would otherwise each be the only candidate its own window
could see, and both would count the one record.

**The findings figure stands on its own unit and its own sources.** It counts findings, not pairs,
and it reads the transcripts and the consult log rather than the tracker — so a refused or
budget-stopped tracker read leaves it printed while the other three go unavailable. A ruling pairs to
the log by the `--of` the call names and otherwise by the log's own entry inside that call's span, and
the pairing is one-to-one **over the whole corpus, resolved before the windows are cut**: a
competitor outside the displayed windows still spoils a match, so `--size` cannot decide what paired.
Under a wave of concurrent runs most spans overlap and most calls therefore go unpaired, which the
screen prints as a count rather than hiding; a row of the log now says which run wrote it and this
pairing does not read that yet, which is why (ISS-853).

**`unavailable` is not zero.** A figure whose population is empty — no pair it could read, or no
finding ruled — prints `unavailable`; one with a population and no outcome in it prints `0` over that
population. Every figure prints what each window could not read and why, each reason said of the
window it is about, because two counts over different populations are comparable only as far as both
populations are printed. A thread read is whole only
where the tracker said so: an envelope silent about its own completeness is a prefix, and its pairs
go unread rather than counting as pairs with no outcome on them.

**No outcome figure names an issue, and none of them is a verdict.** Whether an adverse movement is a
regression is a judgement on mix, coverage and reasons, and that is the evaluator role's.

## The request budget, and what it buys

The read is scoped to the project the checkout declares, not to the one the shell stands in: a key
means one issue per project, so reading one project's runs against another's records would be a
figure about work nobody did. The whole eval has one budget, spent before every attempt, so a retry
and a nested project-id lookup each cost one. It walks the issue list once to map a reference to a
row, then reads one comment
thread per issue at a bounded concurrency; each attempt is bounded in time and sent once, which means
a transient failure can print `unavailable` where a retry would have answered. That is the trade: an
eval that may spend an unbounded number of requests against a reading that says where it stopped.
Past the budget the outcome figures go `unavailable` and every cost figure still prints, because a
comparison of cost is worth having on its own.

## Why a comparison since a release names what it is confounded by

Attribution by copy answers "which copy was installed" and not "which change did this". On
2026-09-09 the recent window held sixteen copies with one to eight runs each, so no release in it
carried enough runs to be told from the fifteen around it. The eval therefore learns a second kind of
mark: the release step writes one at **every** release, whatever the corpus count, carrying the
version and the head it landed at, and `--since-release [<version>]` puts that reading's recent
window where the sliding before would stand.

It is a kind of its own and not a second shape of the count mark, so a count mark goes on comparing
against the stored window it always has, and a release mark and a count mark written at one corpus
count resolve independently. A release is held by its version and never by that count — two can land
at one count, and keying on the count would discard the second and leave its version nothing to
resolve. `--against` takes the count a mark line printed and `--since-release`
takes a version, because one flag reading both would have to guess which a bare `3` was.

What that buys is disclosure and not isolation. Reading since a release prints the releases that
landed after it inside the window, the runs that saw a release land while they ran, and that a
dispatching session may still hold a role, a skill stub or a hook registration from an older copy —
because the alternative, an isolated observation window, means holding releases back to measure one.
A mark written by an older copy carries no outcome figures rather than zeroes, which is the same rule
`unavailable` states everywhere else here.

A mark is written with the cost figures alone and no tracker read. The ship must not spend a hundred
tracker requests per release, and a mark written where no credential resolves would take the release
down with it; so the stored side of a comparison says the outcome figures were not in that reading,
and the recent side computes them live.
