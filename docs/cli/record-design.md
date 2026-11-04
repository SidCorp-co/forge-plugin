# `forge record design` — the design the build gate holds the move on

A design is the one payload core gates the move into build on, and before ISS-28 this CLI had no
verb for it. A run met the gate only as core's refusal two statuses later — the design was owed at
build, and nothing here read it until core turned the move away (FB-33). The verb and
`advance --owed`'s reading of the gate are the two halves of the one fix: `advance --owed` names
the hold at the rung the build is next (`plugin/src/flow/earned/core-design.mjs`), and this verb is
how a run clears it.

## Why a verb, and not the raw PUT

The design is `PUT /issues/:id/design`, a strict object core holds in `@forge/contracts/issue-design`.
A run could type that JSON by hand, and the owed line pointed there until the verb existed. The
reasons it is a verb now are the reasons every other payload of this contract is: the shape had one
author per run, and a body typed by hand is refused by core a round later rather than by the parse
before anything is sent. The verb earns every shape rule here — a class that is none of the three,
a criterion with no proof, a criterion named twice, a flag standing before the first `--criterion` —
before the call goes out, so a refusal costs no round trip and names what to change.

## What the write replaces, and who it is held by

The write replaces the whole design the issue held and bumps its revision core-side; there is no
append. A project whose design gate is on `enforce` — `design_record` or `design_approved_for_build`
in its gate profile — holds the move into build until a design is recorded, and a project that has
not turned the gate on is never nagged for one (the gate is read per project, never assumed, as
every gate here is). So the verb records a design on any project, and only an enforcing project's
`advance --owed` says one is owed.

## Core owns what the verb cannot see

The class set — `observable`, `server_side`, `code_property` — is `machine.mjs`'s `DESIGN_CLASSES`,
the same three core's schema holds: who proves a criterion, which decides the judge it earns at the
test rung. Everything past the shape is core's: the module rule (`moduleScope.emptyAccepted` on the
design read says whether an empty module list is taken, or whether a labelled issue owes at least
one), and the trace rule that ties a criterion to its requirement. The verb sends the payload and
surfaces core's refusal (`DESIGN_REFUSED`, per path) rather than second-guessing either rule, because
both are the project's to set and this plugin fires in repositories it cannot see.
