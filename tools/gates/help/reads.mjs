/* Everything this gate's help says about the unit inside a test step, which is the file: what the
   set is measured from, what the run reports of it, and the ceiling a file the audit cannot follow
   is given instead. Its own file because the runner's is at the line limit its own checker sets,
   and this is the section that grows. `tools/gates.mjs -h` prints it in place. */
export const READS_HELP = `Inside a test step the unit is the file, and what it is keyed on is measured rather than declared.
Every node process a test step runs is preloaded with an audit that records the repository paths it
asked for — asking is the read, so a probe that found nothing is one too — every directory it listed,
every tree it read the content of, and a ticket for every process it spawned. Those are four claims
and not one: a path is keyed on its content, a directory on the names in it, a tree that was walked
on the names below it, and a tree that was copied, watched or globbed over on the content of
everything below it, name and kind and bytes alike. Which claim a call makes is what its own
arguments say it read, and a copy recorded as a listing's claim would hold a pass over an edit to a
file it copied. A file that passed is stored with that set; the next run digests each set at the
content on disk now, and a file whose digest matches is not spent. A file is
skipped only on positive evidence, so all of these are spent: one the record holds nothing for, one
whose process left an unfinished record, one that spawned a child no record answers for, one that
reached a shell this cannot follow, and one whose execution context — this node, the launcher, the
audit itself — has moved. Every set carries this repository's manifests, since a specifier's target
is chosen by a manifest node reads through internals no audit here sees. A step that spent a narrowed
set, down to one that spent nothing at all, still records its own pass: what it did not spend it held
back on a record answering for this same content, so the step is proven here exactly as far as those
records are — and without it a second gate at content already passed re-decides every file again.

**A child that left no record is not always a child that could have read.** What a shell was asked to
run is on its command line, and four things have to hold before that is read as opening nothing. The
shell is \`sh\` or \`dash\`, named by the record and never assumed, neither of which reads a startup file
when it is handed \`-c\`. The environment it ran under reaches nothing: no directory of its \`PATH\` lies
inside this tree, since a name resolved along one would be answered from this tree's content, and
nothing in it can put something else behind a builtin's name. The line reads whole as bare words,
single-quoted runs and backslash escapes, an expansion, a substitution, a redirection, a list, a pipe,
a glob or a double quote refusing it outright. And the program is one of the shell's own builtins that
opens no file: the writers, whose operands are text they print rather than paths they open, and the
lookups, which say where a name would be found and are refused an operand holding a slash, that being
a path they answer about. Failing any of the four blinds exactly as before, so a shape added to the
reading narrows what is blind and widens nothing that is trusted. It reaches a shell and nothing else:
a node child handed a path into the checkout can read it, and closing that boundary is a test file's
own work.

Each step says what it spent in the unit it has. A step whose unit is the file names the files it
spent of the files it knows, the seconds, and how many it held back — \`test: 6 of 290 file(s), 41s
(284 held back, 604s when they last ran)\`. The files it knows are its whole list before any
narrowing and never the subset the record answers for, so spent plus held back is that list and a
file nothing is recorded for is counted spent: a denominator restricted to what the record answers
for would read \`0 of 0\` on the one run this exists to show. The seconds beside the count held back
are read off the per-file record below, before the step is spawned, and are the sum over the
held-back files that record prices; the ones it prices nothing for are counted beside the sum rather
than added into it as zero. A step whose unit is not the file prints its seconds and no fraction,
and the verdict line says once how many such steps ran whole.

The same line carries the arithmetic of what that spend was for, in files rather than in seconds,
seconds being the machine's and a faster box shrinking every one of them while the same waste stands:
\`spent 6 = 4 reached + 2 blind\`. A file is reached where the newest read set the record holds for it
names a path this change touched — its own, a directory whose listing it claimed, a tree it walked or
a tree whose content it claimed — and blind where the record holds no set for it at all, which is
where a file whose audit could not be followed and which carries no declaration ends up, nothing
being written for one. Where the spend runs past their sum the
line names the excess as \`accounted for neither way\`, and it is not a measured waste: the listing rule
over-counts the reach, while a set recorded before the file gained a dependency this change touches
holds no claim that dependency answers and under-counts it. So the excess is the number to go and read
the sets over. A run that never learned which paths changed — \`--full\`, or a diff git refused — carries
no count of reach rather than a reach of nought. A run that distrusts these digests and narrows
nothing still carries the counts, which are read off the recorded sets and not off the digests.

One part of that excess a run can prove, and names: \`202 spent under a context the record does not
hold\`. A set's digest is keyed on the execution context as well as the content, and that context moves
with this collector's own files, the node version and the launcher, which names a file of this tree by
its repository path and its content and never by where the tree stands — any of which leaves every
recorded set unable to match whatever the tree says, so the spend follows from the
key having moved. Each set therefore carries the context it was keyed on, a field no digest here reads,
and a spent file keyed on another one is counted as that; a set carrying none is evidence either way for
neither, and stays in what nothing explains. The \`>\` stands regardless: a context the record does not
hold explains an excess and never licences it, those files having been spent for nothing reached.
A worktree therefore keys the launcher the checkout it was cut from keyed, and the record under the
common git directory is one both of them read rather than one each of them writes into (ISS-1763).

A step the run could not skip says which of the two it is: one the record holds no pass for at any
content, or one whose recorded passes are all at other content. A test step under a readable record
says the same of its files, whether or not it held any of them back. Both printed nothing, and that
silence is what hid ISS-1739 for a day after ISS-654 landed (ISS-1746).

A file the audit could not follow to the end records nothing at all, so nothing can ever say it is
unaffected: 60 of the 309 files a full audited run records, the census below pricing them. Such a
file may instead be given a **declaration** in \`tools/gates/steps.mjs\` — the repository paths it
may read, written against the file by somebody who read it. A declaration is a ceiling and never the
answer: the derived set is the answer, and this is what a file gets until its blindness is fixed.
What keeps it honest is that the reads the audit *did* see are checked against the ceiling on every
run that spends the file. A path, a listing, a walk or a content claim the ceiling does not cover
fails the gate, naming the file, the path and the claims it escaped, and writes no entry for it. The
check is on the spend and never on a pass: a file skipped on its declaration was not observed that
run and nothing about it is claimed.

**That verification reaches the observed reads and stops there.** What the unfollowable child read is
what nothing here can see — it is why the file has a declaration at all — so no check can say a
ceiling covers it, and this does not claim to. For that half a declaration is somebody's reading of
the file, accepted one file at a time, which is why a key names one file and never a directory of
them: a file enrolled by a prefix would inherit a reading nobody made of it. A ceiling wrong about
the unseen half holds a file back on a change it should have been spent on, and no line here says so.
The answer to that is closing the boundary, never widening the ceiling.

A declared set is written, digested and compared exactly as a derived one is, so a change inside the
claims spends the file and a change outside them does not, and nothing in the selection reads a
declaration. A claim that is a directory carries the walk below it and the content of every tracked
file in it, and the entry carries every read the audit saw as well, so a path appearing, vanishing or
changing under a claim all spend the file. A file declared twice is refused at the lookup, which has
no answer for it; a key matching no test file git reports and a claim git tracks nothing at are this
repository's own checker and no condition of a run, both being inert — refusing for them would refuse
in every tree the table was not written for. A file the audit stops reporting blind derives its own
set, and its declaration is said to have had no effect against the blindness it was recorded under,
so a declaration cannot become the cheap path for a file that could be derived. The report names how
many files recorded a set by derivation and how many against a declaration, and how many of the files
held back were held back by one.

A blind file carries **every** cause of its blindness and not the first one the collector reached,
and each says which of two kinds it is. An \`export\` cause is a call the audit could derive no claim
from — a name classified in no set of its, which is every name node adds later, or one whose own
arguments left the subject unestablished: a copy told to follow its links, a watch on a link, a
pattern rooted outside this tree, and a copy or a watch of a tree this one stands under. A \`child\`
cause is a process that left no record and could have read this repository: it is answered by closing
that boundary in the one test file that opens it. Removing one cause of three frees nothing, which is
why a figure summed by cause predicts nothing until every cause is known — four filings in a row
overstated what a change was worth by counting each file against whichever cause the collector
reached first. A run
that spends a declared file blind on more than one cause is told so by name, a ceiling written
against the harmless half of a pair holding the file back on changes it must be spent on.

What blinds each file of one audited run, and what a candidate change would actually free, is
\`node tools/gates/reads/census.mjs -h\`. It re-derives every cause through this same collector with
the candidate applied to the records, rather than matching a rendered cause string, and a figure in a
filing states the command that produced it or says that it cannot be re-taken.`;
