### `in_progress:test` — reads the criteria and the merged commit

The merge mark is this place's record on every path; on the direct one it is what `awaiting_release`
reads. A project may bind its builder not to merge, so whichever actor landed the change writes the
mark, and nothing reads who did.
