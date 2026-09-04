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

A page cut short by the limit is ranked as far as it goes and no further: the tracker chose those
rows by recency before this saw them, so the line under a full page says the order covers the page
alone.
