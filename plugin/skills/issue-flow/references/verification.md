# Proving a change, and capturing the evidence

## Before you edit

Take a **baseline**: run the smallest relevant gate and record what already fails. Without
it a pre-existing red is indistinguishable from your regression, and you will either hide a
defect or repair something that was never yours. If a baseline cannot be obtained, say so
rather than proceeding as though it were green.

## The order

1. **The repo's own gates.** Whatever the project defines. Passing them is the floor.
2. **Schema and deployment coupling, if the change has any.** Establish how a migration
   reaches the deployed environment before the merge — an entrypoint that migrates at boot
   means merging *is* a schema change. Then classify it: `scripts/migration-risk.mjs` sorts
   additive from tightening from destructive, and only the last of those stops the pipeline.
   Test reversibility only where the project's migration system supports it and only against
   a disposable database.
3. **Blast radius.** Grep for what you changed — the renamed symbol, the removed field, the
   altered response shape. Nothing asserts what nothing covers. **That grep is blind to a
   change of provenance**: where every identifier stays and only who assigns the value moved,
   the code still reading the old convention mentions no line of the diff, and the sweep comes
   back clean. `scripts/blast-radius.mjs` covers that case, ranking the files that share the
   diff's narrow identifiers and sit outside it. Its output is a reading list and not findings
   — say, of the top entries, whether the change alters what each one reads.
4. **Proof suited to what you changed** (below).
5. **Look at the result.** The only step with no substitute.

**An item that names something this project does not have is skipped, and the skip is
said.** A library has no deployment; a CLI has no screen. Silence about a skipped step
reads as a step that passed.

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
