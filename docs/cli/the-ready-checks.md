# The ready checks — what they read, and when they run again

**A check reads the change, where the project says it may.** The capture runs after ISS-3184 made
the whole-tree gate the landing's alone, and a list of whole-tree commands kept the ready capture the
one place a run still measured the tree: about a hundred seconds a capture in this repository, three
to four minutes on mailpilot, the same for a one-line change as for two hundred files (ISS-3192). A
command naming `{files}` is handed, in its place, the files the branch changed against the base the
capture reads, deleted ones left out, each quoted for the shell. One naming nothing runs as declared,
because which of a project's checks can be scoped is the project's to say and never this plugin's to
guess off a command; a checker that only means something over the whole tree belongs to the landing's
gate rather than to this list. A scoped check whose change hands it no file is skipped, and the line
the capture prints says how many were.

**A list already green at a head is not run again there** (ISS-3191). A batch's members share one
branch and one head, and each member's capture ran the whole list again: five runs of the same checks
over one commit, fifteen to twenty minutes where one would do, while the batch could only land as a
whole. A green list is kept in the repository's shared git directory, where every worktree of the
checkout reads it, keyed by the head, the base and the list as declared: any one of the three moving
is another question, and is asked. A red list keeps nothing, so the next capture runs it again; the
line a reused answer prints names the capture that ran it, and when.
