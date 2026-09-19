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

Which checkout this process stands in, and which repository that checkout belongs to, are read off
the disk rather than asked of git, and what that walk has to do differently from `git rev-parse`:
[the checkout walk](the-checkout-walk.md).

The once-only memo remembers *that* it ran, not what it returned — four of the seven it replaced tested
the value for truthiness and re-ran on a valid `null`. Unmemoised, one `forge issue` spawned
`git rev-parse` nine times. Flag parsing lives in one place: three verbs had grown their own copy and
two dropped a valueless flag silently, which reads as an unfiltered answer.

**A value whose right answer differs between two boxes working one checkout is the machine's, and
is never in a file that is committed.** That line decides the whole of what `~/.config/forge/` holds
and what a `.forge.json` may: the instance url, the tracker credential, every key of a harness
service — the reviewer's gateway, the Vietnamese gateway, Cloudflare, Coolify, the ChatGPT endpoint —
and `withheld`, `withheldSkills`, `capabilities` and `ship`. A project file carrying any of them
would hand every checkout of it one box's credential and one box's record of what a credential may
spend, which is wrong for the second box and undiscoverable from it. Everything on the other side of
the line is a decision one tracker made once and every checkout of it should read alike.

The three harness services this file is the source for each had a store of their own first, and two
of them keep theirs as a fallback for a key this one does not set, so that a box set up before the
keys existed is not a box that stopped working. Provenance is the whole of what makes that bearable:
the report answers *which file*, not *whether a file*, for each key separately, so a key answered
from the fallback and a key answered from here sit on adjacent lines saying so.

**A project's release policy is the tracker's and not a checkout's.** The staging branch, the
production branch and the automatic production deploy are project columns already, and `forge
project` prints them under the names their owner uses — the tracker's `baseBranch` is the staging
branch everywhere but in the one reader that fetches it, and doctor's release lines are a second
view of the same answer. An automatic production deploy onto a branch the tracker
holds as null is the incoherence its own schema warns of, and it is reported: until the branch is
set, the person's look stands. What the same report does with the deploy behind that branch is
[doctor](doctor.md).

**One flow reads five settings, and each names the level that owns it** — which level, and why:
[two levels](../two-levels.md). Four are the project's, in its own `.forge.json`: `feedback`, two
channels (`off | bugs | all`) saying whether a run may report on this plugin and on the project
itself; `flow`, which of the served method sets this project runs, pinning the guide, the method and
the contract together because they are one designed set and a project mixing them runs text nobody
tested; `landing`, where the merge sits; and `lease.workingRe`, what a run working in one of this
project's trees is running, which is the only thing that separates two agents standing in one tree.
The fifth is the machine's, in the user config beside the withheld verbs: `ship`, whether a run
lands its own change or ends ready for another actor to land it. `forge doctor` prints all five with
their sources, and it is the only surface allowed to.

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
