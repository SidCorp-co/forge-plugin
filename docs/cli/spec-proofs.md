# `spec proofs` — the Proof lines read backwards

R-11 already makes the tree a map from contract to test: every criterion names the case that proves
it, or the issue that owes one. The checker reads that map in one direction, clause to case. `forge
spec proofs` reads it the other way, from the test files back to the criteria, and answers three
questions nothing else did: which criteria are still owed, which test files no criterion names, and
which case several criteria lean on.

**The map has one source, and it is the tree.** The lists are derived from the Proof lines at each
read, through the same criteria reader and field parser the checker uses, and written nowhere. A
second map — a test carrying its own clause citation, or a stored index — would be a second answer
to "what proves this", and the first one to drift would be the one nobody corrects.

**Where the tests are is the project's to say, and it has no default.** The root and the file-name
pattern are the project file's `tests` key. A built-in root would be one repository's layout
imposed on every tree this plugin runs in, and a list computed off a guessed root is silently wrong
in exactly the projects that laid theirs out differently. So an unset key makes that list unread,
with the call that sets it, and the two lists that need no test files still print. The pattern
matches a file's own name and holds no slash, because a directory is what the root already says.

**Whether an escape's issue is still open is the one question that asks the tracker**, and it asks
the same whole-project issue list `forge doctor` judges the escapes against, so the two cannot
disagree about one key. A list that did not come back whole leaves every status unread rather than
guessed, and a tree whose escapes name no key spends no call at all.

**No list is a finding.** A test file no criterion names may be a test with no stated contract, or
a helper's own suite, or a case whose clause has not been written; a case three criteria name may be
one contract held at three layers, or three criteria that are one. Which is a person's reading, so
the verb exits 0 whatever it holds and files nothing — a cleanup is filed when a list is read and a
cut is judged worth a run.
