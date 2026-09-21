# The two rungs above `developed`, and which actor answers for each

`testing` reads a judge's verdicts and `awaiting_release` reads a deploying actor's verification, and
neither reads the other's record. This is the argument for that division and for the one field whose
demand sat on the wrong side of it; what a rung is entered on, rung by rung, is `forge guide
contract`.

## A verification names the deployment, where the project deploys on its own

A project can set `pipelineConfig.autoProdDeploy`, and that setting decides who is *asked* — with it,
the rung waits for no person's look. It does not decide what *ships*, and nothing in this plugin
deploys anything: the machine that advances an issue need not be the one that shipped it, so what git
and a host know is written onto the record at the step that knew it, here as everywhere else.

On one project measured on 2026-09-05 the two came apart. The host had no push-to-deploy configured
at all, five landings sat undeployed under the release rung, and three separate runs read the
setting as the host's and went to verify a build that predated their own landing. A run that does
that reports a correct fix as broken, or records a passing verification against code nobody shipped.

So where the setting is on, the rung reads the verification against the record rather than taking
it: its commit is the one the merged mark names, and its evidence is not every-item a bare sha, since
a sha names no deployment. The refusal says the sha is read from the deployment's own build log and
never assumed from the branch head, which is the step that was being skipped. A project that has not
set it, and a project whose config did not answer, are judged exactly as before — the silence this
plugin owes a project that has decided nothing.

**This rung is the only one that asks for a deployment identity, whichever half of it a project
earns.** Every project owes the verification record itself: where the change now runs, at which
commit, with the evidence. The setting buys the two comparisons above on top of that, and nothing
else in the ladder asks the question — a project with nothing running reaches here by a verification
whose *where* names the branch and no host, which is what `forge doctor` reports for such a project,
and nothing is deployed so that a field holds a value.

The equality alone would have been a refusal with no way past it. A host that coalesces landings
builds a head the change never was, and that build is running the change: on such a project the
exact commit may never be built, and a run could only sit at the rung having shipped, redeploy an
older revision, or type a sha it had not read. So the verification carries the two facts apart — the
commit the deployment reports, and the landed commit that build contains — and the second is what
the equality is held to where they differ. The field is optional, a shape's records outliving the
day it grew, and the refusal names it in the command it prints.

Neither clause can tell a deployed build from a described one; that is the line every field of a
record is read on. What they buy is that the run has to have looked, and that the two shas on the
record are the same code.


## A verdict names its judge

`pipelineConfig.qa` takes `independent`: the run that wrote the change may not be the run that says
it works. Nothing here tells two agents apart by watching them, so the claim goes on the record.
`forge record verdict` writes the writer's session id as a `judge:` line and where that id came from
as `judge-from:`, off the session the CLI resolved and never off a flag — `--judge` is refused, for
the reason the lease's holder is read rather than passed. Declared on the shape so the read keeps
them, and `newer` for the reason `--scope` is below.

`testing` reads each standing verdict against the landing checkpoint, the only record naming both the
builder and what the deployment reported running. The builder's own id is the case the project asked
about. *No* judge is refused too, and is not read as the builder's: `judge` is excused at the
read-back, so a check comparing only ids would pass it in silence. An id a run inherited is refused
however it compares — two ids that differ are two runs only where each is a run's own — naming the
wave that dispatched it and no run in it; one with no source at all is judged as it was written.

The last is the one worth the argument. A verdict cites the deployment identity off its evidence,
never off its commit: under route after-merge that identity *is* the merged head, which every verdict
already carries in the commit slot, so a commit read would pass an ordinary builder verdict by
accident.

**The citation is asked for where the checkpoint holds an identity and never demanded of one that
holds none.** Only a reconstruction declares an identity, and the ordinary capture composes no such
key, so demanding one here asked the judging rung for a value only the rung above produces — which
closed the ladder above `developed` for every project that asked for a judge at all, on any issue
that landed the ordinary way. What the rung reads instead is what its own actor can answer for: the
judge is present, is its own rather than the wave's, and is apart from the builder the checkpoint
names or from the holders the claim history does. None of those reads a deployment, so nothing about
a builder's own verdict got easier; a checkpoint that *does* name an identity is still spent, a
verdict answering to some other head having judged something else.

Inverted, the reading is what a promotion spends: a candidate whose base or batch moved is deployed
again under a new identity, so verdicts citing the old one judged what is no longer there and are
void — named rather than counted, a count saying nothing about which. Which of the two moved it
cannot say, the checkpoint keeping current values and not their predecessors. A project setting no
`qa` line is judged as before, the silence this plugin owes one that has decided nothing.
