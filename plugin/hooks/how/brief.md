# brief — a dispatch message nobody generated

Why: a typed message carries what the dispatcher believed about the method, and a run reads it
first. On 2026-09-23 five briefs carried a rebase order under text forbidding it (ISS-2148).

How to clear it: send what `forge brief ISS-nn --tree <the run's worktree>` prints (no `--tree`
for a run given none), whole and unchanged. A judge's aim at an issue — a deployment (`--judge --url`)
or an installed command-line program (`--judge --program`) — or at a requirement
(`--requirement REQ-n --url`): `forge brief -h`.

What it judges: a dispatch to a role this plugin ships, by whether the whole prompt is one the verb
printed in the last ten minutes, and a judge's by whether it is the judge's form, which names a
deployment or an installed program and, except for a program judge, no tree (ISS-3145). A line the
verb writes to standard error is not the brief.

Not asked: under a project the tracker gates `yolo` while it delivers fast. The message goes as
typed and the session is told why; both are read per dispatch, and a failed read keeps the gate.
`forge doctor` prints the `gates` row.

Not judged: a role another plugin ships, and a general agent. Words are never read: a digest of the
whole is compared (ISS-2147).
