# Taking the four measurements

Nothing here names a runner, a flag or a directory. It names what the number has to be; finding the
switch that prints it is the runner's own documentation's job.

## What makes a timing worth comparing

Before and after are taken:

- on the same tree and the same machine, with nothing else competing for the cores
- with the caches in the same condition, said out loud: both warm or both cold
- past the first run of the day
- more than once when the two numbers are close: three runs, report the middle, never the best
- with any change-driven skipping switched off; a harness that skips what it already passed reports
  a time about its own record

State the machine's parallelism beside the numbers. A suite four times quicker on sixteen cores is
unchanged on the two a CI runner has, and that is a result to report.

## 1. The whole run, then every step alone

Time the gate the way the project spends it; then each step on its own, and add the parts up.

Where the sum and the whole disagree, the gap is a question. It can be orchestration the harness
pays for, a cache the second measurement found warm, a setup one run shared, or contention during
one of them. Chase it down before attributing it.

Where the harness prints per-step seconds, that is the measurement; a second clock disagreeing with
the first is a question nobody needed.

Read shares, not seconds. One step at three quarters of the run means the others are not worth
touching yet.

A run whose steps are all of a size is either many steps each doing real work, where the moves apply
to several in turn, or per-step overhead paid n times. Tell them apart by spending a step over a
trivial input and over the real one. Merging steps helps only in the second case.

## 2. The slowest units inside the slowest step

Ask the runner for a duration per unit. Where it will not say, time the units in a loop, noting that
the sum over-counts by one process startup each.

Read the result as a distribution: **the top few hold most of it**, and the moves apply to them one
at a time; or **it is flat**, and the answer is fewer, larger units, or a fixture built once.

A unit that surprises you earns a minute of reading before a change. One that sleeps, retries on a
backoff, waits out a timeout or reaches a network is slow for a reason the harness can often remove,
and is the unit most likely to break when run beside others.

## 3. What a run leaves behind

Size *and* count the temporary directory, every cache, build and fixture directory before and after
a full run. Two numbers because they fail differently: a filesystem runs out of inodes while
gigabytes are free.

Attribute the growth before calling it a leak: a package cache is supposed to grow, a fixture tree is
not. Growth that never comes back is reported even when the clock is unmoved.

## 4. The same work spent twice

Compare what each step *runs*, not what it is called. The cheap way is the step list beside the
processes one full run spawns; the reliable way is each step's own command, read.

## Keep the output, not a summary of it

Per-step timings, unit durations and before-and-after sizes go to a file, attached where the verdict
citing them lives. A transcript nobody can reopen is not a measurement.
