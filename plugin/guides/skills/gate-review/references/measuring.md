# Taking the four measurements

Written for a harness you have not seen. Nothing below names a runner, a flag or a directory: it
names what the number has to be, and finding the switch that prints it is the runner's own
documentation's job.

## First, what makes a timing worth comparing

A timing is a claim about one machine in one state, and the number is worthless unless the state
travels with it. So before and after are taken:

- on the same tree and the same machine, with nothing else competing for the cores. A gate timed
  while a build runs beside it measures the other build.
- with the caches in the same condition, said out loud — both warm or both cold. A cold-to-warm
  comparison shows a saving that belongs entirely to the file cache.
- past the first run of the day, which pays for downloads, an unread disk and a compiler that has
  seen nothing.
- more than once when the two numbers are close: three runs, report the middle, never the best.
- with any change-driven skipping switched off. A harness that skips what it has already passed
  reports a time about its own record rather than about the work, and the two runs would not even
  have spent the same steps.

State the machine's parallelism beside the numbers. A suite four times quicker on sixteen cores is
unchanged on the two a CI runner has, and that is a result to report rather than a caveat to bury.

## 1. The whole run, then every step alone

Time the gate the way the project spends it. Then time each step on its own and add the parts up.

Where the sum and the whole disagree, that gap is a question and not yet an answer. It can be
orchestration the harness pays for — process startup, an install, the reading of its own record —
and it can just as easily be a cache the second measurement found warm, a setup one run shared and
the other repeated per step, or contention that existed during only one of them. So chase it down
before attributing it, or measure spans inside the run rather than differencing two runs from
outside.

Where the harness already prints per-step seconds, that is the measurement. Take it instead of
re-timing by hand; a second clock disagreeing with the first is a question nobody needed.

Read shares, not seconds. One step at three quarters of the run means the other steps are not
worth touching yet, whatever they cost.

A run whose steps are all of a size is the harder case, and it does not settle itself. It may be
many steps each doing real work — no single win exists, and the moves apply to several steps in
turn — or it may be per-step overhead paid n times, each step spending most of its seconds starting
up and reaching for inputs. Which one it is comes from measuring a step's fixed cost against its
marginal cost: spend it over a trivial input and over the real one. Merging steps helps only in the
second case; in the first it buys nothing and spends whatever parallelism the steps had.

## 2. The slowest units inside the slowest step

Ask the runner for a duration per unit — a reporter that emits one per file, a flag that prints the
slowest few. Where it will not say, time the units individually in a loop, and note that the sum
now over-counts by one process startup each, which is exactly the overhead measurement 1 was after.

Read the result as a distribution:

- **the top few hold most of it** — those units are the work, and step 3's moves apply to them one
  at a time.
- **it is flat** — no unit is the problem. The cost is per-unit overhead, and the answer is fewer,
  larger units, or a fixture built once instead of once each.

A unit that surprises you earns a minute of reading before it earns a change. One that sleeps,
retries on a backoff, waits out a real timeout or reaches a network is slow for a reason the harness
can often remove without the unit noticing — and is also the unit most likely to break when run
beside others.

## 3. What a run leaves behind

Size *and* count the temporary directory before and after a full run, and do the same for every
cache, build and fixture directory the harness writes. Two numbers, because they fail differently:
a temporary filesystem runs out of inodes while gigabytes are still free, so a thousand small trees
is a defect no size measurement reports.

Then attribute the growth before calling it a leak. A package cache and a build cache are supposed
to grow; a fixture tree is not, and neither is anything named after a test. Growth that never comes
back costs the machine whether or not it costs the run seconds today, and it is worth reporting
even when the clock is unmoved — a gate that fills a mount is a gate that stops answering for
everyone.

## 4. The same work spent twice

Compare what each step *runs*, not what it is called: two steps whose names have nothing in common
can spawn the same compiler over the same files, and a step building an artefact a later step
rebuilds is the ordinary case rather than the exotic one.

The cheap way to find it is the step list beside a look at the processes one full run spawns. The
reliable way is to read each step's own command and write down what it actually invokes.

Duplicated work is the finding most worth having. It is pure loss: removing it changes no answer,
settles no argument about independence, and cannot make anything flaky.

## Keep the output, not a summary of it

The verdicts cite this. A transcript nobody can reopen is not a measurement, so the per-step
timings, the unit durations and the before-and-after sizes go to a file, attached where the verdict
citing them lives.
