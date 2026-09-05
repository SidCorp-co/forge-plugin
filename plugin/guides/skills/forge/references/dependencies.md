# `forge deps` reads prose, not the edge store

Read this before answering what blocks what, and before trusting anything called a dependency here.

The tracker does record edges and this credential reaches them: `forge_project_pm` answers, and
`forge_issues` takes `data.relations` on a write and returns `relations.blocks` and
`relations.blockedBy` on a `get`, an entry naming the issue at its far end. Which actions this
credential may call is `forge doctor`'s to report; `forge schema forge_issues` owns the rest — what
else an entry carries, what the reply to a write says of it, and how an edge is retracted. One
field is worth knowing before the list is read: `expired`, because an edge whose `validUntil` has
passed comes back with the live ones, so a count of relations is not a count of blockers.

`forge deps [ISS-45] [--long]` reads none of that. It reads the sentence a migrated issue carries
about its own edges and prints one ASCII line per blocker:

```
ISS-7  -> ISS-8 ISS-9 ISS-10? ISS-11
ISS-8  -> ISS-9 ISS-11
```

**A `?` suffix means only one of the two issues claims that edge** — the finding, never reconciled
away. A phrase matching no title, or tying two, prints unresolved rather than guessed, and the run
reports how many issues carry no such prose, because that is silence and not an absence of
dependencies. The sentence it looks for defaults to English and is configurable per tracker with
`deps: { marker, blockedBy, blocks }` in `.forge.json`.

A body and the store can diverge either way — a sentence claiming an edge the store never got, an
edge no sentence mentions — so reading one proves nothing about the other. Whether the verb should
read the store instead is ISS-69's, still open.

**Only the edge gates dispatch**, which `forge -h --full` carries as a rule of its own. Treat
`forge deps` as a reading of what the bodies claim, never as dispatch truth.
