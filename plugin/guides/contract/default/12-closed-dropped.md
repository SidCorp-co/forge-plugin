### `closed`, `dropped` — terminal, until a person disagrees

`closed` is entered from `awaiting_release` by the holder once the criteria are met in scope, each
unmet one moved out: `forge advance <ISS-nn> [--unmet '<json>']`.

A triage rules how far back the work goes, never how far forward: it may not send an issue past the
rung it was at when the person spoke.
