# codex — the image

The gateway a consult is sent to also serves an OpenAI-shaped images API, drawing from the same
pooled Codex accounts. `forge codex image` is how this plugin reaches it, and it lives under
`forge codex` because the gateway is that tool's: a capability is added to the tool whose backend
serves it, never routed through a verb of another tool (the owner's rule, 2026-10-01, ISS-3040; this
action, ISS-3288). So neither `codex image` nor `chatgpt image` names the other, in its help or in a
failure, and neither falls back to the other.

## One request, and the two endings

A picture costs a turn of the Codex seat's five-hour window, the one a consult spends, so the action
sends one request per invocation and never a second. The gateway's own word decides what a failure
cost: a 4xx is refused before any account is asked and a 503 found no account to ask, so those two say
no picture was made. Every other ending — a 502 or 504, which the gateway documents as an outcome it
cannot know, another 5xx, a torn body, a dropped socket, a clock that ran out — may already have drawn
and counted one, and the refusal says so rather than guessing. A redirect is refused rather than
followed, because a followed 307 is the same POST again. Downloading a URL the answer returned is not
a second attempt: the picture already exists, and a failed download is reported as a picture made and
not saved.

## What is sent

The model id is a label. At ISS-2688 the backend drew the same picture for every id it was sent, a
made-up one among them, so the action sends the `image_only` id the gateway's model list carries and
offers no flag whose value would change nothing. `n` is one, because the gateway refuses more.

The size is a hint the backend reads loosely — a square ask came back 1370 by 1148 — so it only leans
the canvas with the orientation, and the ratio itself travels as the prompt's last line, composed by
the same module `chatgpt image` composes through. The framing is the one
`forge doctor --chatgpt-prefix` saves: how this machine's pictures look is one decision, and a second
key for the same decision would be a second source that drifts.

The wait has a floor above the gateway's own 115-second cut and the proxy's near 125, because a client
that gives up first has thrown away a picture the account already paid for. A wait the caller types
is the one in force, and one that is not a number above nought is refused rather than read as none.

## What it is not

It is not a review. Nothing it does writes the consult log, the pending state a commit gate reads, or
a row an eval window counts, so drawing a picture neither owes nor discharges a consult.
