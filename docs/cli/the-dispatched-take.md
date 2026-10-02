# the dispatched take — a dispatcher's lease handed to the run it sent

The other half of [the short lease](the-short-lease.md): that one is the discipline a dispatcher owes
its own writes, and this is what the claim does for the run it dispatched when the discipline was
not kept.

The short lease is a discipline, and the write it is about is the one a dispatcher makes on its
way to handing the issue to somebody else. A dispatcher that forgets it takes a default lease over a
line it has already finished writing, and the runner it dispatched in the same minute is refused
every write until that lease runs out: fifteen minutes of a 25-minute lease when this was measured,
forty-five of the hour a default one runs now (ISS-1091).

**The record already identified the run that was waiting.** A delegated run holds an id its worktree
minted, and the mint spells the issue into it — `iss-1091-90f5a52f` is ISS-1091's (ISS-467). A run
holding that id is, by construction, the run that issue was dispatched to. So a live lease held by
anybody whose id does not also name that issue no longer refuses its claim, and the handoff goes on
the claim history under a word of its own, because the count a reclaim prints counts runs that
stopped at a status, and a dispatcher that never held the work is not one of them.

**Three conditions keep it to the dispatch**, each a case where a live lease is work rather than a
hold. The landing checkpoint governs wherever its state names a turn, so an issue-bound id cannot
walk a builder past the state that handed its turn to somebody else — those turns are `--take`'s.
Past the statuses a run is first dispatched at, the holder has to be provably the session that
sent this run, because a lease there is otherwise a run at work. And a holder whose own id names the
same issue is the run the dispatch already reached, which is the wave of several runners the lease
exists for.

**A resume is dispatched past those statuses, so the proof there is the process and not the
status.** A run sent to take up an issue at `in_progress`, or to finish one at `developed`, met its
dispatcher's lease exactly as the triage runner did, and the status alone sent it to wait out the
lapse — two hours, once (ISS-2205). Every agent a session dispatches runs inside that session's host
process, and the lease records the process and the host it was written from. So a lease written from
the claiming call's own process on its own host, by a holder whose id names no run, is the session
that dispatched this call: inside one process the only holder that is no run is the one that sent the
others, and an id naming this issue is minted only by a dispatch to it. A dispatcher in another
process proves nothing this way and is still refused; the refusal names the give-back it can make.

**A refusal that stands names which of the four stopped this caller**, and prints the line the holder
left. One route for all four would send three of them back to the refusal they have just read, which
costs the turn a guess — this repository's own rule about what a refusal owes.

**Past the dispatch statuses the holder is named before the id**, because where the holder is not
this call's dispatcher no id takes the lease, and a sentence about the tree an id comes from sends
the caller to a route that cannot work. At the rungs a verdict is written from, the caller is most
often a judge, and the tree it was sent to brief is one its own method says it does not hold. So the
refusal there names the judge's write instead, which takes no lease (ISS-1798).

**What this does not do is read the holder's prose.** The route first built matched the sentence
above inside the holder's `--next` line, and the review retired it: the note the incident was filed
from does not contain that sentence, a `next` line survives a change of holder so a second run would
inherit authority it was never given, and a line denying the sentence still contains it.
