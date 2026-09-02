# BRD §1 — The problem

← [Index](./README.md) · Next: [§2 Stakeholders](./02-stakeholders.md)

## What is wrong today

*What is the failure this product exists to answer?*

An agent works a tracker issue through a workflow of phases, and the only check that it did the
work was its own memory of having read the instructions. Nothing separated a status an agent had
*earned* from one it had merely set: a tracker transition succeeds whatever the issue holds. So an
issue could be declared done with an empty criteria field and a quality verdict that was false when
it was posted, and nothing on the record said so.

The split is measurable and it is not about diligence: one run of the workflow separated the
obligations with a gate behind them from the ones that lived in prose, and
`docs/issue-flow-contract.md` records which half held. Prose is read by whoever chose to read it.

## What it costs the developer

*Why can a person not simply look?*

Because the evidence was never written down where they could look. A session transcript nobody can
reopen is not an output. A screenshot on the implementer's disk proves nothing to a reviewer, and a
green test run says the plumbing survived rather than that the answer was right. A developer
reading the tracker sees a status and has no way to tell what it cost.

The same gap runs the other way. When a refusal *is* recorded, it is recorded to be argued with: a
gate that refuses too much is the failure mode of this product, and for months nothing wrote down a
single refusal, so the only false positives ever found were the ones somebody happened to watch
fail.

## Why a plugin, and not a project's own scripts

*Why does this belong outside the repository it guards?*

The rules that matter here are about *when and where* a rule fires — which tool routes are watched,
which directory is in scope, which write needs a second opinion. Those are the same in every
repository, and they cannot be a project's, because a project that has not adopted them has nothing
to fire. What good code is stays the project's, and this product refuses a shape and never a style.

A plugin also travels: it is installed into a cache copy and runs in repositories whose contents it
has never seen. That is a constraint on everything the product may assume, and
[06-constraints-assumptions.md](./06-constraints-assumptions.md) states it as one.
