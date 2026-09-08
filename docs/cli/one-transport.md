# One transport

**One declared table, not a schema read at the call.** Every capability this CLI has is a row naming
the requests it makes and how the answer becomes the shape its callers read. The tool surface it
replaces was 130 KB fetched per process — 75% of the traffic of `forge issue` — and answered a
question the table answers for free. What the table costs instead is that it can go stale: the
tracker grows a column or a value and nothing here notices. So the table declares only what the
routes refuse *without saying what they wanted* — the enums and the length caps — and a refusal built
from one says it is this CLI's own word and where it is kept, because a value the tracker has grown
since is otherwise a defect with no route out of it.

**One endpoint, so there is no fallback to hide a gap behind.** Every row of the table is a request
under the API base, which is the one configured value with its trailing endpoint segment stripped —
so a host saved in either form keeps working and `forge doctor` prints both, the value it read and
the base derived from it.

**An upload is one authenticated request with the bytes in it, and its two targets are two routes.**
The presigned dance — mint a ticket, then PUT the bytes to it unauthenticated — exists for a caller
that cannot hold bytes, and a shell process can. What that move costs is the pre-flight it bought
for nothing: the ticket carried the tracker's verdict on the name before a byte went, and one
request cannot ask before it sends. So a name the tracker will not take now costs that file's own
request and leaves the files before it up, undeletable, which is what the refusal has to say and
what to cite instead of the path.

**The type an upload is judged on travels on the part, so this CLI is what puts one there.** The
tracker reads the type off the multipart part rather than off the file name and accepts an allowlist
of types, so a client sending none has every upload refused as untyped. The extension-to-type map
here is a copy of the guess the tracker's own upload tool makes: narrower and a name that goes up
today is refused, wider and this CLI invents a type the tracker never guessed. It is a guess and not
a verdict — what accepts or refuses is still the tracker's allowlist, and the refusal that arrives is
its own 400 body.

**A content type is declared where a body of that type follows, and nowhere else.** Declaring
`application/json` on every request that was not an upload cost the tracker's merged mark its only
correction: the merge handler parses the payload a request declares before it looks the issue up, so
a `DELETE` carrying nothing read as an empty payload and every `unmark` there had ever been was
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
is worse than a refusal: the caller reads a whole answer as though it were the narrow one it asked
for, and pays for the difference without being told. Two arguments are every row's rather than any
route's — the action the table's key is made of, and the project the caller may aim a project-scoped
route with.

**The table's key is not a name the tracker has.** Where a tool carries its action in an argument,
`<tool>.<action>` is this CLI's own reading of the pair — and it is what `forge tools` prints, so a
caller types it back. Read as a tool name it reaches the route while every check keyed on the tool
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

**Announcing a write is not a courtesy owed per verb**, which is how two of them were written without
it. It happens in the transport, so a verb added later cannot forget.

## The credential guard sits here, and states its own edge

*Where does a credential stop being this CLI's problem?*

One seat rather than a list of the payload kinds that may carry a secret, because that list goes
stale the next time a verb learns to write: the guard sits at this write boundary, so every payload
with a `data` object passes it. The attachment holds the second seat on its own — bytes ride beside
the payload and never reach the boundary — and every file of a write is judged before the first
request of it goes, since there is no delete for an upload.

**The guarantee has a stated edge, and the edge is the point.** A value long enough to be a secret is
refused wherever a payload holds it. A shorter one is refused only where a field *is* it, quoting and
surrounding punctuation aside. A credential field plausibly holds a word like `admin`, and the only
mechanism that would catch that word inside a sentence is one that refuses every payload containing
it — a gate no developer gets past, which is a defect rather than strictness. A review pressed twice
for the wider guarantee; what was wrong was the width of the claim, not the mechanism, so the claim
narrowed. A project whose credential is five characters is the project's to fix.

The read behind all of it is soft and memoised: one call per process that writes, and a read that
fails lets the write through. A payload refused because of a read this CLI could not make would be a
refusal with no route out. Which values are credentials at all, and why the shape of the value decides
rather than a list of names: [the test credentials](test-credentials.md).

## Why the vocabulary has a checker

*What stops the tracker's names leaking back in?*

Because they leaked once already, and a name in a printed string is invisible to every other gate.
`plugin/src/checks/tracker-names.mjs` refuses either of the tracker's two column names inside a
string literal under `plugin/src` or `plugin/hooks`. It states them as patterns and its own reader
reaches them by property access, so neither the rule nor the code it guards is a quoted span and no
exemption is needed — an exemption list is where a rule like this goes to die. `forge schema` and
`forge call` are outside it on purpose: they pass the server's own text and JSON through, and masking
the tracker's words in the tracker's own answer would be a different and worse thing.
