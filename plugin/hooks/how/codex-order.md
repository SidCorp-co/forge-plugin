# codex-order — retired, and nothing took its place

Why: the advisor is server-side. No hook fires when it speaks, its reply is encrypted the moment the
turn moves on, and a gate could only guess it had spoken by reading the transcript and judge the
carry by one word in a command.

What it did: it held a consult once a session until its intent mentioned the advisor. Keyed on the
session id, and every subagent carries its parent's, six agents at once were one session — the first
was held and the other five passed unasked. It refuses nothing now, and neither does anything else:
what the advisor said is yours to act on as you plan, and where it changes a decision the decision
record already carries the decision and its undo.

The same reading inside codex-second went with it, so no write between commits is held for advice
either. What codex-second still asks for is on its own page.

Not judged: nothing. There is no gate here to over-comply with.
