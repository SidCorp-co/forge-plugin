# `alike` — the floor a sweep reports at, and what a score does not settle

The create path spends the duplicate reader once, on the body being filed. This spends it on every
open issue instead, and the two answer different questions: *is this new body already here*, and
*are these two, both already here, one issue*. What is asked of the tracker and how a hit becomes a
key is [`beside`](beside.md)'s; the act a filing's reading leads to is [`the fold`](the-fold.md)'s.
Nothing here acts.

## The report is at the show floor, and the fold floor would answer empty

Eight readers measured this backlog on 2026-09-13, each working a different family and none of them
measuring the floor as its task. Over 214 scored rows across eight queries, **the highest score any
two distinct open issues reached was 0.77**, and every same-cause pair they confirmed by reading the
bodies scored between 0.66 and 0.77 — including one pair a filer had admitted in writing was the
same cause, at 0.73, and one an author had declared a duplicate, at 0.68 and rank fifteen. An issue
searched against **its own title** does not reliably reach 0.78 either: measured self-hits ran from
0.72 to 0.85, four of eight under the fold floor in one reader's sample.

Every pair above is one this verb exists to nominate, and not one of them stands at the higher band.
So the sweep reports at the floor a filer is shown a neighbour at. It is not a third number and neither floor
moved: the reading a filing gets is already cut at the show floor on the way in, and what turns that
into a fold is a second test this verb never applies.

Checked before the code was written, on this project's own backlog: three issues filed minutes apart
on one subject, with no fold between them, score 0.73 and 0.71 against the first — over the show
floor, under the fold floor, invisible to a sweep that used the other one.

## The score tracks vocabulary, not cause, so nothing here decides

The same eight readings found true and false neighbours interleaved with no gap between them. Against
one issue's title, nine rows of a different cause scored 0.72 to 0.74 while the row that *was* the
same cause scored 0.73. One reader's true members ran 0.84 down to 0.69 unbroken, with the first
false positive at 0.74. Where each reader's yield fell away varied by family, from about 0.63 to
about 0.72 — and on one family read from its other end, the same members scored 0.63.

There is therefore no threshold that separates them, and a verb that folded on this reading would
merge issues by their choice of words. The output nominates: it names who is worth reading beside
whom, and the reading is the whole of the judgement. That is also why no member is called the head
— which of a pair is the elder, and whether either is really the other's subject, is on the bodies
and often on the thread rather than in the title.

## One query per open issue, seeded on the title

A body per open issue is the read that came back `503 no available server` after three backoffs when
`forge next` tried it — [`next`](next.md) holds that measurement — so this asks the search what it
can answer from the title alone, which is also the text every figure above was measured on. The cost
follows from that: one search answered in about eight seconds against this tracker on 2026-09-13,
and twelve issued together answered in thirteen with none refused, so a few hundred open issues is
minutes rather than seconds. There is no flag to cut it short. A sweep that read a quarter of the
backlog by default would print the same clean-looking report as one that read all of it, which is
the failure this verb was filed against in the first place.

## A family is a set that reads alike all round, because a chain was measured and swallowed the backlog

The first build joined members transitively: A reads like B, B reads like C, so the three are one
family. Run over this project's own backlog it returned **418 of 585 open issues as a single family
over 789 links** — every real pair in it, and unreadable. At this floor the 0.70-to-0.72 rows are
neighbours by machinery rather than by subject, which is a cost worth one glance per filing and a
chain that connects everything when every issue is measured against every other.

So a family is a set in which every member reads alike to every other, and each of those readings is
printed with its score and the end whose query measured it — the search answers one direction at a
time and the two directions disagree. A pair with no third is a family of two, which is most of them.
One issue appears in two families where it reads alike to two sets that do not read alike to each
other, and that is a fact about the corpus rather than a choice made here.

Enumerating those sets takes a pivot, and the pivot is not an optimisation to leave for later. Ten
hits a query bounds nothing about how many issues point *at* one, and it bounds the whole graph only
in aggregate: n issues supply at most 10n readings, so a set of up to **twenty-one** reading alike
all round is a shape the ask permits, and each one costs a branch per subset of itself without a
pivot. Measured on 2026-09-13 over a complete graph of twenty-four, which is past what the search can
reach and is a benchmark rather than a backlog: 10 milliseconds with the pivot against 18.7 seconds
without it, for the same single family.

The report is therefore one block per set and runs long on any real backlog, so it opens with its own
accounting and is ordered by the strongest reading first: what a reader wants from the top of it is
the pairs most worth opening, and what they want from the head of it is how much of the backlog the
sweep actually saw.

The band is counted off what the reader took, before a hit is resolved against the open issues and
before the sweep drops the issue's own row: counting the survivors instead would call a query short
whenever the neighbours it found happened to be closed. What it took is what it asked for — the
tracker answers a `topK` past it, so the cut is the reader's own, and the surplus is discarded rather
than read, because a sweep built on an over-serving it never asked for reads short the day the
tracker stops.

Three readings are shorter than the backlog and each is named rather than absorbed: a query the
tracker refused, whose issue was measured against nothing; a query whose reading filled the ask with
nothing below the floor, where what else is open beside that issue is unknown by an amount nothing
here can compute; and a walk over the open issues that did not come back whole. None of the three is
given a size, because a count of what was not seen is exactly the claim none of them supports. A
reading carrying a hit below the floor is not one of them: the search reached past the band on its
own, so nothing in band was cut.
