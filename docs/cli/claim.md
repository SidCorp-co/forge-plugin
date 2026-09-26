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
its lease had gone, silently; the refusal that replaced it named `forge claim`, which cost
ISS-57's run two rounds for a value the CLI had already read. What makes the renewal safe is
what the refusal never used: the field still names this session, and a run that took the issue
would have replaced the holder, so the two states that mean somebody else's lease still refuse. It
is safe as far as the read, and no further — a reclaim landing between the read and the write is
the window the precondition closes, and which the refused route paid too, because `forge claim` is
the same three calls. That read is the last call before the write: the comment gate every write
passes was a round trip sitting between the two, and a review of this issue's own change caught it
there, widening a window nothing in this CLI could close by as long as a comments list takes. A
reclaim is a handoff between two holders, though, so a holder taking its own lapsed lease back
appends nothing to the history and counts as no reclaim.

**A claim writes the lease and never parks**: only the caller knows it is alive, so the reclaim
count is said to it (ISS-693).

The holder is the harness's own session, read twice to check that it is stable for the life of a
process tree. Outside a harness it is a file under the config directory, which names a machine
rather than a run: two runs there look like one holder and neither is refused. **Inside one, so do
the agents of a dispatched wave** — every one of them inherits the dispatching session's
`CLAUDE_CODE_SESSION_ID`, so a wave of runs is one holder and the refusal this whole mechanism
exists for is unreachable in the only situation where more than one run exists at once (ISS-445).
Nothing ambient separates them: the process id and the socket both name the parent, and a plain
working directory is no run's for the length of a run — unless the tree names one, in a
`forge-run-id` file its git directory holds (ISS-467). So a run is given an id, in
`FORGE_SESSION_ID` or in that file, by whatever creates it. Only an id of the form
`iss-<n>[+<n>...]-<8 hex>` names the issues its run was dispatched to, and `forge brief ISS-nn
--tree <tree>` writes one into a tree that has none: the brief is what every dispatch sends, so a
dispatcher outside this repository binds its run where the lease reads it rather than in a record of
its own the plugin cannot see (ISS-1682).

**Write it where the gate can read it.** The read-before-write gate runs in the harness's process,
handed no `FORGE_SESSION_ID`, so what it learns which run this is from is the command it judges:
`export FORGE_SESSION_ID=<id>` or `FORGE_SESSION_ID=<id>` prefixing a `forge` call, at any command
of that text (ISS-672), or the tree that text will run in. Given a way it can read none of, the run
pays the round it would with no reader at all rather than a wrong one.

Which spelling survives what the call carries: [the granted id](the-granted-id.md).

Where it was not, the CLI **says so and does not refuse**. A run whose own id came from the
dispatching session is told, where it claims and where it reads the lease, that the holder it
matched names a wave rather than a run. Refusing that write instead would change what a claim means
and would stop the runs the arrangement exists to let work; the guard is the id, not the refusal.
Holder equality is half the test, so another run's explicitly given id is never called shared —
nothing about a holder string this reader did not write is this reader's to judge. `forge doctor`
names the source of the id it holds, so a wave sharing one is visible before it writes rather than
after.

Each payload write costs the lease a read and a write, and a read back on top of them where the far
end refuses no stale write; and every one of them pays, because an upload of four files is four writes: a run reclaimed halfway through has to be refused at the next of them rather
than carried to the end.

What the lease records beside the holder, and the two readings that settle a lease its duration
cannot: [the dead holder](the-dead-holder.md).

**The lease also carries one line naming the step whoever comes next starts on.** `--next` sets it on
the claim, on `forge advance` and on any `forge record` that writes; every renew keeps it, because a
payload write is not a new step; and the transition it precedes clears it, because that step is over.
A claim that takes an issue over prints it, `forge advance --owed` prints it above the shortfall,
and the claim history keeps the line that was current at each reclaim, so a crash loop shows where each attempt
died rather than only that it did. Nothing checks the sentence — it earns no status and it is the
run's note to its successor, not a payload. It is written by the renew that precedes the write it
belongs to, which is the same call that refuses a stale holder, so a write that then fails can leave
the line describing a step that never started; that costs a sentence and never a fact, because what
earns anything is the record, and a second lease write to close the gap would cost three more calls
on every payload and leave a gap of its own between the two. The measurement that asked for it: ISS-32's run, whose
agent died mid-consult, and the one fact its record could not hold was which codex round it was in,
so the round was run again to find out. The verbs that write something other than a payload — a
comment, an upload, a dependency edge — renew the lease and leave the line alone; the plan is a
record kind now and carries it.

**A capture that arms nothing prints the checks the project spends before one**, where its record
declares `ready.checks`, and nothing where it does not. The served method says the cheap checkers go
before a landing is armed and names none, because it is every project's; a run left to pick its own
set armed a landing a directory-count lint then refused, the per-file linter it had run being green
on the same tree (ISS-2515). The plain `--pushed` is the place because Phase 4 takes it before the
status moves and at every push, so it is read before `--pushed --ready`, which runs it. A value the
key does not take is said on that capture rather than read as no list.

**The arming capture runs those checks and refuses on a red one.** Printed and not held, the list
was advice a run could skip or cut short, and five landings in a row were handed back on one of its
checks, each red in seconds on the candidate (ISS-2555). They run after every refusal of the lease
and the checkpoint, so a capture refused for those spends none, and from the top of the checkout,
where the commands a project writes expect to stand. A tree holding what the head does not carry is
refused before anything runs, because a green over uncommitted files answers for no commit; a value
the key does not take refuses the capture too, since reading it as no list would arm a landing on
checks nobody ran.
