# An edge lives in two stores, and only one of them orders anything

Read this before answering what blocks what, and before trusting anything called a dependency.

**The tracker's own store is the one that orders.** `forge issue ISS-nn --blocks ISS-mm` writes an
edge there, `--relates ISS-mm` writes one that orders nothing, and `--unlink ISS-mm` removes whatever
edge the two have. `forge issue ISS-mm --fields relations` reads them back, under `blockedBy` for the
edges holding that issue up, `blocks` for the ones it holds up, and `relates` for the ones that order
nothing. One field is worth knowing before the list is read: `expired`, because an edge whose
`validUntil` has passed comes back with the live ones, so a count of relations is not a count of
blockers.

**A body's prose is the other store, and it gates nothing.** Some issues carry a sentence about their
own edges. `forge next --graph [ISS-nn]` prints the tracker's edges and then, under a heading of its
own, the claims found only in prose — one-sided claims marked as one-sided, and a phrase matching no
title, or tying two, printed unresolved rather than guessed. The sentence it looks for defaults to
English and is configurable per tracker with `deps: { marker, blockedBy, blocks }` in the project
file, which `forge doctor` names.

A body and the store can diverge either way — a sentence claiming an edge the store never got, an
edge no sentence mentions — so reading one proves nothing about the other. Where they disagree, the
store is what `forge advance` and `forge next` act on, and the prose is a claim somebody wrote.

**Which actions a credential may call is `forge doctor`'s to report**, and `forge schema forge_issues`
owns what a call may send.
