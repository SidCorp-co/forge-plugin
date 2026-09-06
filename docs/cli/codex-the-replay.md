# codex — the replay

**A prompt is versioned because "it seems better" is not a comparison.** Every consult records the
system prompt's version and the digest of the text actually sent, so an edit nobody bumped for still
shows. `forge codex replay --prompt <file>` is the other half: what of a past window a candidate
prompt could be scored against, rebuilt out of what the record and the repository between them can
prove. It writes nothing and sends nothing — it says which rows a comparison could be made over, and
making it is the caller's next step.

**The recorded digest is the proof, and it is not tied to the recorded commit.** A sent file's bytes
come from the commit the row recorded, or from the nearest commit after it holding a blob that hashes
to the same digest. That is sound because `git diff` compares blobs and the diff a consult sent was
taken against the working tree: a commit holding the bytes that were in that tree yields the same
hunks. For the same reason a removed worktree loses nothing — any live checkout holding the commit
answers, since the commit and the digest are the whole of what a rebuild is proved by, and a wrong
checkout cannot pass them.

**What a digest cannot prove refuses the row rather than replaying approximately.** Two cases, both
about the diff and not the bytes. A path the anchor never had was shown either as an addition patch
or as `NEW FILE — every line of it is this turn's change`, depending on whether it was in the index
at the time, and no row records which. And a mode header in the rebuilt diff means the two sides
differ in mode, while the mode of the tree that was actually diffed is recorded nowhere; for the same
reason, a mode a working tree carried and no commit ever recorded would not show at all, which is
the one thing a rebuilt diff is not proof against.

**The one text the log keeps is the text no commit can ever hold**: a sent file resolved outside the
checkout, which is how a plan or a criteria file arrives, capped per file and across the record, with
the cap named on the row whose text it dropped so a capped row and a row from before the log kept any
are never one reason. Everything inside the checkout is left to git, because a dirty source file's
text *is* the review payload and a log holding every one of those is the multiplication `--send
diffs` exists to avoid — as storing each prompt whole would be, at roughly 140 KB a consult.

What is left unrebuildable is a tracked file dirty at every commit the search reaches, and that is
by design rather than by omission. So the verb prints the window, where each rebuilt row's bytes came
from, and what it lost with the reason: **a share of a window, read for what it is rather than
treated as a score.** What stands in front of a prompt switch is that share, the first live run of
the new prompt read by hand, and `forge codex eval` a hundred consults later.
