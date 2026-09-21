# The name join

Every row of [one transport](one-transport.md) is a declared table, and the cost that document names
is that the table can go stale: the tracker grows a column or retires one and nothing here notices.
This is the answer to that sentence. It compares the names this CLI asks the tracker's project row
for against the names the row answers, in both directions, and it is `forge doctor tracker`'s.

**Both directions or it is half a check.** A name asked for that the row does not carry reads
`undefined` and travels on as a null — that is what a retired column does, and it cost `ISS-1888` a
release's worth of issues resting at the deploying rung. A name the row carries that nothing asks for
is dropped before a caller sees it, which is the same defect from the other side. Reporting one and
not the other would have caught neither of the two that have actually happened.

**A verb, not a step of the gate.** The suite holds a capture of what each route answers, and a
check over it would be cheaper and always available. It would also be structurally blind: the failure
this exists to catch is the wire changing under a shaper that still reads the old names, and a
capture taken from that same wire moves with it or not at all — both sides move together or neither
does, so the check would read green on the exact day it was most needed. It costs a credential, it is
not part of the gate, and a contributor without an account does not run it. A check that is always
available and structurally blind is worth less than one that is sometimes available and true.

**The names a shaper reads are the names it asks for, and they are written down nowhere.** The row
the shapers run over is a stand-in that records every top-level name asked of it. Two cheaper
readings were tried and are wrong on `configOf` specifically, which destructures eight names and then
spreads a nested document whole: reading the destructuring patterns off the source scores every key
of that document as dropped, when all of them pass through; and scoring a name read by taking its
column away and watching the answer move scores two columns as unread whenever the document holds a
value equal to one of the eight, and scores the document itself as unread whenever it is empty.
Asking is the read, so `Object.hasOwn` counts as much as a property access, and a shaper that takes
the row whole asks for every name there is and therefore drops nothing.

**Two columns are never named, by name rather than by omission.** The project row carries a webhook
secret and an API key. Both shapers exclude them today for free, by listing the names they want and
saying nothing about the rest — and the moment a reader reports on the names a shaper drops, that
protection is gone and the report is a secret's name in a diagnostic somebody pastes. So they are
struck by name from both directions and from every line the report renders, the reading says how many
of them the row carried, and it says nothing else about either. The one way a *value* can reach a line
is by also being the name of a column, since names are all this reads — so a name that reads as a
value the row holds under one of the two is withheld whatever its length, and counted with them. The
strike over the values themselves is the second guard and not the first: it leaves a value of six
characters or fewer alone, because blanking every occurrence of a short string would blank words a
reader needs, and nothing here puts a row's value in a line in the first place. The row that reports a refusal carries
none of the tracker's own words for the same reason.

**The reading says what it does not reach.** It reaches the row's own columns and nothing inside any
of them. Nineteen of the thirty-two projects one credential sees answer null for their deploy
bindings, and a null carries no names on the day it is read as much as a year later — so no reading of
a project that configured nothing says anything about the shape a configured one would hold. A green
top-level reading read as covering the nested case is the same mistake as a reader who cannot tell a
check that passed from one that never ran, which is why the row that could not run says so.

**A difference somebody chose is declared, and the declaration is checked.** `CHOSEN` in
`plugin/src/tracker/name-join.mjs` holds one entry per shaper per name, with the reason. The rule over
it is the route test's, beside the `differs` table that declares a chosen difference of *value*: a
declaration the shaper turns out to ask for fails, and so does one the capture on disk cannot prove
either way. That second half is what ties the declaration to a dated capture rather than to a
memory of one.

## Re-taking the capture

A declaration for a column the capture does not carry fails, and the way forward is a fresh capture
rather than a relaxed rule. `plugin/test/fixtures/rest/projects-get.json` is one project's row as the
wire answered it, with the day it was taken. **Nothing of either withheld column may reach disk**:
the body is read through this CLI's own transport, both columns are deleted from it, `taken` is set to
the day, and only then is the file written. The route test asserts their absence, so a capture taken
with them in it fails rather than landing. The row is this project's own and no other's, because
another project's would bring its test credentials into the repository with it.

No call does any of that. Every capture here was written by hand, which is why the failure names a
file, a route and a rule where it would rather name a command, and why the scrub is a person's memory
until `ISS-2100` gives it one.
