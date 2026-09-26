# modules — the tracker's definition, the project's weights, and a removal that strands nothing

A project's modules sort its backlog by the part of the product an issue's change lands in, so that
the rank can tell a defect a user meets from a change to the repository's own gate (ISS-2588). Three
verbs reach them: `forge doctor modules` manages the definition, `forge new` and `forge feedback` file
into one, and `forge next` weighs by one. What each takes is its own `-h`. This page holds why the
shape is what it is.

## The definition is the tracker's, and the weights are the project's

A module is a label of kind `module` on the project's own tracker, nested by its parent, and an issue
carries at most one as its primary. That is the one place a module exists: the web screen, the rollup
and every verb here read the same rows. A copy in the project's configuration would be a second
definition, and two definitions are how a rank comes to weigh a module the tracker renamed a week ago.

What a module is *worth* is a different decision with a different owner. How far a change to the
gate should sink below a defect a user meets is a judgement about this project's priorities, so it
lives in the project's configuration as `rank.module`, beside `rank.kind`, and is keyed by the names
the tracker defines. The plugin writes no module name and no weight: its own table holds `unset: 0`
and nothing else, because any name in it would be a grouping one project decided for every other.

**A key naming no module is refused when the rank reads it.** A weight nobody can reach scores
nothing and says nothing, which is exactly the silence a mistyped name produces. The pure fold of the
weight table cannot see the tracker, so it takes any name under `rank.module`; the rank, which reads
the definition anyway, is where the name is held to it.

**A module with no row inherits.** Its nearest ancestor's row answers, then `unset`. A project weighs
a whole subtree by its root and carves out the one child that differs, rather than repeating a number
per leaf and forgetting the next leaf it adds.

## Where there is nothing to weigh, nothing is read

The attribution comes off the search route with `withModules`, because the list route the rank walks
refuses that parameter and one read per row would be a request per open issue. That is several pages
of a second walk, so it is spent only where a `rank.module` table is set *and* the project defines a
module. Every other project scores exactly as it did before modules existed, and pays nothing for
them. The term still prints on `--why`, saying which of the two it was, so a zero is never mistaken
for a module worth nothing.

## The counts are one walk, not the rollup

The tracker serves a rollup of each module's issues, bucketed by attribution. It cannot say how many
open issues there are: an issue carrying modules only as secondary is in no module's primary count
and not in the unassigned bucket either, so no sum of its buckets is the whole. The share a reading
prints is a claim someone will compare against, so it is taken over one walk of the open issues —
every status but the two that owe nothing more — which counts the whole, the unassigned and each
module's primaries off the same rows.

## The subject's flags follow its name

Every other subject's flags are typed on the verb, for the reason [the subjects](the-subjects.md)
gives. What these three change lives on the tracker and in no settings file, and six more flags on
the shared row would be handed to every other reading as flags it has no use for. So the subject
parses them itself, and a refusal that hands one out spells it after `forge doctor modules`.

## A removal refuses rather than strands

The tracker refuses to delete a label any issue carries, and it deletes a parent by moving each child
to the top unsaid. The first leaves a caller with a refusal and no route; the second silently changes
the weight every issue under that child inherits. So a removal refuses on both, names the count or
each child, and spells the call that clears it. Where issues carry the module, `--to` says where they
go — another module, keeping whether it was their primary, or none. The carriers are read whole
before the first move, since a moved issue drops out of the walk that found it, and the delete is
sent only after every move read back and a second walk finds nobody left carrying it.

**The moves read no thread first and take no lease.** Every other write to an issue lists its
comments before it writes and renews the writer's lease, so a run cannot act on an issue it has not
read or does not hold. A removal rewrites the label set of every
issue carrying a module the caller named as a whole, and the write answers to the project's module
definition rather than to anything an issue's thread says; reading hundreds of threads first would buy
the move nothing.

## A filing names its module before its body is read

`--module` is resolved against the definition of the project the filing is aimed at — for a note on
this plugin that is the plugin's project, read after the verb has aimed there — and a name it does not
define is refused before anything is sent — on `forge new` before the body is even taken, so a body
from stdin is not spent on a filing that cannot be made. The read-back after a filing names the module it found as the primary, or says that half is
unverified. A filing that folds onto a neighbour writes a comment, and a comment carries no module, so
the reply says none was written rather than letting the flag read as done.
