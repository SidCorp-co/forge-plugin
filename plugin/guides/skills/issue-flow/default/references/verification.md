# Proving a change, and capturing the evidence

## What a run measures

**A run proves its own change, and the whole-tree gate is the landing's.** The landing spends that
gate once, on the change merged onto the base as the base is at that moment, and hands a red back
to the run that built the change with the failing cases named; a gate any run spent before it
measured a base the landing measures again. So a run takes no baseline and spends no gate: what it
spends is the suites that exercise the files it touched and the checks that answer in seconds.
Where the landing is the run's own ship, that ship is the one place the gate is spent. Where it is
another actor's, the gate typed in a session is refused, and `forge hooks --how landing-gate` says
why.

**What is read is a check's own verdict, never its log or the notice that it ended.** A completion
notice says a process ended, and a log with no verdict in it cannot tell a check still running from
one that died at a step or one that never started. Where a check writes no verdict, its log is read
once the notice arrives and never before.

**The checks that answer in seconds are spent before a landing is armed, and the file set is put
beside the review's after them.** A fault the landing is the first thing to meet is paid for at the
landing's price and paid again at that price after the fix, where the changed file's own suite and
the cheap checkers standing in the tree would have answered while the run was still editing. So
those go first; then put the paths this change touched beside the file list the review read — `git
diff --name-only <base>...HEAD` — and settle any difference before the arming rather than leaving it
for the landing to find, because a review earned over one file set is not a review of another.

## A measurement does not race what it reads

A proof whose cost makes rerunning it a decision rather than a reflex — a suite repeated under load, a
sweep over live data that runs the better part of an hour — carries one more duty once it is under
way: say the condition holds before you measure, and take the figure against a head that is already
settled, or, where that head cannot be had first, state which round the figure was taken at and what
moved after it. A proof cheap enough to rerun freely owes none of this; the cost is the whole of the
condition, not a count of minutes.

**The word that fails is "started."** Told to start a proof and carry on, a run reads permission to
keep working the moment the process is launched — but the launch is not the guarantee. To the proof,
a run moving on to its own next edit is no different from a review round landing a fix mid-run: both
move the subject before the verdict is in. The rule binds on the **verdict**, not the start: what a
running measurement reads stands until the run has read that measurement's own verdict, whichever
of the two would otherwise move it.
Holding the edit is not idling — read, plan, answer whatever else is owed, and let only the write to
the tree it is reading wait.

Where the tree moved anyway, that is not a clean reading and it is never reported as one: say, in the
verdict's own words, that the subject changed and when. Where a criterion still needs a reading
against an unmoved head, take a second one there for that criterion alone rather than stretch the
first to cover it. None of this asks for a rerun after every review round, which would cost more than
the defect it guards against — only that a run already inside a measurement does not also move what
it is measuring.

## The order

1. **The suites that exercise what you changed, and the checks that answer in seconds.** That is
   the floor; the whole gate is the landing's.
2. **Schema and deployment coupling, if the change has any.** Establish how a migration
   reaches the deployed environment before the merge — an entrypoint that migrates at boot
   means merging *is* a schema change. Then classify it, statement by statement, by what
   deploying it does to rows that already exist and to readers already running: **additive**
   where both come through untouched and the old code still works, **tightening** where an
   existing row or an older writer can violate what the statement now demands, **destructive**
   where it discards a value that running the migration backwards does not put back. Only the
   last of those stops the pipeline. Both halves, the route and each statement's class, go on
   the issue as `forge record migration`: that record is what a plan declaring schema coupling
   is judged by, and no attachment stands in for it. Test reversibility only where the
   project's migration system supports it and only against a disposable database.
3. **Blast radius.** Grep for what you changed — the renamed symbol, the removed field, the
   altered response shape. Nothing asserts what nothing covers. **That grep is blind to a
   change of provenance**: where every identifier stays and only who assigns the value moved,
   the code still reading the old convention mentions no line of the diff, and the sweep comes
   back clean. Cover that case by hand: take the identifiers the diff touches, drop the ones
   the whole tree uses, and list the files outside the diff that share what is left, the most
   shared first. That list is a reading list and not findings — say, of the top entries,
   whether the change alters what each one reads.
4. **Proof suited to what you changed** (below).
5. **Look at the result.** The only step with no substitute.

**An item that names something this project does not have is skipped, and the skip is
said.** A library has no deployment; a CLI has no screen. Silence about a skipped step
reads as a step that passed.

