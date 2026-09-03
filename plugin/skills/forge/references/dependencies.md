# Dependencies are prose, not edges

Read this before answering what blocks what, and before trusting anything called a dependency here.

No PAT can read or write the recorded dependency graph — every `forge_project_pm` action refuses,
and `forge_issues get` returns no relation among its keys. `data.relations` on an `update` is worse
than a refusal: schema-validated, then discarded, returning 200 (forge-dev ISS-868).

`forge deps [ISS-45] [--long]` is the substitute. It reads the sentence a migrated issue carries
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

**Only the edge gates dispatch**, which `forge -h --full` carries as a rule of its own. Treat
`forge deps` as a reading of what the bodies claim, never as dispatch truth.
