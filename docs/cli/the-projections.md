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
