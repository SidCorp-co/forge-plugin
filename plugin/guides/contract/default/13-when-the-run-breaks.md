## When the run breaks

Hold nothing about a run anywhere but the record.

- **A claim is a lease, in a field the issue already has.** Session, renew time, duration and claim
  history, renewed by every payload write. A run that loses its shell cannot park or release, so read
  the interruption off the stale lease and the worklog beside it.
- **Crashed is not failed.** An expired lease says nothing about the work. The status and
  payloads stand; the next run resumes the phase the status owes.
- **The record is the checkpoint.** Push a commit as it is made. Never delete a wrong payload: write
  a correction beside it; the report shows both.
- **A park is a checkpoint with a person at it**, for a decision a person owns. The issue waits,
  the batch does not, and no park times out. A transient failure is not a park: retry, rewrite the
  refused command, write nothing.
- **A rule change owes nothing backwards.** Every typed write carries the contract version it was
  written under, and a status whose payload exists under that version stands. A status with no
  payload at all is unearned whatever the version.
