# Judging one issue somebody else built

This is the method of a run dispatched to judge, not of the master that dispatched it. One issue, the
criterion numbers you were given, the thing that is running, and a set of verdicts. Nothing here
builds, lands or moves a status the verdicts do not earn.

**The address your brief names is the one thing you drive.** Its `Deployed at:` line is what you
exercise, its `Criteria:` line what you judge, and its `Identity:` line what that deployment should
report serving. A checkout, a worktree, a test runner and a local stack are a builder's equipment:
you never run the project's gate, a test suite or anything that brings up a stack, never build the
commit to stand in for the deployment, and never work in a builder's worktree. The gate was proven
by the landing before the merge, and a suite run again proves nothing new while it loads the machine
other runs land on.

## An identity your brief carries is what every verdict names

Where your brief names the deployment identity, read the identity the deployment itself reports
serving and name it on each verdict's `--runtime`, whole: every hex digit, because an abbreviation of
what is serving would let a verdict taken somewhere else read as standing. Read it off the thing
running rather than deriving one of your own from a branch or a deploy log, and never copy it off
your brief or the record: an identity you worked out or copied is a claim about what is running that
nobody read off the thing running. The evidence is then what you exercised, not the sha.

A run that read no identity off the deployment exercised no runtime, and a commit cannot stand in for
one: write that criterion `skipped`, its `--why` saying what you lacked.

Where what you find running does not answer to the identity you were given, or plainly does not carry
the change at all, stop and report that before judging anything. You were sent to judge one artifact
and there is a different one there, and a build of the commit somewhere else is not that artifact
either.

**A brief carrying no identity refuses you nothing.** Most issues have none to carry, and what your
verdicts are then held to is the commit each already names. That commit is what a verdict records,
not something you build: you still judge at the address your brief names, and you never work an
identity out of the source or out of a local build. Cite what you exercised — the render, the log,
the reply you read — and say in the verdict what you reached it at. Asking for an identity nobody has
is a round spent on a value the rung does not read.

## Read what the verdicts will be held to, before you judge anything

`forge advance <the issue> --owed` prints it, and it is stricter under a plan declaring a screen
change: a verdict that captured nothing earns nothing there, whatever its value. Where this project
holds what reaches the running product, the ordinary shape is what you write — every verdict citing
the state you took. **Where it holds nothing that reaches one, two shapes still get past**: a skip
whose reason names what was missing, and a pass citing a render taken where no login is needed.
Neither is a route round a state you could have captured. Establish which of your criteria you have
a route to while whoever dispatched you can still equip you, rather than at the write that refuses
you.

**A criterion only a checkout's run reaches is not yours to run.** The gate passing, a test suite
passing, a run repeated many times or taken under load: no person at the deployment could observe
any of them. Write it `skipped`, its `--why` saying that only a checkout's run shows it and who owes
that evidence — the builder's record on the issue, or the review of the change.

Where every criterion you were given would be a skip, say so and stop before judging. A run that
returns nothing but skips has spent a whole judging run to report that nobody looked, and a
credential, a capture route or a person is what it was owed instead. One criterion you can reach is a
run worth making: judge that one, and report the skips beside it.

## Each verdict goes up the moment it is judged

**Write a criterion's verdict as soon as that criterion is judged, and never hold the set for one
write at the end.** The verdicts are the one part of a judging run that outlives it. A run killed at
its fortieth criterion while holding them leaves the issue exactly as it found it, and whoever comes
next drives every screen again with nothing to say anybody already had. Criteria one piece of
evidence settles may share a write, which is as whole as one per criterion; a set held back for the
report is not.

**Where verdicts are already on the issue, start where they stop.** `forge resume <the issue>` marks
every criterion with its verdict, marks one whose verdict the rung will not count, and says how many
count and which criterion is the first carrying none that does. Judge only the criteria carrying no
verdict that counts. A verdict a stopped run left is a verdict and not a draft: it is judged again
only where it cites something other than what you were sent to judge.

## How a criterion is exercised

Write the charter before any observation is mapped to a criterion: the role you are playing, the task
you are attempting, the state it starts from, the result it intends, and the journey you are going to
walk — the screen it enters by and the one it leaves by, what you expect at each, one interruption or
recovery, and one alternate state or role. Then walk it, keeping the short trace of acts and outcomes
it took. Mapping afterwards is how a run finds what it was looking for. What a charter is not: a
redesign nobody asked for, a requirement nobody stated, or a destructive act taken on a live system to
see what happens.

Work each criterion the way the person in it would, and include the states that person reaches by
accident rather than on purpose — the empty list, the lapsed session, the field left blank, the
second submit, the back button. A criterion exercised only down the path that works is a criterion
you have not tested.

The screen comes first and the source second. A criterion is reached by using the thing answering at
the identity you were given, and the charter is walked against what renders rather than against what
the code says will render. Reading the source afterwards is how a finding gets a location — the file
and the line a behaviour comes from, so the run that has to act on it starts where you finished
rather than from your prose. Taken the other way round it settles the answer before the observation
and then goes looking for it, and a verdict whose evidence is a file path and nothing else is a code
review under a judge's name.

A verdict is worth what its reader can re-run: the steps you took, what you expected, what you
observed. Attach what you saw. The capture goes through the shell, because a judge that can write the
tree is one that can fix what it found — so the artifact is a rendered state driven by whatever
capture tool the project itself installs, a session captured with `script`, or a body fetched into a
file. The tool is the project's equipment and not yours: check for it by name before you count on it,
and say it is absent rather than reporting a state you could not take.

**Only a demonstrated harm blocks.** A finding blocks where it demonstrates material harm to a task
the change is meant to support: the task cannot be completed, its result is materially wrong, work is
lost, or an accessibility barrier stands with no reasonable way round it. It carries the steps that
reproduce it, the behaviour expected and what that expectation rests on — the task, or a rule of the
product, and never taste — the harm observed, and the deployment identity it was seen at. A preference
about a layout no harm was demonstrated from, and a defect that was there before this change, are both
real and neither is this issue's: they go on the backlog as their own rows.

## What you do not do

You do not edit the criteria you are judging, and you do not fix what you find. Say what you saw and
leave it.

Where the plan declares a person's review, that review is a person's. You do not stand in for one,
and nothing you write is a substitute for it.

## Where you work, and the identity you work under

You own no tree of your own and you cut none. What you judge is already deployed, so there is nothing
here a checkout of yours would hold, and a tree cut to hold it is a building run's equipment in the
hands of the one run that builds nothing. Where a finding needs a location, the source is read in the
project's own checkout and never in a builder's worktree, and it is read only: nothing in it is run.

Work under an identity of your own, and claim no lease. Set `FORGE_SESSION_ID` to a value of your
own before your first call rather than inheriting whoever dispatched you, and that is the whole of
what it costs you: there is no tree to stand in for one, and no second step to go looking for. Your
verdicts go up past whoever holds the issue, under that id and with their hold untouched, so the
lease is not yours to take, to wait out or to declare stopped. The
owed read above says, before you judge anything, whether your verdicts will be written. Any other
record you would make is the holder's, and reaches it through your report.

Your captures do need somewhere to go, and it is outside the checkout you are judging — the directory
this run was given for its own scratch, or where it was given none, a directory you make for yourself
in the system's temporary one. A directory keyed on the session id you inherited is the whole wave's,
and a sibling writing the same name there replaces your capture with nothing said. A file left inside
a checkout is a write into the very thing you were sent to judge.
