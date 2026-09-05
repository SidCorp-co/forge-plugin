# The moves

Four, roughly in the order they pay.

## Remove work spent twice

Take this one first: it is the cheapest to find and the easiest to argue for. Two steps compiling
the same sources become one, and the later step reads the artefact the earlier produced.

**The first hole:** the second spend was not identical. One of the two ran a different
configuration, a different input set or a stricter mode, and the one you kept is the looser. So
before collapsing them, diff the two invocations *and* their outputs — matching commands over
matching inputs can still differ by toolchain state, by environment, or by something a step
between them mutated.

**The second hole:** the rebuild *was* the check. A step building from nothing proves the build
works from nothing; make it read a neighbour's artefact and that proof is gone, replaced by a
coupling — the step now fails when its neighbour's output is stale and passes when the two are
wrong the same way. Collapsing is safe only where the later step was never relying on its own
clean start.

## Run independent units at once

The largest saving in most suites, and the one that turns a gate flaky when it is wrong.

Independence is a property of the units and has to be established rather than hoped for. What
breaks it: a shared temporary path, one database, a fixed port, a shared cache directory, the
process's working directory, an environment variable one unit writes, an order one unit depends on,
and a global the runner shares between units it believes are separate.

**The hole:** an intermittent pass. Two units sharing state fail together occasionally and pass
together most of the time, and a gate that reddens one run in twenty is a gate people re-run rather
than read — which costs more time than the parallelism saved and loses the refusal as well.

So this is proved by repetition, never by one green run: the suite spent several times at the new
concurrency, with the number of runs reported. A unit that cannot be made independent is pinned to
run alone, never dropped — a serial exception costs its own seconds and keeps the case.

## Narrow what a step reads

A whole-tree step whose answer depends on part of the tree can read that part, and then a change
unable to reach it need not spend it.

The dangerous half is the declaration. Whatever a step is *said* to read decides when it is spent,
so a declaration narrower than the truth turns the step off in silence: it does not fail, it is
absent, and a tree it would have refused passes. That is invisible in every direction — the run is
green, the step is not in the output, and nobody reads a list of what did not run.

Three rules make it safe:

- a path the declaration cannot place widens the run rather than narrowing it, so an unplaced file
  costs time and never coverage
- the declaration is read off the step's own command, not inferred from its name or its output
- a change to the scoping machinery is itself inside the scope, so a run editing the rules cannot
  be narrowed by the rules it is editing

A narrowed step is the one move whose proof cannot be a green run, so it has its own procedure in
`forge guide gate-review proving-it` and nothing here repeats it.

## Build a fixture once, and be sure it goes

Two costs hide here, pulling in opposite directions.

**Building the same fixture per unit** is one cost paid n times. Sharing removes it and pays in
independence: a fixture only ever read can be shared safely, while one that is written has to be
copied, rebuilt, or its writers pinned to run in series.

**Not removing the fixture** is the other, and it is no speed-up at all — it is a defect the timing
measurement happens to find. Removal that depends on a handler is removal that does not happen: an
interrupt, a kill or a crashed runner runs no handler, so a scheme trusting the last run to tidy up
leaks every time a run is cancelled. What survives that is a scheme the *next* run can recover from:
leftovers identifiable as this harness's, attributable to the process that made them, and swept
once that process is gone.

**The hole:** a shared fixture one unit mutates makes every other unit's result depend on the order
they ran in — the intermittent pass again, arriving by a route the concurrency change did not open.

## Split a step so the cheap half fails first

A step doing something cheap and something expensive under one name makes every failure wait for
the expensive half. Split it, and order the gate cheapest-first: a run that is going to fail should
fail in seconds.

Worth stating because it saves nothing on a green run — the same work is spent either way — and
saves a great deal on the red ones, which are the runs somebody is actually waiting on.

**It does change one thing, and that has to be declared.** On a gate stopping at its first
failure, reordering changes *which* failure a rejected tree is told about. The set of trees refused
is identical; the message a developer reads is not. That is a change to the diagnostic rather than
to the answer, so it is allowed — but it goes in the report, because anyone comparing refusal
messages across the change will otherwise read it as a step that broke.

**The hole:** the slow half quietly becomes optional. Splitting is not skipping, and the test is
whether the slow half is conditional on the fast half's *verdict*. A gate spending both halves in
turn until one fails is the same gate; a gate spending the slow half only when somebody asks for
it has raised a limit in a new costume.

## The fifth move, which is not one of these

Caching a step's result across runs is real, and harder than everything above: it needs a key
covering every input the step reads, and a key missing one input makes the gate pass without having
run — the same silent absence as an under-declared scope, but persisted, so it survives until
somebody notices the step has been green for a month.

Where a project already has that machinery, use it. Introducing it inside a speed review is a
change to the answer wearing a change to the harness, and it deserves its own issue and its own
proof.
