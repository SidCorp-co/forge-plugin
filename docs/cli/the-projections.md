# What the projections leave out

The uuid column was 22% of the browse verb's bytes and bought nothing. A null `plan` and an empty
`attachments` were 179 bytes of an issue's 1,938 and said only that the field exists, so absence means
empty. `format: "uuid"` and a 150-character regex asserting the same thing appear together on every id
field; a pattern *without* a format is kept, because that one carries the only copy of its rule.

Guides come back as Markdown, not Markdown escaped inside JSON: 49 `\n` and 10 `\"` per guide, each
tokenizing worse than the character it stands for.

Nothing here keeps its own copy of names the server already publishes — a local list goes stale
against the thing it describes, silently, and reports the server's newest feature as a typo.

The browse verb sorts the set it read. The tracker's `list` takes no order argument at all and
answers in the order rows were last touched, which is a reading order: the issue somebody commented
on this morning arrives above the one that has been waiting a month for someone to start it. So the
rank comes first and age breaks the tie, oldest first, and the rank is printed on every row — an
order a reader cannot see reads as a shuffle, and one they cannot see the key of reads as a wrong
one. The ranking itself is the tracker's, in the order its own schema declares it, which is why a
set returned against a schema that declares none is left exactly as it arrived rather than sorted
against a list kept here.

## Which names one body may be asked for

Five fields cost enough that the tracker projects them on the wire, declaring which. An ask of only
those stays narrow; name anything else and the body comes back whole and is selected
here, spending bytes on the wire rather than a second read or a reader's tokens. What may be named
is the paragraph above applied to a body, read off the answer and never listed here. While the
declared five were the whole of it, an issue's own uuid was out of reach of the verb that prints it
(ISS-45, ISS-48, ISS-151). The names are the ones the verb prints, not the ones it stores, a reader
having read the name off the output.

## A list is read to exhaustion, not reported as a page

One unfiltered `list` at `limit: 500` came back holding 97 of the 249 issues this project then held,
`hasMore: true`, `truncatedBy: "response-size"`, and a notice calling the 97 the most recent of
them. They were not: the cut keeps what was touched most recently, and about forty rows from the
middle of the created range were missing, ISS-67 among them though it was created inside the
returned window. Paging the way that notice implies made it worse — a second call bounded by the
oldest `createdAt` returned 35 rows and `hasMore: false`, so two pages held 132 of 249 and the
caller had been told there was no more. A run that enumerated the backlog to decide a disposition
took that answer and was wrong (ISS-14, ISS-221).

So every reader of a whole set walks. `createdBefore` is exclusive and `createdAfter` inclusive, so
windows tile half-open and divide as finely as asked; a window whose answer is not cut is complete
for that window, and that is the only thing on this transport that licenses a count. The walk keeps
the rows of every window it asked for and ends at one with no lower bound that came back whole. The
browse verb, the reference lookup, both of the dependency graph's sets, the duplicate check on a
filing and the near-duplicate check on a feedback note all take it, because a set one of them calls
whole and another calls cut is two answers to a question with one answer. A `search` is walked where
its answer is the set — the issues carrying dependency prose *are* that graph's nodes — and left as
one answer where it only reaches past a walk that already fell short, since a name is the last axis
left there and never a claim about the backlog.

That leaves `--limit` as the count of rows *printed*, out of the whole set, every wire call asking
the tracker's own ceiling. Keeping it as the ask is incoherent once the answer is a union of
windows — the union exceeds the number asked for — and a ranked top-N is only truthful over the
whole set, since a `critical` row a month old sits in the last window as easily as the first. Where
the print cut bites, the count line says how many of how many, which order the rest are the tail of,
and the flag that prints more: a cut a caller cannot act on is the defect this file is about. At the
ceiling it drops that flag and names the filter alone — the cut only bites where the print count
equals the limit, so a limit already at the maximum makes "raise it" the same unactionable advice a
refusal is forbidden below.

The enum filters the tracker's own notice recommends — status, priority, category, label — were the
other candidate, and they cannot subdivide without limit. The cap being on bytes, a bucket overflows
too: `status=open` alone came back cut, at 100 of 142. An axis that runs out of subdivisions puts
the miss back, quieter.

## Whether an answer was whole is the answer's to say, not its length's

Two caps can cut a list and the envelope is what tells them apart: `truncatedBy: "limit"` where the
caller's own ask bound it, `truncatedBy: "response-size"` where the byte cap did. Both mean the
window needs subdividing, since the ask is already the ceiling. So truncation is read from
`hasMore`, `truncated` and `truncatedBy`, and a length equal to the limit is kept only as the
fallback for a server that reports nothing at all.

Testing the length instead inverts the answer exactly where it matters: the byte cap returns fewer
rows than were asked for, so a page of 97 out of 249 compares unequal to the 500 requested and reads
as complete. One function answers it for every window, and a reader that paraphrases the tracker's
notice instead of passing it through invents advice: that sentence is the one that knows which cap
bit.

An incomplete reading is said out loud rather than folded into a pass, and it states the count it
measured and never the limit it asked for. Where a check's correctness depends on having read
everything, silence is a claim: a duplicate check that saw half the issues and reports nothing has
reported a clean result.

## A key is not resolved by a page either

There is no cursor and no lookup by key: `documentId` is a uuid and `ISS-14` is refused outright. So
a key the first window cannot carry is looked for in the same walk, oldest-ward, one accepted window
at a time — ending at the key rather than at the end of the backlog, which is the one thing the
lookup wants that an enumeration does not.

What a window is narrowed by is the interval and not the timestamps a cut answer happened to carry.
Those are the rows that survived a cut made in the order things were touched, so the newest creation
among them is not the newest creation in the interval — narrowing to it can leave the interval
almost as wide as it was, and a walk that treats it as the last subdivision available gives up with
the key still reachable. The stamps open the search; halving the interval toward its top is what
closes it, and only an interval one millisecond wide is genuinely indivisible.

The interval the walk halves is the caller's own, where the caller gave one. `--createdBefore` is a
ceiling and `--createdAfter` a floor, and a frontier is a subdivision between them rather than a
replacement for either: a window that overrode the ceiling with a frontier read above it would hand
back rows the caller excluded, silently, in an answer shaped exactly like a correct one.

A refusal therefore names what was read as measured, and never the limit it asked for. A limit in
that sentence sends the reader to raise the one thing that cannot help, and calls an issue the
tracker holds absent — which is a lookup's ceiling reported as a fact about the backlog.

## A key, and the things shaped like one

A reference is this tracker's own key — `ISS` and digits — or a uuid, and nothing else, because the
identifiers of a requirements tree are letters-dash-digits too and a citation is not a reference.
Accepting the wider shape cost twice over: the read-first gate asked for the comments of `FR-05` as
though a clause could have any, and the lookup above spent the whole backlog — seven windows, 210
rows — before calling a specification clause an issue the tracker does not hold, which sent its
reader to `forge issues` for something that was never going to be there.

So the shape is refused before the first call, and the refusal names `forge spec`, which answers
that identifier off disk. The prefix is an allowlist of one rather than configuration: it is the only
key shape this CLI names anywhere, and one hard-coded prefix is at least a prefix a test can pin,
where a pattern accepting every prefix pins nothing. A second tracker with a second key shape is what
makes it a setting, and until then the setting would be a copy of a constant.
