# ChatGPT — the turn nobody waits for

Past ten minutes the wait in force stops being one a caller can hold, and the turn is handed to a
detached copy of this CLI: the submitting call prints the turn's own id and the command that reads it
back, and returns. Ten minutes is not a number chosen here. It is the shell tool's cap, which
`forge hooks --how polling` and the bash gate both already name as the longest a call of its own may
wait, so past it a caller is asking its own turn to outlive the thing that asked for it.

**The wait in force decides, and there is no second flag.** A `--background` beside `--wait` would be
two spellings of one switch, with a precedence rule to explain and an undo that half-works. It is the
effective deadline and not the typed one, so a machine whose configured `waitSeconds` is an hour
detaches too rather than holding a run open for an hour it never asked for in a flag.

The one-turn rule is untouched. The child makes the same single `tools/call`; what moved is who waits
for it, not how many turns are spent, and a collected failure establishes exactly what a blocking one
does — that the turn may have been spent, and that nothing here sends it again.

The store is one JSON file per turn under the configuration directory, beside the token and the
consult log. One file has one writer at a time and in one order: the parent writes it at the spawn,
the child is its only writer until it settles, and a collect stamps only a record no writer is left
for. Giving a turn up never joins that queue — it writes a separate marker beside the record, which
every reader takes as final whatever the record says, so a child that settles after the drop cannot
put the turn back. A sweep takes only what has been read or given up and only once it is a week old:
an uncollected answer is precisely what detaching promised to keep.

**Nothing is ever signalled.** A drop places the marker and the child stops itself — it watches for
that marker, aborts its own request and writes the turn given up. A pid recorded at the spawn and
signalled later names whatever process holds that pid now, and no check made before the signal closes
the gap between the two, so the pid in the record is there for a person to read and nothing acts on
it. That is why a drop waits for the child's own word rather than reporting that a signal landed, and
why it says which of the two it got.

A record still saying `running` a minute past its own deadline is read as abandoned, which is what a
killed child or a restarted machine leaves behind. Nothing reconciles it: the reading is derived
where it is needed, and collecting one says the turn may have been spent, like every other failure
here.
