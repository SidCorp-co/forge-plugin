# One transport

**One declared table, not a schema read at the call.** Every capability this CLI has is a row naming
the requests it makes and how the answer becomes the shape its callers read. The tool surface it
replaces was 130 KB fetched per process — 75% of the traffic of `forge issue` — and answered a
question the table answers for free. What the table costs instead is that it can go stale: the
tracker grows a column or a value and nothing here notices. So the table declares only what the
routes refuse *without saying what they wanted* — the enums and the length caps — and a refusal built
from one says it is this CLI's own word and where it is kept, because a value the tracker has grown
since is otherwise a defect with no route out of it.

**Two capabilities keep the JSON-RPC endpoint, by their own nature and not by any gap.** An upload
answers a multimodal model with an image block, and the step call opens the session everything else
reports into. Neither is a row a shell process could make out of a request.

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
