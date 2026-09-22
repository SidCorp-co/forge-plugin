## Phase 2 — Triage, before anything is dispatched

For each candidate, decide whether it is worth a run at all. A claim in an issue is a hypothesis
about code nobody has read; the cheap dispositions are what this phase exists to find, and each is
posted with its evidence before the wave moves on. The kinds, what each is earned by, and the walk
from a lead to a posted disposition: `forge guide dispatch dispositions`.

A candidate that survives triage gets one line recorded on it: the head it was judged against, the
issue's own last-modified stamp, the dependency state at that moment, and the goal the filing says
it serves. The first three are what the executor re-triages on — any of them moving means the
recommendation was made against a tree that no longer exists. The fourth is read off the filing and
never invented here, so the fold can say what the wave served and how much of it served nothing
stated.

**A candidate that survives also carries a reading of where it sits.** Core, where the surface it
names is met by a run doing nothing unusual; edge, where it is met on a route the project itself
declares or chooses; peripheral, where no run reaches it unless somebody is investigating. The
reading is earned by naming the act that meets the issue, never by asserting a tier, and where two of
the three would both fit the higher one is the reading — a surface a project's own configuration can
put on the path an ordinary run walks is edge and not peripheral, however rarely that configuration
is chosen, because the tier says what the issue can cost and the option being unpopular is a fact
about today's projects rather than about the issue.

**That reading is not the priority field.** Priority is what somebody wants done; this is where the
issue sits. Two issues carrying one band differ by orders of magnitude in what they cost, and a
reader given the band alone cannot tell a defect every run meets from one nobody meets. Conflating
them loses both readings and leaves the order sorting on the one that was never about cost.

**A candidate that survives also carries a complexity, and the tracker's `complexity` field is
where.** Setting it is this phase's, because it is the same reading triage has just done: `forge
issue ISS-nn --set complexity=<value> --why <w>`, the why naming what was read to judge it — the
files the change would touch, whether a person sees the result, whether a rule changes. Which value claims which rung, and
what a rung then buys, is the contract's. The write goes on the issue and nowhere else, so the brief
carries no rung and there is nothing for a run to find disagreeing with the field.

**The complexity is set before the brief, and no run is dispatched on an issue holding none.** An
issue nobody weighed spends a run's payloads settling a question one write here answers, and the
ranking verb names that gap on every lead, so this is a step the order has already pointed at.

**A band set while a slot is waiting on the answer is provisional, and goes in recorded as one.**
The reading behind a band is the same reading whether a slot waits on it or not, but a reader who
wants the slot filled is not the one to judge that it was done — so where a candidate arrives
carrying none and the wave wants it now, the band is written as provisional together with the reason
it could not be read, rather than as a value typed with the confidence of one that was. Drawing
unsized issues in earlier is what makes that the rare case rather than the ordinary one, and it
lowers nothing the reading behind a band has to carry.

**The rung a band claims is what obliges a run to find the cause rather than route around it.** So a
band set to clear a gate is a standard lowered on purpose, and it is never set that way without
saying so. That is why the paragraph above is a rule and not a preference.

**This phase's three writes — the confirmation, the candidate line and the complexity — belong to
whoever did the reading, and that reader makes them.** The confirmation is the one that carries a
disposition where there is one, so a verdict of *holds* drops none of the three. One handed back as a
recommendation is this phase left unfinished, and a fold that can say what it passed on rather than
what it did. The candidate line takes no lease, being a finder's post; what lease the other two take
is `forge claim -h`'s, which the refusal each of them meets without one prints as well. Where the
CLI grows a route needing no lease for either, that route is the one this phase takes, and a lease
the CLI withholds is not worked around.

**Where several candidates are distinct symptoms of one cause, the reading is a cluster.** Its
members are related to one another on the tracker rather than only described together in one place,
and each keeps its own key, its own evidence and its own disposition: each is a symptom somebody will
check the fix against, and a fold destroys the thing that would have proved it. The cause goes in one
sentence that names no issue key — a cause that can only be described by listing its issues is not a
cause, and the sentence is what the owner reads to judge whether one change answers all of them.

**Two issues sharing a file are neighbours, not a cluster.** What makes a cluster is a shared cause.
A forced one costs more than none, because it sends one change at two problems and the change is
shaped by neither.

**A cluster is this phase's to propose and the owner's to decide.** Triage names it and does not file
the grouping issue: a grouped change is a commitment about what gets built next, which is a decision
this phase reads for and does not take.

Where the candidates are divided among readers, each candidate belongs to exactly one of them. A
slice cut by a search term is not a partition: a body answering two terms is read twice, and the
two readers race for its lease and duplicate the reading that earns the writes above.

A candidate too big for one run is split before it is dispatched.
