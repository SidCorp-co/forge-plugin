# The moves

Four, roughly in the order they pay, and a fifth that is not one of them.

## Remove work spent twice

Two steps compiling the same sources become one, and the later step reads the artefact the earlier
produced. Pure loss when found.

**Hole one:** the second spend was not identical. Diff the two invocations *and* their outputs
before collapsing; matching commands over matching inputs can still differ by toolchain state,
environment, or something a step between them mutated.

**Hole two:** the rebuild *was* the check. A step building from nothing proves the build works from
nothing; reading a neighbour's artefact replaces that proof with a coupling. Collapse only where the
later step never relied on its own clean start.

## Run independent units at once

Independence is established, never assumed. What breaks it: a shared temporary path, one database,
a fixed port, a shared cache directory, the process's working directory, an environment variable one
unit writes, an order one unit depends on, a global the runner shares.

**The hole:** an intermittent pass. Proved by repetition at the new concurrency, with the number of
runs reported, never by one green run. A unit that cannot be made independent is pinned to run
alone, never dropped.

## Narrow what a step reads

A whole-tree step whose answer depends on part of the tree may read that part, and a change that
cannot reach it need not spend it.

**The hole:** a declaration narrower than the truth turns the step off in silence: it does not fail,
it is absent. Three rules:

- a path the declaration cannot place widens the run rather than narrowing it
- the declaration is read off the step's own command, not inferred from its name or output
- a change to the scoping machinery is itself inside the scope

Its proof cannot be a green run: `forge guide gate-review proving-it`.

## Build a fixture once, and be sure it goes

A fixture only ever read may be shared. One that is written is copied, rebuilt, or its writers
pinned to run in series.

Removal that depends on a handler is removal that does not happen: an interrupt, a kill or a crashed
runner runs no handler. What survives is a scheme the *next* run recovers from: leftovers
identifiable as this harness's, attributable to the process that made them, swept once it is gone.

**The hole:** a shared fixture one unit mutates makes every other unit's result depend on run order.

## Split a step so the cheap half fails first

Order the gate cheapest-first, so a run that is going to fail fails in seconds. It saves nothing on a
green run and much on the red ones.

**Declare the one thing it changes:** on a gate stopping at its first failure, reordering changes
which failure a rejected tree is told about. Same set of trees refused, different message; it goes in
the report.

**The hole:** the slow half quietly becomes optional. A gate spending the slow half only when asked
has raised a limit in a new costume.

## The fifth move, which is not one of these

Caching a step's result across runs needs a key covering every input the step reads; a key missing
one input makes the gate pass without having run, and the absence persists. Where a project already
has that machinery, use it. Introducing it is a change to the answer, and takes its own issue and its
own proof.
