# The landing, as this CLI runs it

What a landing owes is core's page. How far a run takes it is the project's ship mode, which
`forge doctor project` prints, and each mode is a different set of verbs.

The criteria are recorded before the landing, since core locks them once the issue reaches
`awaiting_release`: `forge record criteria ISS-nn <criteria.md>`, or `forge new --criteria` at filing.
When, and the warning a list left in the description draws, are core's page (`forge guide issue-flow`).

<!-- forge:when ship self -->
## `ship self`: the run lands its own change

The change goes onto the default branch from the run, `forge record merged` marks it, and
`forge advance` moves the status the record earns; `forge advance ISS-nn --owed` names anything the
move is still owed.

The close is the holder's once the criteria are met in scope: `forge advance ISS-nn`, each criterion
not met first moved out in `--unmet '[{"criterion":<n>,"to":{"issue":"ISS-<n>"}}]'`. Whether the change
is live is the release's record: `forge release-batch record ISS-nn --commit <sha> --account "<how it
was released>"` where nothing more is owed. Whether this project's release owes a person or a batch
instead is its release policy's answer, and `forge resume ISS-nn --report` prints it.
<!-- forge:end -->
<!-- forge:when ship ready -->
## `ship ready`: the run ends at ready-to-land

The run lands nothing, because the landing is one actor's per checkout. It pushes the branch and
leaves the checkpoint, `forge claim ISS-nn --pushed --ready`, whose `-h` is the authority on that
capture and the states after it. The lease is handed over with it and never dropped, and every record
the run owes is written before it: the landing moves the statuses those records earn and writes none
of them.

One outcome comes back. A merge that touched a path the change owns leaves the checkpoint at
`builder-owed`: take it with `forge claim ISS-nn --take`, read the candidate named there, and answer
for it by its sha with `forge claim ISS-nn --reconciled <sha>`, leaving the branch where it stands. A
candidate found wrong is answered by a new head and `forge claim ISS-nn --pushed --ready` again.
`forge resume ISS-nn` says which happened.
<!-- forge:end -->
