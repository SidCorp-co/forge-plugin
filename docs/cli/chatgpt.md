# ChatGPT

One turn per invocation and never a second. The backend answers a failure that happened *during*
polling with the same `isError` shape it answers a refusal with, and salvages onto it the account and
conversation id that served the turn — so an error does not establish that nothing ran, no
idempotence key is on offer, and a replay against a metered upstream can spend a second real turn or
open a second conversation. A failure that may have been spent says so and names `--resume <id>`
where an id came back, which hands the decision to a person rather than taking it.

The rule was the user's, on 2026-09-09, against this issue's own earlier text: the original asked for
one retry, and the backend's salvage is why that was wrong.

Two transports, because the backend has two. The turn goes over the MCP endpoint and a local file's
upload goes over REST, which is search-master's own split rather than a choice made here; there is no
REST route that sends a turn. The transformation between them takes the URL as an argument instead of
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
is printed. The type list a refused upload names is the backend's own words, never a copy kept here:
this repository is read-only against search-master, and a copy is a claim about another codebase that
goes stale without failing anything.

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
