# Release batch

Why a release batch is readable and clearable from this CLI at all, what "holder" means where the
tracker keeps no such field, and why a clear is gated on the tracker's own bounds reading rather than
on a threshold this CLI would have to invent.

## The gap this closes

A release batch that stops without finishing or aborting held a project's queue with no CLI-visible
handle: `forge -h` named no verb for it, and recovering one needed the tracker's MCP client. Two of
the four rules a dead batch's report asked for already landed in the tracker's own repository — the
in-flight precondition now asks whether the batch it found is alive, and a stranded roster is
recovered rather than left reopening issues that never lost their place. What stayed unmet is the
CLI-visible half: a checkout could still not see a batch running, nor clear one, without MCP
(ISS-1484).

## What "holder" is, given what the record holds

The tracker's own release-batch record carries a `runId`, when it started, its roster and a bounds
reading — never a process id or a device. Reporting one anyway would be inventing a field the
tracker does not keep, so the run id and its age are what answers "which one, and since when," and a
`forge_coolify.*`-shaped raw passthrough carries whatever the tracker adds to that record next
without this CLI reprojecting it.

## Why `clear` is gated on `bounds.holding`, and why `--force` is the only way past it

A batch that is still running and a batch that is dead read identically on every signal this CLI
used to have: an issue's own lease is free either way, because a release batch does not hold it for
its duration. Treating a free lease as proof of death was tried once and nearly cancelled a
legitimate release that went on to complete — the near-miss recorded on ISS-1486. The tracker's own
bounds reading exists for exactly this, measured off the release ledger rather than off a signal that
was never about the batch. So `clear` refuses a run the tracker does not yet call holding, and prints
the exact rerun with `--force` added rather than only saying no: the person reading it has seen the
same bounds this refusal is measured against, and a route through a refusal beats a wall every time
one is affordable. `--force` never buys past a `runId` a fresh read disagrees with — there is nothing
to force there, only a mistake to correct — and it never buys past a state naming no bounds reading
at all, a project with no probe channel configured included: a "not holding" `--force` overrides is
a measurement the tracker took and named; an absent one is nothing the tracker measured, so there is
nothing there for a person's own judgement to stand in for either.
