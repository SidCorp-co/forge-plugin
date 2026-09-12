# ChatGPT

One turn per invocation and never a second. The backend answers a failure that happened *during*
polling with the same `isError` shape it answers a refusal with, and salvages onto it the account and
conversation id that served the turn — so an error does not establish that nothing ran, no
idempotence key is on offer, and a replay against a metered upstream can spend a second real turn or
open a second conversation. A failure that may have been spent says so and names `--resume <id>`
where an id came back, which hands the decision to a person rather than taking it.

The rule was the user's, on 2026-09-09, against this issue's own earlier text: the original asked for
one retry, and the backend's salvage is why that was wrong.

Having no retry loop is not by itself enough to keep the promise. `fetch` follows a 307 or 308 with
the method and the body intact, so a redirect on the endpoint puts a second `tools/call` on the wire
that no code here asked for; the turn refuses to follow one and reports the ambiguous failure
instead. The image download is a `GET` and still follows redirects, because that costs no turn.

Two transports, because the backend has two. The turn goes over the MCP endpoint and a local file's
upload goes over REST, which is search-master's own split rather than a choice made here; there is no
REST route that sends a turn. The uploads of one turn go up together, so ten attachments are one wait
rather than ten. What that costs is on a refusal: every upload is spent before one of them is
reported, where a loop would have stopped at the first. The exchange is the part a caller can act on
— the message names the earliest file the caller named, rather than whichever request happened to
answer first, which is a fact about the network and not about the call. The transformation between them takes the URL as an argument instead of
reading one, since two endpoints are configured now and a function reading its own would derive one
caller's origin from the other's host. It refuses a URL that never ended in `/mcp` rather than
appending a path to whatever it was given.

The answer is selected by more than its id. The streamable transport may put a server-to-client
*request* on the same stream, under an id counter of its own that starts where ours does, so the id
alone is satisfiable by a message that is not an answer — and reading one would print an empty
result as a silent success. A reply carries no `method` and does carry a result or an error envelope.
For the same reason a success with no readable text part is refused as a spent turn rather than
printed as nothing at all.

Every diagnostic quotes a body the far side wrote, and a gateway that echoes the request's headers
into a 4xx puts the configured key in it, so the key is struck out of external text before anything
is printed. The type list a refused upload names is the backend's own words, never a copy kept here: the
authority for it is `ALLOWED` in search-master, which this repository cannot write to and does not
gate.

No default model is sent. The upstream ignores an unknown slug silently rather than refusing it, so a
default from here would misreport which model ran; the reply's model line is printed only where the
body carried one, and `_meta` carries the account but no model.

The endpoint and the key are `forge doctor`'s, in this plugin's own config beside the tracker's
token. Reading them off the codex gateway profile was tried and reversed: that file's owner is an
external shim, so a chatgpt turn would break the day the shim's profile moved. Widening this to every
value the plugin reads is ISS-934 and not this verb's to do.

The proof is a stub wearing the backend's shapes. The upstream's browser pool was empty for every
turn of the 2026-09-08 probe, so a gate that needs it is a gate that goes red for the weather — a
live turn is evidence beside the suite and never the thing the suite waits on.

## What earns a turn

Every invocation is metered, so the question a caller owes is not how hard the job looks but
whether this session could do it at all. A turn is earned when the answer needs something this
session does not have, and three asks qualify. Pixels it cannot make. A different provider's
judgement — an open-ended ask, ideas, a reaction to something half-formed, where nothing that comes
back is acted on as fact and so no verification follows the turn. And a reading of an attached
image that a script cannot give: asked on 2026-09-12 for the hex colours of a flat vector picture
and the role each played, it named the accent and the background exactly, which sampling by itself
does not do, because sampling answers which values are there and not which one is the accent. On a
photograph or a gradient there is no such thing as *the* exact value, and what comes back is a
chosen representative rather than a measurement.

What the rule refuses is the more useful half. An image read for its text or its content is
refused, because the session holding this CLI already reads one for nothing; that refusal lifts
only at a volume its own reading cannot absorb. A job being simple is not a reason either: a job
simple enough to describe in one prompt is usually one the session can do for itself, and *simple*
was never the test.

Two jobs the picture path in particular is not for. Structure — a layout, a flow, a component tree
— belongs to a deterministic diagram, which renders for nothing, stays editable afterwards and
invents no text inside the picture. Seeing what the code actually does is not what this verb is
for either; that is a job for whatever runs the code.
