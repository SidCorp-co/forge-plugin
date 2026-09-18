# One transport

**Two files.** `plugin/src/tracker/routes.mjs` is the table below and makes no request;
`plugin/src/tracker/rest.mjs` makes them all. A guard saying a module reached no write can then name
the one file that writes.

**One declared table, not a schema read at the call.** Every capability this CLI has is a row naming
the requests it makes and how the answer becomes the shape its callers read. The tool surface it
replaces was 130 KB fetched per process — 75% of the traffic of `forge issue` — and answered a
question the table answers for free. What the table costs instead is that it can go stale: the
tracker grows a column or a value and nothing here notices. So the table declares only what the
routes refuse *without saying what they wanted* — the enums and the length caps — and a refusal built
from one says it is this CLI's own word and where it is kept, because a value the tracker has grown
since is otherwise a defect with no route out of it.

**One endpoint, so no fallback hides a gap.** Every row is a request under the API base: the one
configured value with its trailing endpoint segment stripped, so a host saved in either form works
and `forge doctor` prints both the value it read and the base derived from it.

**An upload is one authenticated request with the bytes in it, and its two targets are two routes.**
The presigned dance — mint a ticket, then PUT the bytes to it unauthenticated — exists for a caller
that cannot hold bytes, and a shell process can. What that move costs is the pre-flight it bought
for nothing: the ticket carried the tracker's verdict on the name before a byte went, and one
request cannot ask before it sends. So a name the tracker refuses now costs that file's own
request and leaves the files before it up, undeletable — which the refusal says, with what to cite
instead of the path.

**The type an upload is judged on travels on the part, so this CLI is what puts one there.** The
tracker reads the type off the multipart part rather than off the file name and accepts an allowlist
of types, so a client sending none has every upload refused as untyped. The extension-to-type map
here is a copy of the guess the tracker's own upload tool makes: narrower and a name that goes up
today is refused, wider and this CLI invents a type the tracker never guessed. It is a guess and not
a verdict: the allowlist is still the tracker's, and the refusal that arrives is its own 400 body.

**A content type is declared where a body of that type follows, and nowhere else.** Declaring
`application/json` on every request that was not an upload cost the tracker's merged mark its only
correction: the merge handler parses the payload a request declares before it looks the issue up, so
a `DELETE` carrying nothing read as an empty payload and every `unmark` was
answered `Malformed JSON in request body` — the same refusal a `POST` to that route gets, which
`mark_merged` escapes only because its body is always an object. The line is the tracker's, not this
CLI's guess at it: the same bodyless `DELETE` without the header reaches the handler, a `GET`
carrying it is served, and the knowledge store's own `DELETE` answers `deleted` either way. A route
wanting a field in that body says so by declaring one, which is what carries `unmark`'s note.

**A capability with no route fails where it is asked for, naming the route it wanted.** A fallback to
the other endpoint would keep the verb working and hide the gap for as long as both endpoints exist,
which is exactly as long as nobody is going to notice. The refusal names the path the row would have
wanted and what still reaches the same thing, so the gap is reportable to the tracker as a route.

**An argument the row's route does not send refuses the whole call.** A narrowing dropped in transit
is worse than a refusal: the caller reads a whole answer as the narrow one it asked for, and pays
the difference untold. Two arguments are every row's rather than any
route's — the action the table's key is made of, and the project the caller may aim a project-scoped
route with.

**The table's key is not a name the tracker has.** Where a tool carries its action in an argument,
`<tool>.<action>` is this CLI's own reading of the pair, and a refusal naming a route prints it, so a
caller reads it back. Read as a tool name it reaches the route while every check keyed on the tool
looks at the wrong one: the verb that wraps the pair, the capability record, the write targets the
read-before-write check is made from. So a name of that form is turned back into the pair it stands
for before any of them is asked, and each is given the tool the tracker knows.

**One capability may compose more than one request.** The full read of an issue is the row, its edges
and its attachments, on three routes; they are asked for together, so the read costs one round trip
rather than three. A reader naming the fields it wants pays only for the parts those fields are on,
which is what keeps a lease renewal — four per command — from fetching an attachment list nobody
reads.

**A 200 whose body is not a record is refused rather than projected.** A proxy in front of the
tracker answers HTML with a 200, and an empty page built out of it reads as the tracker saying the
row is not there. Every projection here is total, so the check has to happen before one runs.

**Rate limits.** The server states its own wait. Failing instead of honouring it turns a two-second
pause into a lost run; honouring it without a ceiling turns a server saying 3600 into an hour of
sleep. Whether a call may be sent again at all is the row's own declaration and never a reading of
the payload: an action that mutated outside its data field was a write the payload reading called a
read.

**Errors.** The route's own body carries a code, a message and the field-by-field detail of a schema
refusal; that is the whole diagnostic and nothing here re-derives it. Each message is stripped of the
tracker's data fence before its field name is put in front of it, the fence being anchored to the
start of a line and a marker with `field: ` ahead of it starting none.

**The project travels as an identifier in the path**, where it travelled as a slug in a header. The
slug-to-identifier answer is cached beside the configuration and keyed by endpoint: an issue's
project never changes, and a credential change is what drops it.

**What a write says about itself, and what its answer carries back**, is one topic of its own: [what a write says](what-a-write-says.md).

**A write that took half of what it was asked for says which half beside the row, and that sentence
is read off the answer rather than out of a row's projection.** The transport reads it off every
write's body, one call above the row that body becomes, because above that point there is nothing
left to read: a projection keeping a fixed set of a row's fields drops every sibling
of them with it, and the one dropped here reads to a caller exactly like the whole call having
happened — the status line is true about the status and silent about everything else. It is *said*
and never raised: the write it stands beside did happen, and a caller told otherwise would undo work
that stands. The words are the tracker's and stay them, a second wording being a second thing to keep
in step with a rule this CLI does not own.

**The credential guard sits at this boundary**, one seat rather than a list of the payload kinds
that may carry a secret. What it guarantees, where that guarantee stops, and what a reading that
did not answer costs: [the credential guard](the-credential-guard.md).

## Why the vocabulary has a checker

*What stops the tracker's names leaking back in?*

Because they leaked once already, and a name in a printed string is invisible to every other gate.
`plugin/src/checks/tracker-names.mjs` refuses either of the tracker's two column names inside a
string literal under `plugin/src` or `plugin/hooks`. It states them as patterns and its own reader
reaches them by property access, so neither the rule nor the code it guards is a quoted span and no
exemption is needed — an exemption list is where a rule like this goes to die. The two verbs that
used to sit outside it passed the server's own text and JSON through, masking nothing, and they are
gone: every route is some verb's now, and a verb answers in its own words.
