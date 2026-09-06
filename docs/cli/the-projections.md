# What the projections leave out

The uuid column was 22% of the browse verb's bytes and bought nothing. A null `plan` and an empty
`attachments` were 179 bytes of an issue's 1,938 and said only that the field exists, so absence means
empty. `format: "uuid"` and a 150-character regex asserting the same thing appear together on every id
field; a pattern *without* a format is kept, because that one carries the only copy of its rule.

Guides come back as Markdown, not Markdown escaped inside JSON: 49 `\n` and 10 `\"` per guide, each
tokenizing worse than the character it stands for.

A name a caller may ask for is never a list kept here — a local list goes stale against the thing it
describes, silently, and reports the tracker's newest feature as a typo. The set this CLI does keep
is the other kind: the values and lengths the routes refuse without naming what they wanted, where
the choice is between a declaration that can go stale loudly and a refusal nobody can act on.

The browse verb sorts the set it read. The list route orders by what was last touched, which is a
reading order: the issue somebody commented on this morning arrives above the one that has been
waiting a month for someone to start it. So the rank comes first and age breaks the tie, oldest
first, and the rank is printed on every row — an order a reader cannot see reads as a shuffle, and
one they cannot see the key of reads as a wrong one. The ranking itself is declared rather than
derived, which is why a set handed no declaration is left exactly as it arrived.

## Which names one body may be asked for

The full read answers with every column of the record, less the tracker's own bookkeeping and the
collections it embeds, so what may be asked for is the answer's own keys. A keep-list would put the
column the tracker grows next out of reach of the verb that prints it, which is the shape the wire
projection had: while its declared five were the whole of it, an issue's own uuid could not be named
(ISS-45, ISS-48, ISS-151). The names are the ones the verb prints, not the ones it stores, a reader
having read the name off the output.

What naming fields still buys is the requests: the edges and the attachments are routes of their
own, and a read that named neither pays for neither.

## A list is read to exhaustion, not reported as a page

One unfiltered `list` at `limit: 500`, over the endpoint this CLI has since left, came back holding
97 of the 249 issues this project then held, saying rows were behind them and calling the 97 the
most recent of them. They were not: the cut keeps what was touched most recently, and forty rows from the
middle of the created range were missing, ISS-67 among them though it was created inside the
returned window. Paging the way that notice implies made it worse — a second call bounded by the
oldest `createdAt` returned 35 rows and `hasMore: false`, so two pages held 132 of 249 and the
caller had been told there was no more. A run that enumerated the backlog to decide a disposition
took that answer and was wrong (ISS-14, ISS-221).

So every reader of a whole set walks, and what it walks is offsets: the route takes a limit and an
offset over a stated order, so a page is a position in the set rather than a guess at an interval.
The walk asks for the route's own ceiling, keeps every row it was handed, and ends where the answer
says there is nothing behind it. The browse verb, both of the dependency graph's sets, the duplicate
check on a filing and the near-duplicate check on a feedback note all take it, because a set one of
them calls whole and another calls cut is two answers to a question with one answer. A `search` is
walked where its answer is the set — the issues carrying dependency prose *are* that graph's nodes —
and left as one answer where it only reaches past a walk that already fell short, since a name is
the last axis left there and never a claim about the backlog.

The route narrows on three of the filters the browse verb takes — either route, the search one
included, which is why one query builder serves both: a filter the second route dropped would come
back as a whole answer to a narrower ask than was made. The rest are applied to the rows that came
back, where the walk is the thing holding them. That is a choice for one reading of a filter rather
than two, and it costs the rows a narrower ask would not have carried.

That leaves `--limit` as the count of rows *printed*, out of the whole set, every wire call asking
the route's own ceiling. Keeping it as the ask is incoherent once the answer is a union of
pages — the union exceeds the number asked for — and a ranked top-N is only truthful over the
whole set, since a `critical` row a month old sits in the last window as easily as the first. Where
the print cut bites, the count line says how many of how many, which order the rest are the tail of,
and the flag that prints more: a cut a caller cannot act on is the defect this file is about. At the
ceiling it drops that flag and names the filter alone — the cut only bites where the print count
equals the limit, so a limit already at the maximum makes "raise it" the same unactionable advice a
refusal is forbidden below.

Narrowing by enum — status, priority, category, label — was the other candidate for reading a whole
set, and those axes cannot subdivide without limit. Where the cap is on bytes a bucket overflows
too: `status=open` alone came back cut, at 100 of 142. An axis that runs out of subdivisions puts
the miss back, quieter. An offset has no such floor, which is why the walk takes it.

## Whether an answer was whole is the answer's to say, not its length's

The envelope says whether rows are behind the page, and a reading of the length says nothing: a cap
that returns fewer rows than were asked for makes a short page compare unequal to the ask and read
as complete. So truncation is read from what the envelope stated, and a length equal to the limit is
kept only as the fallback for a route that states nothing at all.

Which cap bit is a thing only a route taking a window can say, so only those rows say it. A route
taking neither a limit nor an offset reports rows behind the page and no reason for them, and the
message says exactly that rather than picking a cap to blame — writing one here would put this CLI's
words in the tracker's mouth. Silence is the third case and it is not the whole page: an envelope
that did not state completeness at all is carried through as having stated nothing, because every
reader of it would otherwise pass a page it could not read.

An incomplete reading is said out loud rather than folded into a pass, and it states the count it
measured and never the limit it asked for. Where a check's correctness depends on having read
everything, silence is a claim: a duplicate check that saw half the issues and reports nothing has
reported a clean result.

## A key is resolved by arithmetic, not by a page

There is still no lookup by key: `documentId` is a uuid and `ISS-14` is refused outright. But the
key carries its own sequence number, and the set ordered oldest first puts the *n*th issue ever
filed at offset *n*−1 wherever nothing below it was deleted. So the number is the guess, one row is
asked for at that offset, and the common case is one request whatever page the row would have been
on. Rows removed below the key move the answer earlier and never later, which makes the offsets
monotone in the key and the correction a binary search over them, bounded by the count the route
reports.

That count is also what a refusal names: what was read, as the route measured it, and never a limit
this CLI asked for. A limit in that sentence sends the reader to raise the one thing that cannot
help, and calls an issue the tracker holds absent — which is a lookup's ceiling reported as a fact
about the backlog.

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
