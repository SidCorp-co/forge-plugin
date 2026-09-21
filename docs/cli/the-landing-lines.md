# the landing lines

Where a change merges, and who judges it once it is built: two lines of the report whose answer is
the tracker's record and never a checkout's. [doctor](doctor.md) carries the rest of that report.

## Two lines Phase 0 reads before it plans a landing

**Where the merge sits is derived, not asked for.** The project already told the tracker whether its
default branch deploys production on its own, and that is the fact that decides it: one branch
deploying production means a push *is* the deploy, so a candidate is deployed and judged before it is
pushed; distinct branches mean the merge lands on staging and is judged there. A record answering
neither branch prints *not stated* rather than the safer-looking route, because a run told
*after-merge* by a default would deploy production without knowing it. The `landing` key in a
checkout overrides the derivation and prints its own source, so a project that disagrees with what
its record implies says so once, where a reader can see both.

**Whether an independent agent judges between `developed` and `testing` is the record's alone.** A
project has one tracker record and many checkouts, and QA belongs with the deploy facts rather than
beside them; read from a checkout instead, two clones of one project would judge the same change
differently. So a `qa` key in a project's configuration has no effect on this line, which prints
*not stated* until the record itself answers. This report says so at the point where there is still
time to change the record, and not at the transition that would later turn it down.
