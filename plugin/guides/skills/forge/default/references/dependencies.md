# An edge lives in two stores, and only one of them orders anything

Read this before answering what blocks what, and before trusting anything called a dependency.

**The tracker's own store is the one that orders.** An edge is written, removed and read back
through `forge issue`, whose `-h` names the flag for each kind, and only a blocking edge orders
anything. Before a count of relations is read as a count of blockers, read each edge's `expired`:
one whose `validUntil` has passed holds nothing up.

**A body's prose is the other store, and it gates nothing.** Some issues carry a sentence about their
own edges. `forge next --graph [ISS-nn]` prints the tracker's edges and then, under a heading of its
own, the claims found only in prose — one-sided claims marked as one-sided, and a phrase matching no
title, or tying two, printed unresolved rather than guessed. The sentence it looks for defaults to
English and is configurable per tracker with `deps: { marker, blockedBy, blocks }` in the project
file, which `forge doctor` names.

A body and the store can diverge either way — a sentence claiming an edge the store never got, an
edge no sentence mentions — so reading one proves nothing about the other. Where they disagree, the
store is what `forge advance` and `forge next` act on, and the prose is a claim somebody wrote.

**Which actions a credential may call is `forge doctor`'s to report**, and `forge issue -h` owns what
a write to an issue may send.
