# `forge brief` — why the dispatch message is generated

A dispatcher knows a few things a run cannot learn for itself when it starts: which tree is its own,
the lease id and scratch directory that tree records, what the other trees hold, and whether the
session it inherits is running an older copy than the one installed. Everything else a run needs,
the method and the rules, it reads for itself from the served text.

## Why a verb and not a rule about what to type

The dispatch guide said "the value, never the reason" for months. On 2026-09-23 five briefs sent
under that text carried method anyway: a rebase order the ship already performs, a park's request
restated, the codex routing `forge codex show` prints. Each cost its run a round spent following
them. The owner chose to have a verb generate the message. With a generated message there is no
typed paragraph to police, and a hook refuses a message the verb did not print. The rejected shape
was a runner-side line telling the run to ignore its message. The waste is in what the dispatcher
sends, so the fix removes it there.

## The readings, and where each comes from

- **The tree**: its branch and head come from `git worktree list`. The id and scratch directory come
  from the records in that tree's own git directory, and a line is printed only where its record
  exists. A project that mints neither gets neither.
- **What the other trees hold**: both readings for each tree, the uncommitted files and what is
  committed against the remote's default branch. Commits alone answer empty for a tree with twenty
  files open in it, and that empty looks exactly like an idle tree.
- **The copy**: the session's own copy is the installed copy whose cache directory existed when the
  session's process started, which is how `forge stats` places a transcript. A restart is owed when a
  file in the restart set differs between that copy and the installed one.

## Why a digest and a window

The hook compares a digest of the whole prompt with the ones the verb recorded in the repository's
git directory. An added sentence changes the digest, so none survives. Reading the message's words
was refused in ISS-2147, since no list of method phrases is ever complete. The window is ten minutes
because the readings are taken at a moment: ten minutes is long enough to send one, and a brief older
than that is taken again rather than trusted.
