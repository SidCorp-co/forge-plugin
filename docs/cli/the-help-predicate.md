# The help predicate, and the reading that is not it

[The primitives](the-primitives.md) sent home a pattern each time. This one is a *predicate*, and it
is a topic of its own for the reason the index gave it away: a shared pattern is judged on what it
matches, while a predicate is judged on what a caller believes it answers — and the answer here is
spelled in ten places by four dispatchers who each decided it alone.

## Exported, and written out by hand seven times over

`wantsHelp` had been exported from `plugin/src/resolve/flags.mjs` and imported by four modules while
seven others wrote the same comparison by hand — the CLI's own entry sharpest of them, importing it
on one line and writing it out fifty lines above (ISS-259). Nothing would have failed if one had lost
`--help`, and this is the surface a caller reaches when it does *not* know the verb, so a spelling
that drifts on one side is a verb answering a question its siblings answer differently.

## The unreachable one, and what proving each site neutral cost

One of the seven was unreachable, and finding out which cost a wrong answer worth recording. The
entry answers `-h` itself for any verb that does not set `answersHelp`, and the mark is set beside
each verb's own export rather than in one table — so reading the table alone says three verbs carry
it and the tree says ten. Six of the seven sites are live on that count, and the eight commands the
issue named do judge them. The seventh, `cloudflare`, is unmarked: `helpOf` answers for it, and its
own fuller `USAGE` was text nothing reached until ISS-305 gave its actions a help path. Which of the
two the verb's own slot prints is ISS-291's and is not answered here.

The lesson is the guard's, not the verb's: a predicate whose answer is spelled in ten places is one
a reader will summarise from whichever place they found. Each site was proven neutral by reverting
that one file alone and re-running both the eight commands and a direct invocation of every exported
verb — seven reverts, no difference anywhere, and the guard naming the reverted file each time.

## The one exclusion was another question after all

The codex verb read the flag in *any* position — the CLI hands a verb its tail, so `forge codex
consult -h` puts it second — and the row excused it. That was this question read loosely: a verb
taking a subject is asked in two slots, before the subject and after one it *has*, and the third
slot codex also read made a `--note` of the help word print the usage rather than write the verdict.
Five dispatchers had each decided it alone, giving four answers, three a tracker read. ISS-305 sent
the reading home as `helpAskedOf` — a third name beside the two, not a slot added to `wantsHelp`,
since a reference followed by `-h` names a file to post and the suite pins that. The row excludes
nothing now, and a case that the verb it excused is watched stands there. The consult-order gate
keeps its own: a flag read out of a shell command line somebody else typed *is* another question, it
is a hook, and ISS-299 carries it.

## What the guard's needles are, and why nothing looser

The needles are the comparison, `=== "-h"`, and the word pair a copy declaring a list would write
instead. Anything looser — the word `--help` alone — refuses the doctor spawning another program
with it and the CLAUDE.md checker reading `-h` out of a document, neither of which is asking this
question at all.
