# `forge next`'s weights — the one source of a complexity, the age term that does not stop, what a kind is worth, and what an unweighed issue is worth

`forge next -h` prints the table and the points in it; a `rank` object in a project's own settings
overrides one weight at a time. What follows is what the table cannot carry: which of these numbers
were argued over, and what the argument was.

## The weight is the `complexity` field, and a row holding none says so

The listing carries the field on every row and that is the whole of it: five values wide, so
`l` and `xl` score apart where a rung would fold them together. A row holding none scores as `unset`
and takes the weight declared for that, which is a value of its own rather than the rung an issue
holding none would fall to at `forge advance --owed` — what to work next is a question about what
somebody weighed, and reading an unweighed issue as a feature would score it as though they had.

The body's retired `Size:` line was the other source until ISS-701. Two sources meant a value the body
claimed and one the tracker gave scoring alike and meaning differently, and it meant reading a body
per candidate to find out. [`the-ladder`](the-ladder.md) holds why the field is the one source.

**`--why` is where a lead the field holds nothing for is told what to set**, on a line of its own
carrying the `forge issue --set complexity=` write, and only where the field is empty. The `unset` in
the complexity column says a lead was never weighed and cannot say what to do about it; a line on
every candidate would repeat the column for the rows that hold a value. The word is one constant,
`UNSET`, declared beside the weights because the overridable `complexity` table keys a row by it and
both the scoring and the printing then ask by the same name — a second spelling of it is how the
column comes to say `unset` while the line below it goes quiet, or how a project's
`rank.complexity.unset` comes to weight a row nothing lands in.

**`rank.band` was that table's key until ISS-822**, when the CLI stopped keeping two words for the
tracker's field. A project that set it scores exactly as it did: the reader folds it onto
`rank.complexity` before it validates and says on stderr which key it read, and where a project sets
both, the canonical one scores and the line says the other was passed over. Nothing writes the old
key back, and `forge next -h` prints the canonical one alone.

## A kind is worth how certain the cost of leaving it is

`bug` 8, `enhancement` 4, `review` 2, `feature` 0 — and the rows are keyed off the kinds this CLI can
file rather than written out beside them. The two lists were written at different times: `review`
reached the tracker's vocabulary, no row reached this table, and a `review` issue then scored through
the fallback exactly as a `feature` did while a project trying to weigh it was refused by name
(ISS-1534). A name on one list and not the other refuses at load now, in both directions, because a
weight no kind can reach is as silent as a kind no weight scores.

What the four numbers order is how certain the cost of leaving the issue undone is. A bug is a cost
already being paid, and one in the tool the flow runs on is paid again by every later run. An
enhancement is a smaller cost, already being paid by somebody who has not called the thing broken. A
feature names no cost at all, only an absence — nobody has the thing to miss it — so the kind adds
nothing and the priority, the age and the size decide.

**A `review` sits between the last two.** Its subject is code that already runs, so whatever that
code costs is already being paid, and the reading is what finds out whether it is: a weaker claim
than an enhancement's, which names the improvement it is asking for, and a stronger one than a
feature's, which names no cost to go looking for. Strictly above zero is the other half of the
number. A row worth what the fallback was worth is the fallback under a name, and an order nobody
could tell from the one that had the defect in it.

## Age does not stop, and an order whose top is held by age is the answer rather than a fault

`ageCap` ships as `null`, which is the settings' way of saying there is no most age can be worth: it
accrues at `agePerDay` for as long as the issue is open. A ceiling reads as prudence — it keeps an
ancient triviality from crowding out live work — and what it does is make every issue past it score
alike on the one term that still separates them. An issue no other weight favours then sits below the
fold for as long as it stays filed, and waiting cannot move it. That is the state this default was
changed out of: a high-priority issue three days old that had never once appeared in the order, and
could not have appeared at any age (ISS-1397).

What that buys is precise, and it is worth saying what it is not. Two issues already filed do not
drift apart by waiting: both accrue at the same rate, so what separates them is the days between
their filing dates and it stays that. What an issue keeps is the whole of its head start over
everything filed after it — and a ceiling is what threw that head start away, so that past the
ceiling a year-old issue and this morning's scored alike. The pressure age applies is therefore
against new arrivals rather than against its own neighbours: work nobody picked up does not quietly
fall behind the day's filings, and it goes on rising against them until somebody works it or drops
it. A project that wants a ceiling sets `rank.ageCap` to a number; `null` is how it says no ceiling
again, because a very large number is the same arithmetic offered as a guess.

## An issue nobody weighed scores below every issue somebody did

`unset` is what a row whose `complexity` field is empty is worth, and it is the lowest weight in that
table — below `xl`, the largest size anybody can declare. It scored above both `l` and `xl` until
ISS-1397, which meant declaring an issue large cost it points against saying nothing about it: an
incentive not to size, written into the thing that decides what gets worked next. Every declared size
now scores strictly above declaring none, so sizing an issue always pays, whichever size it turns out
to be.

## A module is worth what the project says, and nothing where it says nothing

`rank.module` is the one table whose rows are the project's own names, the modules its tracker
defines, so the plugin ships it holding `unset` alone. Why the names are the tracker's and the numbers
the project's, why a module inherits its parent's row, and why no module is read where no table is
set or no module defined: [modules](modules.md).
