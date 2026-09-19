# `record` — a payload has one shape

ISS-1's run of the issue-flow contract wrote nine payloads by hand: a confirmation, a decision
record, a baseline, six verdicts. Each was shaped at the keyboard, and the second run would have
shaped them differently. `forge record <kind>` owns the shape, so the reader and the checker find the
same fields every time, and a missing field is refused by name before anything is posted.

A record is a comment a person reads first: a heading, then the payload in a fenced block, then one
parsed line naming the kind and the contract. What a reader meets first is the shape's first field,
which is a decision rather than an order the fields fell into: the confirmation leads with `is:`,
the one sentence saying what the issue is, because `where:` repeats and holds a path list that ran
to hundreds of code points and pushed that sentence under it (ISS-1699). Order is presentation
alone — every reader finds a field by a property or by its key — so the records already written
stand, and what moves is which line is read first and which flag a bare write is refused by. Both of those the prose pipeline copies byte for byte,
which is why the keys inside are the flags rather than the labels a reader sees: on a project whose
`.forge.json` names a prose language every body is rewritten on the way out, and a rewrite renames
prose. Eight verdicts and a verification earned nothing on such a project because the labels the
reader keyed on had become Vietnamese, and a criterion number read from an absent label keyed the
verdict map as `NaN`. A record written in the older form is read by its labels, and one whose labels
resolve to no field of its shape is named as rewritten rather than as the fields it appears to lack.
The verdict quotes the criterion's text as it stood
at the write, because the field can change later and the verdict has to say what it judged. Evidence
is an attachment name the issue carries, a URL or a commit, and a reference to a file on someone's
disk proved nothing — so a value that *is* a readable file goes up under its base name at the write
and is cited by that name, which is the `forge attach` and the re-send an author paid by hand. A
base name the issue already carries is refused there rather than attached twice, because a name
attached twice resolves to two documents (ISS-55) — and `forge attach` refuses on the same read,
because the ambiguity belongs to the name and not to the route that sent it; where the comment page
is cut at its cap that verb says so and sends anyway, having no citation to make instead of the
upload the way this one has (ISS-137). Every file is scanned before the first request goes, and the
upload comes after every refusal the record's shape can earn, so a fixable shape costs no attachment;
a name the tracker will not type costs that one file's request, there being no way to ask first. What
is up cannot be undone, there being no delete for an upload — a lease lost mid-command, a request
failing behind one that landed, a comment gate refusing the record after the first file up. Each
names what it sent and the `--evidence` line that cites it, sending the path again colliding with the
name already there. Named from before the request, not after: the tracker can take a file and lose
the answer, and a file nobody was told about is the one nobody cites.

Two flags are read off the record when they are absent, and each prints where its value came from: a
commit from the merged mark's note, and evidence from the latest record of the same kind. ISS-59's verdict loop typed the same two values twenty times each, and both were already on the
record. Evidence is read from the latest record of that kind rather than from the attachment set, because
what an issue's evidence is belongs to whoever cited it first: the one attachment an issue carries
may be a design document nobody cited, and a default from it would turn a refused verdict into a
passing one. It is not read per criterion — one document answers twenty of them, which is where the
forty arguments went — so the line it prints names the record it came from and not the criterion. So the first of a loop names it — a path there goes up and is cited — and the rest inherit. A
default nobody can see is one nobody can catch being wrong, which is why neither is silent. That
took the typing out of a verdict loop and left the calls. Judging is the most call-heavy phase a run
has — the profile behind ISS-289 counted one write per criterion, evidence attached per criterion,
and the suite re-run five and a half times inside judging for evidence the build phase had already
produced — so `--criterion` repeats, and each one opens a block of the same payload: one write
carries a verdict, an evidence set and a reason for each criterion it names. What stands before the
first `--criterion` is every block's, which is where the saving is; a block's own value of a flag
that takes one replaces the shared value, so the criterion that failed carries its own reason beside
thirteen that passed, and a repeatable flag adds to the shared set rather than replacing it, which is
how the one criterion whose evidence is its own cites that beside the run they all share. Each block is rendered whole rather than as a shared header and thirteen references back to
it, which buys two things: a write naming one criterion renders exactly what it always rendered, and
every block reads back as the record a single write makes — so the assembly, the entry checks and the
report are handed one record per criterion and none of them can tell one write from fourteen. That is
also why the contract version does not move: an older copy reading such a payload takes the first
value of each single field, so it reads the first criterion and reports the rest as owed, which
under-earns and never over-earns. A criterion two blocks of one write both name is refused, because
the map every reader keys by criterion would keep the last of them and nothing on the record would
say the first was dropped. A document two criteria prove goes up once under the one name both of them
carry, for the reason any name goes up once. And `forge advance --owed` names the criteria with no
verdict in one item whose command is the single write that answers them all, a list of fourteen
commands being fourteen writes. And where the reader could not walk the thread to its end, each is
read from the rows it did reach when they carry one, and asked for by name only where they carry
none, since then the one that would answer may be exactly a comment the read never reached. The
refusal says how many comments of how many were read and nothing about which end is missing: for a
year it said 200, the number the request asked for, on threads of half that (ISS-131). The release
note, the plan and the criteria go to their fields, which the tracker already types; everything else
is a comment. Nothing is stored twice. The reading that assembles them all is `forge resume
--report`, which writes nothing and so is no kind of this verb. The contract this serves:
`forge guide contract`. The four kinds that exist because what mattered was going into prose instead: [record-the-unwritten.md](record-the-unwritten.md).

A write also ends by saying what the issue now owes, and takes the other kinds its rung cites in the
same call — `--also <kind>` opens each one after the first with its own payload — and makes the move
that set earns, in that same call. The pair counts behind both, the order a call writes in, and what
a refusal costs: [record-the-rung.md](record-the-rung.md).
