# `stats` — what a run cost, in the unit the API billed it

Every other figure this verb reports counts what a run *did* — its minutes, its rounds, its calls.
The cost was treated as a figure needing a tokenizer or a credential, and for the agent-facing
surface that is right, because that text was never sent to a model. For a run it is neither: the
count is the API's own, it is already on disk, and it is already inside the file the corpus opens
and parses line by line. Every assistant record carries `message.usage` and nothing read it.

## What one request is, and why it is not one record

The host writes one API response as several assistant records, each repeating that response's usage.
On the largest transcript of this project's corpus: 24,598 assistant records over 11,757 distinct
`message.id`, 12,841 of them repeating an id already seen, and no repeat disagreeing with the first
by a single token. Summed per record, every figure here reads **2.09 times what was billed** — a
number that has the right shape, moves the way the true one moves, and is wrong. So an id is counted
once and its repeats skipped. A record carrying no id is its own request; there is nothing to fold
it into.

## Why an absent measurement is not a nought

Three things are not a measured request:

- a record whose model is wrapped in angle brackets, which is a turn no model generated — the same
  marker the model attribution drops, carrying four noughts where a price would be;
- a record with no usage object at all;
- a record whose usage object is missing any one of the four prices as a number. The measurement is
  the four together, so a partial one is not a smaller measurement. A host that renames a field
  costs this reading its figure rather than reporting a harness that suddenly got cheaper.

The second and third are counted and printed, so a partly measured run cannot be read as a fully
observed one. A usage object whose four prices are all nought *is* a measurement, and is counted as
one: nought is a reading and the absence of one is not.

A run holding no measured request is out of the medians and out of the denominators both, and the
count of those runs prints beside the figures. Left in, it would enter a denominator it can never
enter a numerator of, and every price would read lower than it was.

## Why three prices and never one number

Cache-read, cache-creation and plain input are billed at three different rates and move
independently. On the window this was measured over, cache-read is 97% of all input tokens, so one
summed number is that one price wearing a total's name, and the two smaller ones — the expensive one
among them — disappear into its rounding.

## Why per run and per request are two readings, and two statistics

Between two seven-day windows of this corpus the cost **per run** fell by two fifths while the cost
**per request** fell by a sixteenth. Those are not one figure at two zoom levels: the first says the
harness took fewer turns, the second says each turn re-read about the same context as before. A
reading that reports only the first congratulates itself for a saving it did not make, and the
context each turn re-reads — the largest single number in this whole reading — has been flat for a
fortnight while everything around it moved.

The per-run figure is a **median**, which is what every other per-run figure on this screen is. The
per-request figure is a **ratio of sums**: the window's tokens over the window's measured requests,
one population on both sides of the divide. Keeping a number per request on every run to take a
median of it would also be re-sorted at every one of the several hundred sliding positions the
adjacent-block floor is computed over. The window's own sums print beside both, so the ratio per run
is derivable and the median is never quietly offered as it.

## What this reading does not say

That a cost which fell is an improvement. A harness that did less work spent less, and no price
knows the difference; that is what the wall, call and outcome figures are printed beside these for.
The verdict a price earns is against how far this corpus's own adjacent windows have differed, which
is the angles' subject and not this one's.

It also says nothing about what to *do* about a context of that size. That is a decision, and it
needed this figure before anyone could take it.

## Why this is in the reader and not beside it

Three readings of this figure were taken on the issue that filed it, by hand, in one afternoon. Two
were wrong. The first divided token sums by transcripts rather than by runs. The second paired a
numerator from a scanner that admitted 799 of 810 files with a denominator from the reader, which
admitted 565 of 793 — a wide numerator over a narrow denominator, which is worse than the mistake it
was correcting. Only the third, taken through the corpus reader's own admission, was a figure at
all, and none of the three deduplicated.

The admission test is one function and says in its own comment why it reads the brief and not the
whole file. A second reader of the same files is a second place to get that wrong, which is what
happened twice within an hour of the comment warning about it being read. The figure landing in the
verb is what stops the next probe being written.
