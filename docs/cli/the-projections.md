# What the projections leave out

The uuid column was 22% of the browse verb's bytes and bought nothing. A null `plan` and an empty
`attachments` were 179 bytes of an issue's 1,938 and said only that the field exists, so absence means
empty. `format: "uuid"` and a 150-character regex asserting the same thing appear together on every id
field; a pattern *without* a format is kept, because that one carries the only copy of its rule.

Guides come back as Markdown, not Markdown escaped inside JSON: 49 `\n` and 10 `\"` per guide, each
tokenizing worse than the character it stands for.

Nothing here keeps its own copy of names the server already publishes — a local list goes stale
against the thing it describes, silently, and reports the server's newest feature as a typo.

The browse verb sorts the page it is handed. The tracker's `list` takes no order argument at all and
answers in the order rows were last touched, which is a reading order: the issue somebody commented
on this morning arrives above the one that has been waiting a month for someone to start it. So the
rank comes first and age breaks the tie, oldest first, and the rank is printed on every row — an
order a reader cannot see reads as a shuffle, and one they cannot see the key of reads as a wrong
one. The ranking itself is the tracker's, in the order its own schema declares it, which is why a
page returned against a schema that declares none is left exactly as it arrived rather than sorted
against a list kept here.

A page cut short is ranked as far as it goes and no further: the tracker chose those rows by
recency before this saw them, so the line under a full page says the order covers the page alone.

## A key is not resolved by a page

The cap that bites is on response bytes, not on the limit asked for, and it is declared in the
answer rather than in the ask: a 500-row request came back `returned: 97, hasMore: true,
truncatedBy: "response-size"` against a backlog of 191, with a notice saying a higher limit will not
help. So the length of a page says nothing and its envelope says everything. What survives the cut
is what was touched most recently, which is not what was created most recently — an issue filed
after one that is on the page can be missing from it, so no frontier read off a cut page holds in
created order, and a walk that trusts one skips whatever fell through.

There is no cursor and no lookup by key: `documentId` is a uuid and `ISS-14` is refused outright.
What the tracker does answer is a window — `createdBefore` exclusive, `createdAfter` inclusive,
which tile half-open and divide as finely as asked. A window whose answer is not cut is complete for
that window, and that is the only thing on this transport that licenses the word absent. So a key
the first page cannot carry is looked for in windows walked oldest-ward, one accepted window at a
time, ending at the key or at a window with no lower bound that came back whole.

What a window is narrowed by is the interval and not the timestamps a cut answer happened to carry.
Those are the rows that survived a cut made in the order things were touched, so the newest creation
among them is not the newest creation in the interval — narrowing to it can leave the interval
almost as wide as it was, and a walk that treats it as the last subdivision available gives up with
the key still reachable. The stamps open the search; halving the interval toward its top is what
closes it, and only an interval one millisecond wide is genuinely indivisible.

The enum filters the tracker's own notice recommends — status, priority, category, label — were the
other candidate, and they cannot subdivide without limit. The cap being on bytes, a bucket overflows
too: `status=open` alone came back cut. An axis that runs out of subdivisions puts the miss back,
quieter.

A refusal therefore names what was read as measured, and never the limit it asked for. A limit in
that sentence sends the reader to raise the one thing that cannot help, and calls an issue the
tracker holds absent — which is a lookup's ceiling reported as a fact about the backlog.
