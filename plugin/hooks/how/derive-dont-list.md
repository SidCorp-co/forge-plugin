# derive-dont-list — a checker whose cases are typed by hand

Why: a hand-written list is silent on the case it never met, and fails on a correct change that
extends the source. Measured: a six-item list copied out of a `switch` failed when one arm and one
contract entry were added — both halves consistent — while a version deriving its cases stayed green.

How to clear it: derive the cases. Read the enum, parse the switch, key on the declared type. If
enumerating *is* the point, say so in a comment directly above the literal, which silences the gate
outright. Either way it asks once per file and then the file is yours.

A ratchet's list of migrated directories is the honest case: being incomplete is what it measures. The
comment is not politeness — it is the difference between a list nobody examined and one somebody
decided on, and the decision is the only part a later reader can act on.

Not judged: lists outside a checker, and the content of any list. It blocks rather than refuses, so
nothing is ever lost to it.
