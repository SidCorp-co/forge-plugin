# Settings

Provenance is the shape of every answer rather than a courtesy some resolvers extend, because that is
what doctor reports. Credentials that resolve by directory are the account's in name only, which is why
one file answers and a setup that stops answering in silence is the failure the report exists for.

Six environment variables remain and none is a value — two say where config lives, two are what the
platform passes a hook, two are kill switches, and a kill switch has to work when the config file is
what is broken. A test walks every source and fails on a seventh name, because an env read is one line
that looks like every other line.

**Credentials sit outside every repository.** A token in a repo file is one `git add -A` from a remote.
The config is 0600 from the moment it exists: chmodding afterwards leaves it world-readable for the
length of the write, and a temp file a crashed run left behind would take the token at whatever
permissions it already had.

**A run home borrows the credential by reference and never holds a copy of it.** A run that must write
nothing into the machine's own logs points its configuration home somewhere of its own, and a home is
all or nothing: until a home could borrow, the only way a run reached live data from one was to copy
the token into scratch, where it sat world-traversable for the run's length and outlived any run that
died. `FORGE_BORROW_FROM` names the machine's file, not a value, so that file stays the one source a
credential has, which is why it sits beside `XDG_CONFIG_HOME` among the variables that say where
configuration lives. A borrowed key is read from that file each time it is read, so a rotated
credential reaches a running probe; a write to one under the borrowing home is refused rather than
redirected, since a write landing in the machine's file from a run is exactly what the home was made
to prevent. A borrow that resolves to nothing is refused too, because a borrow answering *no
credential* sent the reader to a refusal naming a file it was never going to use. Which keys may be
borrowed is one table, and the secret ones are what a workspace's ending searches its scratch for: a
copy found there is one no record says a run made.

Which checkout this process stands in, and which repository that checkout belongs to, are read off
the disk rather than asked of git, and what that walk has to do differently from `git rev-parse`:
[the checkout walk](the-checkout-walk.md).

The once-only memo remembers *that* it ran, not what it returned — four of the seven it replaced tested
the value for truthiness and re-ran on a valid `null`. Unmemoised, one `forge issue` spawned
`git rev-parse` nine times. Flag parsing lives in one place: three verbs had grown their own copy and
two dropped a valueless flag silently, which reads as an unfiltered answer.

**A value whose right answer differs between two boxes working one checkout is the machine's, and
is never in a file that is committed.** That line decides the whole of what this machine answers
for itself and what it answers per project — the two sit side by side, the machine's own in
`~/.config/forge/config.json` and each project's in
`~/.config/forge/projects/<root folder>/config.json`, and the line is about which of the two a key
belongs in rather than about which of them a checkout carries: the instance url, the tracker credential, every key of a harness
service — the reviewer's gateway, the Vietnamese gateway, Cloudflare, Coolify, the ChatGPT endpoint —
and `withheld`, `withheldSkills` and `capabilities`. A project file carrying any of them
would hand every checkout of it one box's credential and one box's record of what a credential may
spend, which is wrong for the second box and undiscoverable from it. Everything on the other side of
the line is a decision one tracker made once and every checkout of it should read alike.

The three harness services this file is the source for each had a store of their own first, and two
of them keep theirs as a fallback for a key this one does not set, so that a box set up before the
keys existed is not a box that stopped working. Provenance is the whole of what makes that bearable:
the report answers *which file*, not *whether a file*, for each key separately, so a key answered
from the fallback and a key answered from here sit on adjacent lines saying so.

**A project's release policy is the tracker's and not a checkout's, with one field excepted.** The
release model, the branch each model has and the strategy that moves the code are project columns
already, and `forge project` prints them under the names their owner uses — the tracker's
`baseBranch` is the staging branch everywhere but in the one reader that fetches it, and doctor's
release lines are a second view of the same answer. The model is what the policy is read off, and
the branch is a field of the one model that has one: asking for a branch under a model that declares
none is how every project's policy came to read unreadable at once (ISS-1888). An automatic
production deploy beside a model the tracker holds as null, or beside a promoting model with no
branch to promote to, is the incoherence its own schema warns of, and it is reported: until the
declaration is made, the person's look stands. What the same report does with the deploy behind that
branch is [doctor](doctor.md).

**The excepted field is whether production deploys without a person, which moved to `release` on
2026-09-22** (ISS-2190). It is the one field of that policy a checkout can answer for itself, because
it is what the flow reads to decide whether an issue stops at `awaiting_release` and a project wants
that settled where the work is rather than on a screen somebody else administers. It moved rather
than gaining a second layer, and the tracker's field is what it falls back to rather than a twin
beside it: `pipelineConfig.autoProdDeploy` is live on projects this plugin is already installed in,
so a project that has not set the key reads as it did before the move and one that has overrides it.
The report's production-deploy row names which of the two answered, which is the whole of what makes
a fallback bearable here as it is for the two gateway files above.

**One flow reads six settings, and every one of them is the project's**, in this machine's record
of that project — which level, and why: [two levels](../two-levels.md). `feedback`, two
channels (`off | bugs | all`) saying whether a run may report on this plugin and on the project
itself; `flow`, which of the served method sets this project runs, pinning the guide, the method and
the contract together because they are one designed set and a project mixing them runs text nobody
tested; `landing`, where the merge sits; `lease.workingRe`, what a run working in one of this
project's trees is running, which is the only thing that separates two agents standing in one tree;
`ship`, whether a run lands its own change or ends ready for another actor to land it; and
`release`, whether a change goes out without a person's look. `forge doctor` prints all six with
their sources, and it is the only surface allowed to. A seventh, `redBatch`, is read by no step of
the flow and by this repository's landing alone: what a set its combined gate refused is landed as.

**`ship` was the machine's until 2026-09-22 and is the project's now** (ISS-2174). What decided it is
the line at the top of this page rather than a preference: the right answer differs between two
projects on one box, which is what makes it not the machine's, and it does not differ between two
boxes working one checkout. It is also the key `landing` and `drainedBy` describe the consequences
of, and a switch kept in a different store from the two keys about the same landing is the split this
page exists to stop. It moved rather than gaining a second layer, so a `ship` an older release wrote
into the machine's own file decides nothing and `forge doctor` says it is ignored.

Two of those behave unlike the rest, each for a reason worth stating. **`landing` overrides and never
defaults**: the project already told the tracker whether its default branch deploys production on its
own, so the route is derived from that record — one branch deploying production means the push *is*
the deploy and the candidate is judged before it, distinct branches mean the merge lands on staging
and is judged there — and a record answering neither is *not stated*, discovered rather than
defaulted to a route the project never chose. **A value a key does not take falls back rather than
refusing**: a typo in a key most calls never read would otherwise stop a call that has nothing to do
with it, so the behaviour takes the default and doctor alone names the text as written. The
independent-judgement policy is deliberately *not* here: a project has one tracker record and many
checkouts, so it lives with the deploy facts, and a `qa` key in a checkout moves nothing.

**`translate` off by default was measured, 2026-08-27:** sid-growth is Vietnamese and forge-dev is
English, so posting one convention into both is a wrong-language issue no verb can delete afterwards.
That failure is unrecoverable; a missing translation is an edit.
