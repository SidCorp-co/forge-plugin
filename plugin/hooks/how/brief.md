# brief — a dispatch message nobody generated

Why: a typed message carries what the dispatcher believed about the method, and a run reads it
first. On 2026-09-23 five briefs carried a rebase order and a restated park under text forbidding
both (ISS-2148), so the message is generated.

How to clear it: run `forge brief ISS-nn --tree <the run's worktree>`, or with no `--tree` for a run
that is given none, and send what it prints as the prompt, whole and unchanged.

What it judges: a dispatch to a role this plugin ships, by whether the whole prompt is one the verb
printed in the last ten minutes. Past that window the readings (what each tree holds, which copy is
loaded) may have moved, so it is generated again rather than trusted.

Not judged: a role another plugin ships, a general agent, and any dispatch made from outside a git
checkout, where the verb has no trees to read. The words of a message are never read: a digest of
the whole is compared, and a reading of words was refused (ISS-2147).