## One run of the evidence, at the head Phase 4's last two steps left

Run it once, at that head, and attach it once. A suite re-run per criterion proves nothing the first
run did not. The verdicts go up together, all criteria in a single record (`forge record verdict -h`),
and the suite runs again only for a criterion whose evidence is its own.

## What each kind of change owes as evidence

| Changed | Proof |
|---|---|
| An API | request and response, plus the side effect it claims |
| A CLI | the invocation and its output, including a non-zero exit |
| A library | a consumer exercising it, not a unit test of its internals |
| A batch or data job | fixture in, resulting records out |
| Generated output | the artefact opened, not the generator's exit code |
| Infrastructure | the plan, and a validation against a real environment |
| A rule a checker enforces | the case that fails without it, watched red twice (below) |

## What a new test is asked before it is added

A test is upkeep from the day it lands: every later change to what it touches pays to keep it green,
so a case earns its place by the failure it would catch and not by the line it covers. Every new or
changed case is asked four questions, and the answers are the run's to give before the case goes in:

1. **Which criterion or contract does it prove?** The behaviour a caller relies on, not the function
   the case happens to call.
2. **What regression makes it fail?** A change to the source concrete enough that someone could make
   it and watch the case go red.
3. **Which existing case already owns that contract, and why does that one not catch the failure?**
   Where none does, that is the answer; where one does, the new case exists only for what it misses.
4. **Does it need an export or a hook that no production caller needs?** A seam opened for the test
   alone proves the seam, not the path a caller takes.

What the answers decide:

- **A case with no answer to the first two is not added.** It asserts nothing anybody depends on,
  and it will be kept green for no reason.
- **A case whose owner already catches the failure extends that owner** rather than standing beside
  it: two cases on one contract are two to keep for one signal.
- **A case that needs a test-only seam moves to the real entry point**, the one a caller reaches,
  and the seam goes with it.

These are judged rather than checked: whether a case is worth its upkeep turns on what the project
relies on, which no pattern over a test's text can see. Where the project states its own rules for
tests, those answer first.

## The case that proves a rule is watched red twice

A change that adds a rule — a checker, a guard, a validation — is proved by a case that fails
without it, and one reading of that red is not that proof. A case whose outcome turns on anything
but the source — an overdue timer, a file an earlier case wrote, the share of the machine a process
got — fails one way and passes the other, and from inside a single reading a case that fails cannot
be told from a case that failed that time. Neither can the case that could never have failed: it
reads green against the fix afterwards exactly as a real one does, and nothing ever says so.

So take two readings, both against the source the fix is not in yet: **the case on its own**, and
**the whole of the file it lives in**. Any runner that can select a case by name gives both, and
how that selection is spelled is the project's, as the gate's own name is. What the two are
compared on is that one case's own result in each reading and never the run's exit status — a case
can pass in a file where a sibling fails, which leaves the run red and the case green, and an
exit-status reading calls that a red watched twice.

- **Red in both** — the case failed in both readings and the pair found no disagreement, which is
  the reading a run goes on from. It says that and no more: it rules out neither a schedule under
  which the case passes, nor a red the rule is not about, which is read off the assertion that
  failed. A case that never reached that assertion, a fixture or an import having gone first,
  proved nothing in either reading.
- **Green in both** — nothing was watched. The case showed no failure against this source in either
  reading: the fix may already be in the tree, and the reading is owed before it, or the case may
  not be able to fail at all.
- **One of each** — the readings disagree, so neither of them says anything about the source. One
  pair cannot tell an interaction with what ran before from a process that got a different share of
  the machine, and it is not asked to: reshape the case until the two agree.

The second reading costs one more run of that file per case proven. Where the project's own tooling
takes both and judges them, the project's rules name it; where there is none, the two runs and the
comparison between them are the run's own.

## Standing up something to run against

**If the project has its own stack tooling, that tooling is the mechanism** — including
when it says the servers are shared and starting your own is the defect. Build a separate
stack only where the project has not decided, and then keep every port it owns out of the
range the user's stack owns.

- **A stack script may override outer environment variables.** Exporting a variable before
  calling it does nothing if the script sets its own inside the process it spawns; the
  override belongs inside the invocation the script actually executes.
- **Wait for long work, never poll it.** The routes that ask nothing, and what asking again costs:
  `forge hooks --how polling`.
- **After stopping anything, confirm the user's own stack still answers** — no guard can tell you
  that you aimed correctly.
