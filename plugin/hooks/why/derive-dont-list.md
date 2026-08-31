# derive-dont-list — a checker that hard-codes its cases

A checker earns its keep by catching what nobody predicted. A list written by hand only knows
the cases its author had already met, and it fails twice over: it stays silent when someone
adds a case it never heard of, and it reports a false gap when someone extends the thing
correctly. The second failure is the expensive one — a checker that cries wolf gets switched
off, and a switched-off checker protects nothing.

Measured on a real repository: an error-code test carried a six-item list copied by hand out
of a `switch`. Adding one arm to that switch and one code to the shared contract — a correct
change, both halves consistent — made the test fail on the correct change, while a version
that derived its cases from the source stayed green.

It is a nudge, not a refusal, because a hard-coded list is sometimes the honest answer: a
ratchet's list of migrated directories is *supposed* to be enumerated, because being
incomplete is the point. A comment directly above the literal silences it outright. That is
not politeness — it is the difference between a list nobody examined and one somebody decided
on, and the decision is the only thing a reader downstream can act on.
