## Phase 5 — Ask again, and stop on an answer that offered nothing

Ask the queue again once the issue in hand is finished, set down or handed back. The answer is
computed when it is asked for and stored nowhere, so an issue that reached the status while this one
was being judged is in it, and one this session has just moved out is not.

**The run ends on an answer that offered nothing and reported no shortfall, and on nothing else.** A
read whose bound fell short has work behind it; a read whose every row is held by another run has
work standing with somebody else. Neither is an empty status, and a run that ends on either reports a
queue drained that is not. Raise the bound and read again for the first; for the second, end the pass
and say whose the rows are and how many.

**An empty answer ends the session, and nothing is waited for.** Not a pause, not a poll, not a watch
for the queue to refill: what starts this again is a person, and an issue arriving after the last
read waits for them. That is the price of a master nobody keeps alive and it is said rather than
worked around.

Report once, at the end: how many issues were drained, which were judged by this session and which by
a run it dispatched, which were set down and what each was missing, which went back to a building
run, which are resting on somebody's look, and what the last read of the queue actually said.
