# The wave's records, and the landing a fold makes

The wave's method is core's page. These are the verbs that leave a wave on the record, and the
landing a fold makes where the project's ship mode puts it there.

## A wave on its headline

**Each dispatch is written onto the wave's headline before the call that dispatches it**:
`forge record wave <headline> --member <key>... --role <role> --session <the id the brief granted>`,
with `--tree <its tree>` where the run was given one. One record per dispatch however many issues it
carries, and it takes no lease. A dispatch with no record is one a restarted dispatcher cannot see.

**A wave already under way is resumed before any order is read**: `forge resume <headline>` prints
every dispatch since the last fold, each member at its status now. **The fold's last step is its
record**: `forge record fold <headline> --summary "<the wave's one line>"`. Until it is written the
wave reads as unfolded; after it, the next dispatch headed on that issue begins a new wave.

<!-- forge:when ship ready -->
## `ship ready`: the fold lands the runs' branches

Where the runs end at ready-to-land, the landing is the fold's, from this checkout, in the order the
fold names them, one gate spent on the set. A branch handed back is read off its checkpoint:
`builder-owed` for a merge that touched a path the change owns, `head-owed` for a fault of its own,
and the run that built it is resumed from there. A branch that will not merge at all is parked with
its conflict list, and the fold carries on.

A status the landing could not reach is the fold's, and `forge resume ISS-nn` says which one. The
landing walks no further than `awaiting_release`, where the close is the release's record:
`forge release-batch record ISS-nn --commit <sha> --account "<how it was released>"`, once the
release is out and owes nothing more.
<!-- forge:end -->
