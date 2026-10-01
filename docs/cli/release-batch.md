# Release batch

Why a release batch is readable and clearable from this CLI at all, what "holder" means where the
tracker keeps no such field, why a clear is gated on the tracker's own bounds reading rather than
on a threshold this CLI would have to invent, why a release that already shipped is recorded
rather than moved, and why a finish's verdict is read rather than waited for.

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

## A release that shipped is recorded, never moved

On a tracker that keeps a release step, the close from `awaiting_release` belongs to the release:
the tracker turns a run's own move to `closed` into a no-op there, and only its release path closes
anything. A run that deployed by hand, because the batch machinery was refused, was left with no
command that could say it had (ISS-1992). Twenty issues read as waiting for a release that was
already serving, and the only writes a run could make were a status it was not entitled to or
nothing.

The tracker's answer to that is a record of a release performed outside a batch — the commit, an
account of how it was done, and the provider's own handle where there is one — which it checks
against the deployment's declared probes and then closes through the same sanctioned path a batch
uses. `forge release-batch record` sends that record and nothing else. A status this CLI set itself
would be a second route around the gate, and the tracker would have no evidence behind the close.
Where no probe is declared, the tracker records the release as unverified and says so on every
issue, so an account standing alone is never read as a reading of production.

`start` and `finish` are the batch's own two doors, reachable here for the same reason: a run that
can only open a batch through a client it does not have cannot finish the release it was handed.
`method` and `attempts` stay out. They are the release agent's ledger protocol and not something an
operator calls.

## A finish is taken, and its verdict is read afterwards

The tracker takes a finish at the door and does the work in a job (ISS-1190 in the tracker's
repository): a door that verified and closed the whole roster before answering ran past the edge's
timeout on a six-issue batch, and the caller was cut off with nothing written. So the answer to
`finish` is the attempt as it stands when it was taken, and the verdict lands on the run later. A
finished batch is no longer the active one, which is why `status <runId>` reads a run by its id:
without it the one read that carries the verdict was the one a successful release made unreachable
(ISS-2114).

The CLI does not wait for the job. A wait needs a bound, and the job's length is roster-shaped, so
any number written here guesses at the next batch; the caller that wants the verdict asks for it,
and sending `finish` again while an attempt is in flight is answered by that same attempt. What the
exit says is the part no line can be left to say: a finish whose attempt ended `failed`, or one that
finished and could not close an issue, exits non-zero, because a release run that reads only the
status of its call would otherwise hand over a batch that did not close.

## A refusal carries every reason, not the first

The tracker refuses a release with the first reason it found and lists every other reason standing
beside it. A run told only the first clears it and meets the second on its next call, one round trip
per reason, which is what ISS-1127 in the tracker's repository recorded. So a refused write prints the
whole list, and `readiness` prints the same list before anything is sent.
