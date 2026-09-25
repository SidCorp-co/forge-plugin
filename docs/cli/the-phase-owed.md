# The phase owed — what leads `resume` and `claim`, and the index behind it

A run handed an issue past `open` used to read a method that opens at Phase 0 and replay what the
record already held — the run of ISS-673 did exactly that, replaying Phases 0 and 1 on an
`approved` issue. So the block above the body now opens with the phase owed and one line saying the
phases before it are read off the record rather than run again, each one naming the record that
discharged it. The header carries which phase; the line under it carries what to do with the rest.

That was not enough, because the workflow claims before it reads: a run told to take the issue
before its first write saw the method for the phase ahead and nothing about the record behind, and
the one run that resumed correctly did so because a person had said the record was there. So the
same lines print on the claim, from the one renderer `forge resume` prints them with — two renderers
would disagree about one record the first time a row moved, which is the whole of why there is one.
They are silent where no record is behind, so an issue at `open` says on both verbs what a claim
there always said. What that block carries under the record, and why the record alone was not
enough, is [the work](the-work.md).

`forge guide issue-flow --for ISS-nn` prints the same cut whole, and it is where the shape lives:
every phase, every drop and every citation is read off a table some other reader already answers
to — the flow table's phase column, the entry checks beside it, the ladder's lightening rows. An
index holding a phase list of its own would say a phase is owed where `forge advance` says it is
not, and the two would drift the first time a row moved.

Two shifts in it are worth stating, because both were wrong first and a reader will otherwise
reintroduce them. A phase is the work owed *at* a status while an entry check guards the way *into*
one, so a phase is discharged by the rung above it: citing its own status names the evidence for the
step before, and sends a successor to the wrong record. And a rung's lightening is a waiver on a
transition, never on a phase — the ladder drops the plan on the way into `approved`, which does not
drop the implementing. An index reading the second as the first tells a run at the fix rung its work is
done, so a waiver is printed against the phase that pays it, in the ladder's own words, and the
phase stays owed. Two tables are added. The first is which record discharges which status, held to
the entry checks by a case that reads their refusals: a status with a check and no record named
against it would print a phase discharged by nothing, and a row naming the wrong kind is the same
defect wearing a value. The second is which phase each of those records ends, whose own reading is
in [the parts](the-parts.md).

A third shift: what is behind is not read the way what is ahead is. **The status is a cache of the
records with fewer slots than there are facts.** `forge advance --set` writes it with no entry check
reading it, and an issue arriving that way had every phase below printed as passed on the number
alone — the one claim here a successor acts on by *not* doing the work. So a phase behind is passed
when the record discharging it is on the page, and a gap in the middle prints as a gap.

What is ahead stays the status's, because the record cannot say where an issue stands. The release
rung's own discharge is the close, which asks no payload and has no row, so a forward walk off the
record stops there for every issue; and a reopened issue stands at `open` holding the record set of
the cycle before, which read forward would be told it owes the ship. A case holds no phase to
appearing in both lists: passed and owed at once contradicts the line above them.

One cell is read inside itself. `in_progress` names the review, the proof and the landing, and a
run that finished the first two stays at that status until the landing moves it, so a phase read
off the status alone told a finished run to review and judge again (ISS-2439). The records narrow
that cell, and only records bound to the head the landing takes: the checkpoint's, at a turn that
is the lander's or the judge's, judged by the same two predicates the capture out of `head-owed`
refuses on. A review of any other commit — the release a records turn reads, a head the landing
handed back — ends nothing here, and a builder's turn keeps the whole cell, since the builder owes a
head or a reading there.

`--for` is the only part of a guide's answer that is not on this disk. So it is answered where the
tracker is already reached and not by the guide registry, which stays offline: asking for a slug's
text still costs no call at all, and the cut costs the issue and its comments — the same reads
`forge resume` already makes, which is why it is assembled there rather than twice.
