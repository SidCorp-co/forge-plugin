# Proving a change, and capturing the evidence

## Before you edit

Take a **baseline**: run the project's gate once, whole and distrusting any remembered pass (`--full`
here), and record what already fails. Without
it a pre-existing red is indistinguishable from your regression, and you will either hide a
defect or repair something that was never yours. If a baseline cannot be obtained, say so
rather than proceeding as though it were green.

**A gate that stops at its first failure has measured only what ran.** One red at the front
leaves every step behind it unknown, and a baseline naming that one red is a baseline for
nothing after it: run the remaining steps by hand and record what each answered.

**The gate is spent once per unit of work.** The baseline above is the only whole run the work owes;
after it, one scoped run when a unit of work is finished — a change that stands on its own, never
each edit inside one — and in between the changed file's own suite, which answers one question
faster than any gate reaches it. The ship spends the gate itself, so the release's gate is
that run and there is nothing left to spend after the push. A gate that reads the diff and remembers
its passes makes the last of five runs cost what one costs, which is all the four before it bought:
1191 gate runs over 97 flow runs, five a run inside the build phase and 1.3 after a ship that had
already run it, are the figures ISS-290 was filed on. A gate too slow to spend once a unit is the
gate's defect and the gate-review skill is the route to it, never a reason to spend it less often.

## The order

1. **The repo's own gates.** Whatever the project defines. Passing them is the floor.
2. **Schema and deployment coupling, if the change has any.** Establish how a migration
   reaches the deployed environment before the merge — an entrypoint that migrates at boot
   means merging *is* a schema change. Then classify it, statement by statement, by what
   deploying it does to rows that already exist and to readers already running: **additive**
   where both come through untouched and the old code still works, **tightening** where an
   existing row or an older writer can violate what the statement now demands, **destructive**
   where it discards a value that running the migration backwards does not put back. Only the
   last of those stops the pipeline. Test reversibility only where the project's migration
   system supports it and only against a disposable database.
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

## Judge the head that will land

A verdict claims the evidence beside it was taken on the code that landed, so it names the commit it
judged — and that commit has to be the one the landing carries. **Replay the change on top of the
project's default branch head before you judge**, once, and prove it from there: that direction
moves the change and lands none of it. A branch cut days ago and brought forward only at the landing
is one whose proved head never lands, and every criterion then costs a second verdict at a head the
first could not have known.

The replay and the read that earns the review are Phase 4's last two steps, in that order, so the
head the reviewer judged and the head every verdict names are one head. A run that judges before
that read has bought its verdicts against a head the read can still move.

That leaves the landing whatever it adds of its own, and whatever other people landed while you were
judging, which where several runs work one tree at once is not nothing. Neither is a re-judging:
what a landing brings is other people's commits, and this change's own diff is unchanged by them.
Which of the two the flow makes you pay, and what the merged mark has to say for the verdicts to
stand: `forge guide contract developed`.

## What each kind of change owes as evidence

| Changed | Proof |
|---|---|
| A screen | the rendered state, driven — including empty, loading and error |
| An API | request and response, plus the side effect it claims |
| A CLI | the invocation and its output, including a non-zero exit |
| A library | a consumer exercising it, not a unit test of its internals |
| A batch or data job | fixture in, resulting records out |
| Generated output | the artefact opened, not the generator's exit code |
| Infrastructure | the plan, and a validation against a real environment |

## Standing up something to run against

**If the project has its own stack tooling, that tooling is the mechanism** — including
when it says the servers are shared and starting your own is the defect. Build a separate
stack only where the project has not decided, and then keep every port it owns out of the
range the user's stack owns.

- **A stack script may override outer environment variables.** Exporting a variable before
  calling it does nothing if the script sets its own inside the process it spawns; the
  override belongs inside the invocation the script actually executes.
- **Start background processes from the directory their dependencies resolve against.** A
  module-not-found from a background process is usually the working directory.
- **Wait for long work, never poll it.** A `sleep` inside a wait is refused, and that refusal names
  the two routes that ask nothing; `forge hooks --how polling` carries what it costs.
- **After stopping anything, confirm the user's own stack still answers.** The guard can
  refuse a command that cannot be aimed; it cannot tell you that you aimed correctly.

## When a symptom's cause is the environment

Some failures report their consequence and never their cause. Two that recur, as examples
of the class rather than as a checklist:

- A wait for network idle that never settles, because a development server holds a
  hot-reload connection open. Wait for the document plus an explicit pause.
- A click that times out because the API refused the request's origin. The browser reports
  a missing element; the cause is a CORS configuration pointing at a different port.

When a symptom makes no sense against the code you changed, suspect the environment before
suspecting the selector.

## Screenshots

Take them from a **production build** where the project can produce one locally:
development overlays and error badges land in the image and make a correct change look
broken. Where it cannot, say which build produced the image.

Screenshot the state a user reaches — create the data the screen needs, and remove it
afterwards. If seeding advanced a counter or a sequence, restore it; if the store was
disposable, destroy it wholesale instead, which is safer than editing a counter back.

**An image left on your disk proved nothing to anyone.** It belongs on the issue with the QA
report that cites it, uploaded rather than pasted through context — `forge -h` names the
verb. This is the one evidence type whose whole purpose is that somebody else looks at it.
