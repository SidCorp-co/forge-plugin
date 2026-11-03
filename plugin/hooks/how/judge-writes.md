# judge-writes — a judge writes its verdicts and its report, nothing else

Why: a judgement states what it found and changes nothing else. A judge that writes a probe record,
agrees a requirement or sets local config has acted as the run it judges, and the master is left to
undo it. A dispatcher note only advises; this is enforced.

What it governs: a qa judge session alone, read from its subagent brief. There it refuses the `forge` and `forge-runner` calls that create or change a tracker record other
than a verdict — `forge record <kind>` for a kind that is not `verdict`, an issue created, a status
moved, a lease claimed, a raw mutating tracker call — and any write to this machine's local forge
configuration, `forge doctor --set` among them.

A criterion you can only show by writing records: give it a `skipped` verdict with a `--why` that
names what would settle it. Leave the change for the run that owns it; your report is how it learns.

A refusal you believe is wrong: put it to the user, do not reword until it slips past. `forge record
verdict` and `forge comment` are always open.

Not judged: any session that is not a qa judge — the master and a builder run are left alone; git,
which bash-guard holds; and every read, a raw GET and `forge advance <ref> --owed` included.
