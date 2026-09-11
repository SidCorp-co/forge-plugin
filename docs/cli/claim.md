# `claim` — one run holds an issue

The issue's session field was there from the start and nothing wrote it: measured 2026-09-02, a
search for it across this plugin answered nowhere at all. It now holds a lease — a holder, a renew
time, a duration and the claims before this one — taken by the pick and renewed by every payload
write the CLI makes. A run that dies leaves the field behind, and the field is what the next run
reads. What makes the lease exclusive rather than advisory is
[the precondition](the-precondition.md).

Two measurements shaped the writing. The tracker replaces that field rather than merging it and
answers with the keys in an order of its own, so the compare is blind to key order: the first
read-back rejected a write where nothing had changed. And 429 is the only answer this tracker gives
that means it did not process a call, so it is the
only one anything but a read is sent again on; a gateway status or a dropped socket is retried for
a named read alone, because idempotence is documented for the merged mark and nothing else. Which
actions those are is decided here rather than read off the arguments: one of them mutates with no
payload field at all, and an action this list does not name is not retried.

A lease past its duration is another run's to take once the lapse outlasts the lease itself, and
the holder's own next write renews it and says so. The first version renewed it without reading
the state at all, and a live run then showed a dead session writing payloads half an hour after
its lease had gone, silently; the refusal that replaced it named `forge claim`, which cost the
eleventh dry run two rounds for a value the CLI had already read. What makes the renewal safe is
what the refusal never used: the field still names this session, and a run that took the issue
would have replaced the holder, so the two states that mean somebody else's lease still refuse. It
is safe as far as the read, and no further — a reclaim landing between the read and the write is
the window the precondition closes, and which the refused route paid too, because `forge claim` is
the same three calls. That read is the last call before the write: the comment gate every write
passes was a round trip sitting between the two, and a review of this issue's own change caught it
there, widening a window nothing in this CLI could close by as long as a comments list takes. A
reclaim is a handoff between two holders, though, so a holder taking its own lapsed lease back
appends nothing to the history and brings no park closer.

The holder is the harness's own session, read twice to check that it is stable for the life of a
process tree. Outside a harness it is a file under the config directory, which names a machine
rather than a run: two runs there look like one holder and neither is refused. **Inside one, so do
the agents of a dispatched wave** — every one of them inherits the dispatching session's
`CLAUDE_CODE_SESSION_ID`, so a wave of runs is one holder and the refusal this whole mechanism
exists for is unreachable in the only situation where more than one run exists at once (ISS-445).
Nothing ambient separates them: the process id and the socket both name the parent, and a plain
working directory is no run's for the length of a run — unless the tree names one, in a
`forge-run-id` file its git directory holds (ISS-467). So a run is given an id, in
`FORGE_SESSION_ID` or in that file, by whatever creates it.

**Write it where the gate can read it.** The read-before-write gate runs in the harness's process,
handed no `FORGE_SESSION_ID`, so what it learns which run this is from is the command it judges:
`export FORGE_SESSION_ID=<id>` or `FORGE_SESSION_ID=<id>` prefixing a `forge` call, at any command
of that text (ISS-672), or the tree that text will run in. Given a way it can read none of, the run
pays the round it would with no reader at all rather than a wrong one.

Which spelling survives what the call carries: [the granted id](the-granted-id.md).

**And an id a tree minted names the issue that tree was cut for**, which is the one thing about a
run the record can say without being told. `iss-1091-90f5a52f` is ISS-1091's, and the run holding it
is by construction the run ISS-1091 was dispatched to — so a live lease held by anybody whose id is
not also one of that issue's no longer refuses its claim. What that drops is a wait nobody could
shorten: a dispatcher takes a lease to post a triage line, hands the issue on, and the runner it
dispatched was refused every write until the lease ran out — fifteen minutes of a 25-minute lease
when this was measured, forty-five of the hour a default one runs now (ISS-1091). No flag, and
nothing the dispatcher has to remember: the tree the runner was given is the record.

The exception is kept to the dispatch by three conditions, each one a case where a live lease is
work rather than a hold. The **landing checkpoint** governs wherever its state names a turn, so the
turns stay `--take`'s and an issue-bound id cannot walk a builder past the state that handed its
turn to somebody else. The take reaches only the **statuses a run is dispatched at**, so a lease at
`in_progress` or past it reads as a run at work and refuses as it always did. And a **holder whose
own id names this same issue** is the run the dispatch already reached, which is the wave of several
runners the lease exists for. A refusal that stands says which of the four conditions stopped this
caller, because one route for all four sends three of them back to the refusal they have just read.


Where it was not, the CLI **says so and does not refuse**. A run whose own id came from the
dispatching session is told, where it claims and where it reads the lease, that the holder it
matched names a wave rather than a run. Refusing that write instead would change what a claim means
and would stop the runs the arrangement exists to let work; the guard is the id, not the refusal.
Holder equality is half the test, so another run's explicitly given id is never called shared —
nothing about a holder string this reader did not write is this reader's to judge. `forge doctor`
names the source of the id it holds, so a wave sharing one is visible before it writes rather than
after.

Each payload write costs the lease a read and a write, and a read back on top of them where the far
end refuses no stale write; and every one of them pays, because a park is three writes and an upload
of four files is four: a run reclaimed halfway through has to be refused at the next of them rather
than carried to the end.

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
comment, an upload, a dependency edge — renew the lease and leave the line alone; the plan is a
record kind now and carries it.

**Every write to an issue lists that issue's comments first**, because the read that looks complete
returns none of them. The renew that precedes each payload write is where the list is made. An empty
list costs one line and no round at all. Comments this session has not been shown *are* the refusal: every one on
the page the list returns is printed whole, as its author wrote it with the tracker's fence already
off it, with the count when the tracker holds more, and the same command sent again lands — so
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
