# Deciding, and asking when you must

## Decide first; ask only when the wrong branch is expensive

Most choices are yours. Take the reading that is cheaper to reverse, write the assumption
into the plan with the sentence that would undo it, and carry on — an assumption recorded
where the next reader finds it costs less than a round trip, and it is correctable for as
long as nothing was built on it.

Ask when reversing would mean unpicking work rather than changing a value: a decision that
moves code between packages, fixes a wire format nothing will go on reading the old form of, or
sets what other decisions are made against. A number in a config file is not one of those; a package boundary is.

## How to ask, when you must

Not a paragraph asking what they meant. **Enumerate the readings as concrete cases with the
outcome each produces** — a table of before/after rows, a literal example record, the two
screens side by side. The person answering should be choosing between visible results.

Then park it, in whatever status the tracker uses for "waiting on the reporter" — for the Forge
driver that is `needs_info`, and only that: `references/forge-driver.md`.
