### `in_progress:test` — reads the criteria and the merged commit

The merge mark is this place's record on every path; on the direct one it is what `awaiting_release`
reads. Whichever actor landed the change writes the mark. Nothing in this stage reads who wrote the mark,
and nothing may: a project may bind its builder not to merge, and a rung no actor can reach is a rung
the flow does not have.
