/* Everything this gate's help says about a test step that failed: which cases did, what re-running
   each of them alone answers and does not answer, and what a case the previous attribution already
   named at this content becomes. Its own file because the runner's is at the line limit its own
   checker sets, and this is the section ISS-2251 grew. `tools/gates.mjs -h` prints it in place. */
export const ATTRIBUTION_HELP = `A test step that fails says which cases did, and then re-runs each of them once, alone, at this same
head, under a temporary directory of that re-run's own. A case the re-run reproduces is this tree's:
the gate refuses and names it, rather than naming the step and leaving a run to guess. A case it does
not reproduce has not been shown to be this tree's, and the gate carries on — that is all one re-run
can say, and it says no more: a starved process and an interaction between cases both answer this
way. One re-run per case and never a loop, because a tree failure retried into green is the one
thing this may not do. A case the previous attribution of that step named at this same digest is said
to be a suite-interaction finding instead. Whichever way its cases went,
a step that failed records no pass — cases passing one at a time are not the suite passing — so the
next invocation spends it whole, and a run that re-ran anything prints neither the line a clean run
prints nor a figure of its own.

**A suite-interaction finding files an issue, and refuses nothing.** Ruled on 2026-09-09 (ISS-925)
between four readings, three of which refuse: a case that fails in company and passes alone twice at
one content gets an owner on this project's backlog, and the landing proceeds. The exit status of
every step and of the whole run is exactly what it would have been with no recurrence in it, which
is what the re-run's own ruling settles and this changes no part of. The issue carries the case, its
file, this step, the digest, both attributions' times and that it passed alone at each, so that
nobody has to read the middle of this log to work it; the verdict block names the issue beside the
case, for the same reason.

A finding is the case's whole file and its whole name, and no more, digested into a marker the title
carries: **a second recurrence of one case comments on that case's issue rather than filing again**,
found by searching the backlog for that marker and matching it in a title, never by a count kept
here. A renamed case or a moved file is a new finding.

**One attribution pass reaches one row.** A pass that named several cases at once is one finding
about how this step runs at this content and not one per case, so it carries a second marker
digested from the step and that content, and the row it files lists every case with its own per-case
marker under it. The next pass of that step at that content comments there however its membership
has drifted, and a case of it that later recurs on its own reaches that row by the second marker
unless it has a row of its own — which is the order the two are tried in, the case's own first. One
row per case was twenty-seven rows for one cause on this backlog, filed by the very run that could
see they arrived in one pass. An issue somebody has closed or dropped
answers nothing — a finding that came back past a close is filed again and the body names the
settled one — and a live issue is preferred over a settled one where both are there. A lookup that
does not come back whole files nothing and says so, because a page that came back short is a ceiling
and not an absence. A filing that cannot be made at all — no credential, no network, a checkout
without this plugin's own CLI — prints why, prints the body, prints the one command that files it by
hand, and leaves the run's status alone: a gate that cannot reach the tracker may not become a gate
that refuses. A run with nothing to file reaches none of this and sends no request.`;
