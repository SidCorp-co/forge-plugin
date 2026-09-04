# `claim` — one run holds an issue, as far as a client can promise

The issue's session field was there from the start and nothing wrote it: measured 2026-09-02, a
search for it across this plugin answered nowhere at all. It now holds a lease — a holder, a renew
time, a duration and the claims before this one — taken by the pick and renewed by every payload
write the CLI makes. A run that dies leaves the field behind, and the field is what the next run
reads.

Three measurements shaped it. The tracker replaces that field rather than merging it and answers
with the keys in an order of its own, so the compare is blind to key order: the first read-back
rejected a write where nothing had changed. There is no conditional write (ISS-7), so the compare
is a read, a write and a read back, which cannot stop another run's write and only refuses to build
on it — `forge claim` says so in its own output rather than leaving a reader to assume otherwise.
And 429 is the only answer this tracker gives that means it did not process a call, so it is the
only one anything but a read is sent again on; a gateway status or a dropped socket is retried for
a named read alone, because idempotence is documented for the merged mark and nothing else. Which
actions those are is decided here rather than read off the arguments: one of them mutates with no
payload field at all, and an action this list does not name is not retried.

A lease past its duration is another run's to take, and the holder's own next write renews it and
says so. The first version renewed it without reading the state at all, and a live run then showed
a dead session writing payloads half an hour after its lease had gone, silently; the refusal that
replaced it named `forge claim`, which cost the eleventh dry run two rounds for a value the CLI had
already read. What makes the renewal safe is what the refusal never used: the field still names this
session, and a run that took the issue would have replaced the holder, so the two states that mean
somebody else's lease still refuse. It is safe as far as the read, and no further — a reclaim
landing between the read and the write is the ISS-7 window, which the refused route paid too,
because `forge claim` is the same three calls. That read is the last call before the write: the
comment gate every write passes was a round trip sitting between the two, and a review of this
issue's own change caught it there, widening a window the CLI cannot close by as long as a
comments list takes. A reclaim is a handoff between two holders, though, so a holder
taking its own lapsed lease back appends nothing to the history and brings no park closer.

The holder is the harness's own session, read twice to check that it is stable for the life of a
process tree. Outside a harness it is a file under the config directory, which names a machine
rather than a run: two runs there look like one holder and neither is refused. Each payload write
costs three calls for the lease — the read, the write, the read back — and every one of them pays,
because a park is three writes and an upload of four files is four: a run reclaimed halfway through
has to be refused at the next of them rather than carried to the end.

Two facts beside the lease itself. **The holder names the kind of agent and the process id
beside the session**, because a uuid places nobody: when ISS-26's shell died, whoever had to decide
between waiting for that run and taking the issue off it could read only a uuid, and could not tell
what had held it or whether it still ran. Every refusal that names a holder names all three. Both
come from the environment, since no file can name a run, and both read `unknown` where the harness
set neither — a lease written before they existed is still a lease.

**And the lease carries one line naming the step whoever comes next starts on.** `--next` sets it on
the claim, on `forge advance` and on any `forge record` that writes; every renew keeps it, because a
payload write is not a new step; and the transition it precedes clears it, because that step is over.
A claim that takes an issue over prints it, `forge advance --owed` prints it above the shortfall,
and the claim history keeps the line that was current at each reclaim, so a crash loop shows where each attempt
died rather than only that it did. Nothing checks the sentence — it earns no status and it is the
run's note to its successor, not a payload. It is written by the renew that precedes the write it
belongs to, which is the same call that refuses a stale holder, so a write that then fails can leave
the line describing a step that never started; that costs a sentence and never a fact, because what
earns anything is the record, and a second lease write to close the gap would cost three more calls
on every payload and leave a gap of its own between the two. The measurement that asked for it: the sixth dry run's
agent died mid-consult, and the one fact its record could not hold was which codex round it was in,
so the round was run again to find out. The verbs that write something other than a payload — a
comment, the plan field, an upload, a dependency edge — renew the lease and leave the line alone.

**Every write to an issue lists that issue's comments first**, because the read that looks complete
returns none of them. The renew that precedes each payload write is where the list is made, and the
one route that renews nothing, `forge call`, makes it from its own payload. An empty list costs one
line and no round at all. Comments this session has not been shown *are* the refusal: every one on
the page the list returns is printed whole, in the fence the tracker returned it in, with the count
when the tracker holds more, and the same command sent again lands — so
the round that is spent carries the content the rule exists to deliver rather than a pointer to it.
The delivery is recorded under `~/.config/forge/`, which is what makes one process's reading the
next one's and a run's reading its delegates' — the account's directory outlives both, where a
transcript belongs to one of them. What it takes to owe a delivery again is one document, `forge
hooks --how issue-read-first`, and the same state answers whichever route asks. Where nothing names
a run — a bare shell, no harness — the machine is the session, because a key per process would
refuse every command and no key at all would refuse forever. Two costs are the
routes' own rather than that rule's: a comment created through the tracker's tool returns its id to
a client no hook can see, so that one comment is handed back once; and nothing past the page the
list returns is delivered at all, the seam a cursor closes and the reason `advance` refuses an issue
with more comments than a page outright. The pre-hook makes the same list before the
call, for the tracker's own tool and for a `forge` write in a shell command alike: the plugin copy a
session loads and the `forge` on its PATH are separately installed and can be different versions, so
neither is trusted to be the other — one list twice on the path where both hold is the price, and a
gate switched off leaves the verb, which cannot be.
