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

The once-only memo remembers *that* it ran, not what it returned — four of the seven it replaced tested
the value for truthiness and re-ran on a valid `null`. Unmemoised, one `forge issue` spawned
`git rev-parse` nine times. Flag parsing lives in one place: three verbs had grown their own copy and
two dropped a valueless flag silently, which reads as an unfiltered answer.

**Which checkout, and which repository, are now read off the disk rather than asked of git.** The memo
brought nine spawns down to two, and two per process is still a process per test file: the gate's read
audit has to treat any child standing in the checkout as able to have read all of it, so each of those
two blinded the file that spawned it and the gate spent it again whatever moved (ISS-1732).
`plugin/src/git/checkout-at.mjs` ascends for `.git`, follows the `gitdir:` pointer a linked
worktree's `.git` file carries, and reads that admin directory's `commondir` for the repository — git's
own fallback where there is none being that a git directory is its own common one. It reads nothing
else, and `.git` is what the audit already declares itself blind to, so no read set gains a path from
it. Null means no checkout holds the path, which is the cue `checkoutRoot` falls back on rather than a
failure, and the walk starts at the physical path so a symlink into another repository ascends into the
one it was spelt under.

Three places it has to do what git does rather than what the path says, each one a review of this
change found and each one reproduced against git before it moved.

**Anything named `.git` is accepted only where it holds a `HEAD`**, because git's discovery accepts
only a git directory: a checkout holding an empty `sub/.git` answers with the checkout and not with
`sub`, and a `.git` file naming a directory that is not there — a stale worktree whose main checkout
was moved — answers with nothing rather than with a repository that is not one. Either way a walk that
took the path at its word would have resolved a project file from a directory that is no checkout.
`HEAD` is what this asks for where git also wants `refs` and `objects`, so a directory holding `HEAD`
alone is one this accepts and git does not — and it is asked for without being followed, git's older
symbolic-link spelling of `HEAD` pointing at a branch that has no commit yet.

**A named common directory is canonicalised before its parent is taken**, because git canonicalises
it: a `commondir` naming a symlink would otherwise put the repository beside the symlink rather than
beside the directory it points at, and a worktree carrying no project file would lose the one its main
checkout holds.

**It is canonicalised uncollapsed, and through the native call.** A `..` is taken off after the symlink
before it by the filesystem git reads through, and lexically by `path.resolve` and by node's own
`realpathSync`; only `realpathSync.native`, handed a path nothing has collapsed, answers as git does
for a `commondir` spelt `jump/../.git`.

It assumes the working tree is the directory holding `.git`, and git answers differently in five
shapes. Four are environment — `GIT_DIR`, `GIT_WORK_TREE`, `GIT_COMMON_DIR` and
`GIT_CEILING_DIRECTORIES` each move `git rev-parse`'s answer and move nothing here. The fifth needs no
environment at all: `core.worktree` in a repository's own config names a working tree somewhere else
and `--show-toplevel` follows it, where this names the directory holding `.git` regardless. That layout
is **unsupported rather than equivalent** — reading it means parsing a git config file for an answer
this product has no shape for, and a walk that half-followed it would be worse than one that says it
does not. Two narrower differences: `git rev-parse` refuses a checkout whose ownership `safe.directory`
does not cover, where the walk answers; and in a bare repository it names the directory above, where the
walk finds no `.git` and answers null.

**A project's release policy is the tracker's and not a checkout's.** The staging branch, the
production branch and the automatic production deploy are project columns already, and `forge
project` prints them under the names their owner uses — the tracker's `baseBranch` is the staging
branch everywhere but in the one reader that fetches it, and doctor's release lines are a second
view of the same answer. An automatic production deploy onto a branch the tracker
holds as null is the incoherence its own schema warns of, and it is reported: until the branch is
set, the person's look stands. What the same report does with the deploy behind that branch is
[doctor](doctor.md).

**One flow reads four settings, and each names the level that owns it** — which level, and why:
[two levels](../two-levels.md). Three are the project's, in its own `.forge.json`: `feedback`, two
channels (`off | bugs | all`) saying whether a run may report on this plugin and on the project
itself; `method`, the version of the served text this project runs, one number pinning the guide, the
method and the contract together because they are one designed set and a project mixing them runs
text nobody tested; and `landing`, where the merge sits. The fourth is the machine's, in the user
config beside the withheld verbs: `ship`, whether a run lands its own change or ends ready for
another actor to land it. `forge doctor` prints all four with their sources, and it is the only
surface allowed to.

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
