# `forge brief` — why the dispatch message is generated

What the verb prints is its `-h` and its output. This page holds what neither carries: why the
message is generated at all, what settled each reading's source, and why the hook trusts a digest.

## Why a verb and not a rule about what to type

A rule about what a brief may carry was already served, and briefs carried method under it; the
record is ISS-2148. With a generated message there is no typed paragraph left to police. A runner-side
line telling the run to ignore its message was considered and rejected: the waste is in what the
dispatcher sends, so the fix removes it there.

## The readings, and where each comes from

- **The tree**: its branch and head come from `git worktree list`. The id and scratch directory come
  from the records in that tree's own git directory, and a line is printed only where its record
  exists. Beside the scratch directory goes the run's own configuration home, borrowing the
  credentials, from the one source this repository's workspace start prints it from: a run never
  told it copied the token into its scratch (ISS-2619), and that home is where the tree's hooks read
  its consults (ISS-2651).
- **The run id, written where the tree has none**: a brief naming an issue and a tree gives that tree
  its `forge-run-id`, in the one form the lease reads, `iss-<n>[+<n>...]-<8 hex>` — the key, then each
  `--batch` key. Without it a run is never placed as the one its issue was dispatched to, and the only
  writer used to be a tool of this repository that no other project has: a dispatcher elsewhere
  declared an id of its own, which names no issue, and its run could take no lease (ISS-1682). A
  ledger of that dispatcher's was the other place to read the binding from, and it is one this plugin
  cannot see. The brief is the moment of dispatch and the verb every dispatch of a role runs, so the
  binding is made there. An id already in the tree is read and never extended, since the run it names
  may still be standing in that tree; one that does not name every key refuses the brief.
- **The scratch directory, minted beside the id**: the brief makes `forge-run-<id>` under its own
  temporary root and records it as `forge-run-scratch`, by the writer the workspace start uses, where
  the tree holds no record naming that id's directory. A run told to make its own with `mktemp -d`
  made one nothing named, and nothing could say whose it was once the run had died; such directories
  filled a box to `ENOSPC` (ISS-2524). The record is what makes a directory reapable, so the two are
  written together or not at all, and a brief that cannot write both is not printed.
- **What the other trees hold**: both readings for each tree, the uncommitted files and what is
  committed against the remote's default branch. Commits alone answer empty for a tree with twenty
  files open in it, and that empty looks exactly like an idle tree.
- **The copy, which is the dispatcher's and not the brief's**: the session's own copy is the
  installed copy whose cache directory existed when the session's process started, which is how
  `forge stats` places a transcript. A restart is owed when a file in the restart set differs between
  that copy and the installed one. ISS-2148 put this reading in the run's message, and every run in
  every project was then handed two lines about a copy only the dispatching session can restart,
  naming files inside the plugin that the run's tree does not hold (ISS-2963). So it goes to standard
  error, which the digest never holds, only when a restart is owed, and in versions: the version to
  restart onto is what a project that never saw the plugin's source can act on. A reading that could
  not be taken says nothing, as an install record that cannot be read does.

## The judge's form

A judging run judges what a deployment serves, so its brief carries the address that deployment
answers at, the criteria to judge there and the identity where the record holds one, and none of the
builder's readings: no tree, no run id, no scratch directory, no list of what other trees hold. Every
judge sent a builder's brief on one project read its tree line as where to work and ran the gate and
the test suites in it, and judges sent without a tree still brought up the checkout's local stack,
because nothing in the one message the hook lets through named the deployment (ISS-3145). The record
the hook reads keeps which form was printed, so a dispatch to the judging role is held to the judge's
form without reading the prompt's words.

## Why a digest and a window

The hook compares a digest of the whole prompt with the ones the verb recorded in the repository's
git directory. An added sentence changes the digest, so none survives. Reading the message's words
was refused in ISS-2147, since no list of method phrases is ever complete. The window is ten minutes
because the readings are taken at a moment: ten minutes is long enough to send one, and a brief older
than that is taken again rather than trusted.
