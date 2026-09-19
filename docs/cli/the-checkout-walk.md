# the checkout walk

Which checkout a process stands in, and which repository that checkout belongs to, decide where a
project file is read from and where a run's own id is kept. Both are read off the disk. This is what
that walk owes git, and the five shapes where git answers differently.

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

**That test is the checkout answer's and not the git directory's**, which is why the walk takes what
counts as one from its caller. The run id is kept beside `.git` because that is where the tree's own
file goes (`docs/cli/claim.md`), a question no repository has to be valid to answer, and the walk that
finds it has always taken a `.git` at its word. Tying the two together was tried and the suite said
no: forty-two cases across four files build a `.git` directory by hand to stand for a tree, and every
one of them is right to — what they are about is where a file lands, not what git would discover.

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
