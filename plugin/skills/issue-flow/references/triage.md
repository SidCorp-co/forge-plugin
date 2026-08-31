# Deciding what an issue is, and working several at once

## What a disposition without code requires

It is earned by one of these: already fixed, duplicated by another, intended behaviour,
obsolete, or resting on a premise the repository disproves.

Post the evidence before the status moves — whoever reads it next inherits the verdict and
never the reasoning — and take it without asking, since anyone who disagrees can reopen it.

One issue that turns out to be two gets split, and each half names its sibling; a half that
does not reads as abandoned. Their dependencies decide the order.

## Batching

The shared build and smoke run is the whole saving, so what may travel together is issues
that are unblocked, touch the same module, and are proved by that one run. Name the members
and the reason on each.

Nothing else about the branch is shared: every member earns its own plan, criteria and QA
report, and each report lists its batchmates — someone reading one issue has to be able to
see what else rode along.

**Every commit stays independently removable**, which is the entire safety of the
arrangement. A member that fails its own criteria is dropped and parked, the gates re-run for
those left, and the run continues. A group that cannot shed one member is not a batch; it is
a single change wearing several issue keys.
