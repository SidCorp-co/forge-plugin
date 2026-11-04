# judge-writes — a judge writes its verdicts and its report, nothing else

Why: a judgement states what it found and changes nothing else. A judge that writes a probe record,
agrees a requirement or sets local config has acted as the run it judges, and the master must undo
it. A dispatcher note only advises; this is enforced.

What it governs: a qa judge session alone, read from its brief. It refuses the `forge` and
`forge-runner` calls that create or change a tracker record other than a verdict — a non-`verdict`
`forge record`, an issue created, a status moved, a lease claimed, a raw mutating call — and any
write to this machine's local config.

A requirement judge records verdicts through core's route, `forge-runner api
projects/<id>/requirements/<REQ-n>/verdicts -X POST` (ISS-588); that one POST is allowed, a bare
`requirements` POST is not.

A criterion you can only show by writing records: give it a `skipped` verdict with a `--why` naming
what would settle it.

A refusal you believe is wrong: put it to the user, do not reword until it slips past. `forge record
verdict` and `forge comment` are always open.

Not judged: any session that is not a qa judge — master and builder runs; git, which bash-guard
holds; and every read, `forge advance <ref> --owed` included.
