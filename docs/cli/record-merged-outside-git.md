# `forge record merged` outside git — the landing in place of the five clauses

A project whose work is a live store write, a CMS entry or a page lands no commit at all, and the
tracker says so per issue: `landingShape` is `outside_git`, and a mark there must carry the tracker's
own `landing` field or it is refused `LANDING_REQUIRED`. The five clauses of [the git mark](record-merged.md) mean nothing on
such an issue — the only sha its checkout holds is a control folder's, which carries none of the work,
and a mark naming it would send every reader to a commit the change never landed in.

So the verb reads the shape off the issue and takes the other mark there: `--landing <place>` alone,
sent as the tracker's field, with a short note saying the change landed outside git. Every git clause
and `--to` is refused beside it rather than dropped, and `--landing` is refused on an issue landing in
git, where the tracker would refuse it `LANDING_NOT_THIS_SHAPE`. A value shaped like a sha is refused
too: a reader and every tool would open it as a commit. Where the place is kept is the tracker's typed
`mergedLanding`, which every reader of the mark takes it from, and never this note's prose.

The records that read the mark read it in the same shape: a verdict, a review and a verification of
such an issue name the landing they judged in a `landing` field of their own, and `developed`,
`testing` and `awaiting_release` compare that field with the mark's landing where a git issue's
compare the commit.
