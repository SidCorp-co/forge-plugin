# `record` — a payload has one shape

ISS-1's dry run of the issue-flow contract wrote nine payloads by hand: a confirmation, a decision
record, a baseline, six verdicts. Each was shaped at the keyboard, and the second run would have
shaped them differently. `forge record <kind>` owns the shape, so the reader and the checker find the
same fields every time, and a missing field is refused by name before anything is posted.

A record is a comment a person reads first: a heading, then the payload in a fenced block, then one
parsed line naming the kind and the contract. Both of those the prose pipeline copies byte for byte,
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
attached twice resolves to two documents (ISS-55). The upload comes after every refusal the record's
own shape can earn, so a shape a reader can fix costs no attachment; what is left cannot be undone,
because the tracker publishes no delete for an upload — a lease lost mid-command, a second file that
fails, or a comment gate that refuses the record after the first file went up. In each of those the
command names what it sent and the `--evidence` line that cites it, since sending the path again
would collide with the name already there. Named from before each PUT rather than after it: the
tracker can take a file and lose the answer, and a file nobody was told about is the one nobody
cites.

Two flags are read off the record when they are absent, and each prints where its value came from: a
commit from the merged mark's note, and evidence from the latest record of the same kind. The twelfth
dry run's verdict loop typed the same two values twenty times each, and both were already on the
record. Evidence is read from the latest record of that kind rather than from the attachment set, because
what an issue's evidence is belongs to whoever cited it first: the one attachment an issue carries
may be a design document nobody cited, and a default from it would turn a refused verdict into a
passing one. It is not read per criterion — one document answers twenty of them, which is where the
forty arguments went — so the line it prints names the record it came from and not the criterion. So the first of a loop names it — a path there goes up and is cited — and the rest inherit. A
default nobody can see is one nobody can catch being wrong, which is why neither is silent. And where the comment list stopped with more behind it, each is
read from the page when the page carries one — the cut keeps the most recent rows, so a mark or a
citation found there is the latest — and asked for by name only where the page carries none, since
then the one that would answer may be exactly a comment behind the cut. The refusal says which cap
the tracker named and how many rows it returned: for a year it said 200, the number the request asked
for, on threads of half that (ISS-131). The release note and the criteria go
to their fields, which the tracker already types; everything else is a comment. `report` assembles
the latest record of each kind and the latest verdict per criterion, and names the criteria no verdict
covers. Nothing is stored twice. The contract this serves: `forge guide contract`.

Two of the kinds exist because a reopen recorded nothing. The tracker has had a `reopen` status and a
`reopenCount` field all along, and neither says what the person found: what they expected, what they
actually saw and their own words went into a plain comment nothing read back, so the gap that let it
ship was never named. A finding is that comment typed, written by the agent on the person's behalf
and quoting them; a triage is the ruling on it, one of three outcomes and one line naming what would
have caught it. Both are marked as repeating, so `report` shows every one: the fourth dry run wrote
four corrections and reported one, because the assembly kept the latest of every kind.

Two more exist because the fold of a run was prose. A parent reading `report` got every payload that
earned a status and nothing about what the run met on the way: a defect it found on something else
and sent to the issue that owns it, and a place the method it followed did not answer. Sixteen runs
put both in a closing message instead, typed at the end out of whatever the agent still held, which
is the one moment neither is accurate. `routed` names what was found and where it went;
`gap` names where the method fell short and what was done instead. Each takes `--none` with a
reason, the way `decision` does, so a run that met neither answers rather than leaving an absent
record to read like an unasked question. Neither earns a status: a payload nothing told an older
copy about would refuse a run for a rule it could not have read, and the point of the record is that
nothing has to be told. `report` closes with the run's own worklog — the branch, the head, what it
touched and the plugin copy the capture was made under — so one read answers which copy typed it.
