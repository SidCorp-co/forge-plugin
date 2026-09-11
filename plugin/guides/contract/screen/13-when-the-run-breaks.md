## When the run breaks

Hold nothing about a run anywhere but the record.

- **A claim is a lease, in a field the issue already has.** Session, renew time, duration and claim
  history, renewed by every payload write. A run that loses its shell cannot park or release, so read
  the interruption off the stale lease and the worklog beside it.
- **Crashed is not failed.** An expired lease says nothing about the work. The status and the
  payloads stand, and the next run resumes the phase the status owes.
- **The record is the checkpoint.** Push a commit as it is made. Never delete a wrong payload: write
  a correction beside it, and let the report show both.
- **A park is a checkpoint with a person at it.** Nothing runs while it waits, and no park times out.
  A transient failure is not a park: retry the tracker, rewrite the refused command, write nothing.
- **A rule change owes nothing backwards.** Every typed write carries the contract version it was
  written under, and a status whose payload exists under that version stands. A status with no
  payload at all is unearned whatever the version.
