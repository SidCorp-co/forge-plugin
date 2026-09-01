# derive-dont-list — a checker whose cases are typed by hand

Why: a hand-written list is silent on the case it never met and fails on a correct change. Measured: a
six-item list copied out of a `switch` failed when one arm and one contract entry were added, both
halves consistent.

How to clear it: derive the cases — read the enum, parse the switch, key on the declared type. If
enumerating *is* the point, say so in a comment directly above the literal, which silences it. Either
way it asks once per file.

Not judged: lists outside a checker, and the content of any list. It blocks rather than refuses, so
nothing is lost to it.
