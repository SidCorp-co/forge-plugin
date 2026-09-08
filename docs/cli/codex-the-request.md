# codex — the request

**The cache is the provider's prefix, not a breakpoint we place.** The role and the replayed history
each carry a `cache_control` marker, and over 487 answered consults `cache_creation_input_tokens` was
0 on every single one: nothing this end asks for is honoured, because the slot resolves to a model on
another provider whose caching is automatic and keyed on the longest matching prefix of the request.
No read has been seen to cross from one consult to another: over 1,118 answered rows, the 94 that
made exactly one model call — the only rows where a read an earlier consult warmed would be
unambiguous, one call being one request — read 0 cache tokens each, on inputs from 2,234 to 79,847,
and the 13 groups among them that resent an identical recorded prompt version and digest in one
checkout, the closest pair less than a minute apart, read nothing either. That is an observation
rather than a rule the gateway states, but a change whose whole benefit is a prefix two consults
would share has never bought anything measurable here.
Reads do happen, and the one thing that visibly moved them was the tool list. A consult whose last call
was served `tools: []` read 11% of its input from cache; one that never reached that call read 22% —
the tool-less call is the only difference between those two groups, and system-and-tools is exactly the
front of the prefix. So the list now stays in the request on every call of a consult and the last one
is sent `tool_choice` of none instead. The cap is unchanged and stays this end's, which already refuses
and records a tool call made past it. `codex.toolChoiceNone: false` sends the empty list again.

The last three consults were the last three by date whatever they were about; one sharing a file comes
first now, because that is the one "still open" can be answered against.

**Containment is physical, not lexical.** `..` is the traversal you can see; a symlink committed inside
the repository is the one you cannot. A path is admitted by realpath and by being a regular file, for a
name on the command line as much as for one the reviewer asks for, and checking and reading stay two
operations — a checkout mutated between them is a race this narrows rather than closes. Scope is this
checkout plus the checkout of every file the caller named, because the account config and the gateway
profile both hold live tokens; a refused read is answered in words, since a reviewer that cannot tell
"outside" from "you forgot" asks again.

**An issue travels as its key.** A consult about filed work used to be handed the text: each issue read
back, written to a scratch file, the file named on the command line and its numbers repeated in the
intent — one consult on four issues carried four copies and a 900-character preamble restating what the
bodies already said, and every copy was stale the moment a comment landed. `forge codex consult ISS-807
ISS-809` sends the keys and the reviewer fetches what it needs, so the intent on stdin can be the
question alone. Keys alone put no file under review, naming a subject not being naming a change;
`--diff` or a named file beside them says a change is under review too.

**One tool reaches past the filesystem, and the token is why that is safe rather than why it is
refused.** The scope above exists because a live credential sits in a file a reviewer could name.
`read_issue` runs on this side against the tracker this checkout is aimed at, so the credential never
travels and the model sees text; what it gets back is the row's fields, the body and the thread, read
through the same readers `forge issue` and `forge comment` use rather than by spawning a CLI. It is
offered only where the consult named a key, so a consult with nothing to read pays no prompt for the
offer and can make no call worth refusing, and it may read any key the project holds — an issue cites
its siblings, and refusing those sends the reviewer back to the caller for the copy the whole route
exists to stop.

**Its budget counts requests and not calls.** One call resolves a key, reads a row and walks a thread,
so a cap counting the model's calls would bound nothing at the other end: the charge is taken inside
the transport, before each attempt, which is what makes a retried request and a nested lookup cost what
they cost. Past the cap a request is refused in words with nothing sent. Each read is asked once rather
than through the retry ladder, four waits of up to a minute inside a consult's own clock being the
review spent to answer nobody; a rate limit comes back as text, and a thread it cut short is handed
over as the prefix it is. A count bounds answers and not silence, so the read carries two
deadlines beside its single attempt: its own, and the consult's, which is the clock the model calls
already run under. A tracker that stops answering mid-stream would otherwise hold a review open past
the budget whose whole purpose is that it cannot; what comes back instead is the timeout in words,
and a request whose consult has already run out is refused before it is sent. A line longer than a whole page is clipped where it sits, on the convention a
file's read already uses — one pasted blob is a single line, and a page carrying it whole would
answer past the cap every other read of the consult is held to. Nothing the reviewer can call writes, and its read credits nothing on the
ledger of what a session has been shown — a session may not be excused a read somebody else made.

**A finding about tracker text anchors as one about a file does.** `ISS-45/body:12` is a `path:line`,
where the part is the name at the heading the tool printed and the line is as that text numbered it, so
the finding grammar needs no second form and a defect in a comment is reported without a scratch file.
The one thing that had to give was the file filter: a part name is in no checkout, so a finding
anchored to one is kept where a filter over paths would have dropped it whole.

**Three of the reviewer's four tools take the checkout when no path came.** `list_dir`, `git_diff`
and `grep` default to the root: 34 refusals in the log were that argument left out, and a reviewer
that meant the repository has nowhere else to mean. `read_file` keeps its path, having no such
default. And a path that is not there is answered with the entries of the nearest directory above it
that is, rather than the root's top — a leaf six levels down has siblings, and the root says nothing
about them.

**And what `git_diff` means by the checkout is the change under review, not `HEAD`.** Where the
consult is anchored — a base was named, or a recheck took the head its findings were made against —
the whole checkout at `HEAD` is a *different* diff from the one the reviewer was handed, and
answering that one is how a review came back judging the branch for removing code the branch never
touched. So a call with neither a path nor a ref replays the consult's own anchor over the files the
consult named, and says which commit that was; a path or a ref the reviewer typed is its own
question and is still answered as asked. Anchored to nothing, it is the whole checkout at `HEAD` as
before, and a scoped diff git will not run says so rather than widening to the scope the anchor
exists to hold. The untracked files of the set are named beside the diff rather than reconstructed
into it: `git diff` never lists a file git has not been told about, which a turn's new file always
is, so an unqualified "no change" was a false answer — and the body is already in front of the
reviewer, where a rebuilt addition would be a second copy of it.

**A malformed tool call is answered, not thrown.** Arguments that never parsed become an empty input
and come back as a refusal: the model's mistake to correct, not a reason to end a consult already paid
for.
