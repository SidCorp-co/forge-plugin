### Earning and unearning — what moves a status and what takes it back

**Two sources, one recorded.** Write what the repository knows onto the issue at the step that knows
it: the mark its commit, a review the head it judged, a verdict the commit it judged. Never read
repository state at transition time. A check that read the working tree would answer differently on
every machine.

**A later change unearns.** A moved merged commit unearns `developed` and above; moved criteria
unearn `testing` and above. The run that moved it is who notices. Old reviews and verdicts stay as
superseded history, and the new ones are written beside them.

**A person's finding unearns like a change to the code.** The triage is what unearns, and it says
which way: the criteria, the code, or neither. Delete nothing. A defect found in a closed issue's
change goes to the nearest open issue that owns it, or to a new filing, and the closed issue gets one
note saying where.

**A batch is a relation, written when the branch is cut.** Every member earns each status on its own
record. A member that fails parks while the rest advance, and erases nobody else's evidence.
