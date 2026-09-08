# Taking an issue off the wave without spending a run

The saving this skill exists for is mostly here. An issue dispatched, read, claimed and confirmed
before anybody notices it was already fixed has cost a whole run's opening, and the reading that
would have caught it is the same reading triage does anyway.

## What a disposition is earned by

Each of these ends the issue without code. None of them is a judgement call the dispatcher may make
on the strength of the body alone — the body is the claim, and the evidence is somewhere else.

| Disposition | Earned by |
|---|---|
| already fixed | the change that fixed it, named, and the behaviour the issue describes read at the current head |
| duplicate | the issue it duplicates, named, and the reading that says they are one thing rather than two that rhyme |
| intended | where the behaviour is decided on purpose — a rule, a refusal, a declared default — cited |
| obsolete | what the issue was about, gone: the file, the verb, the surface it names |
| premise false | the line of the body that is wrong, and what the code says instead |

Anything else *holds*, and holding is the ordinary answer. Most issues are real.

## The two ways a wave gets this wrong

**Deciding from the body.** An issue that reads as an obvious duplicate of another usually shares its
vocabulary and not its cause. Two reports of the same symptom from different code are two issues, and
merging them loses the second fix. Search the way a filing does — the same near-duplicate route,
against the same corpus — and then read both.

**Deciding from silence.** A search returning nothing is a fact about the search. Where the wave is
about to take a disposition on a negative, say which query returned nothing, so the run that reopens
it knows what was not looked for.

## The walk, for a round over the backlog

A round check finds candidates two ways, and neither finding is a disposition until both bodies and
the code have been read:

1. **Find.** `forge next --count N --why` prints each ranked row's neighbours by shared path and by
   text; `forge issues --status open --search <term>` per topic reaches the low-priority tail the
   rank never compares. A path relation at directory level means nothing; a title that says the same
   thing in the same words is a lead, not a verdict.
2. **Read the cause, not the vocabulary.** Open each candidate's "Why it happens" and the file it
   names. Two bodies naming one module and one mechanism are one issue; two naming the same shape in
   different modules are two, and each gets a comment naming the other. The older filing is the
   survivor unless the newer states the cause and the older only the symptom.
3. **Verify "already fixed" live, once for the set.** Run the verb on the installed copy by its own
   path, not the checkout, and name the landing that fixed it with its release. One live read covers
   every filing on that cause.
4. **Post, per issue, on its own command line.** A short `forge claim` whose record says nothing was
   worked under it; `forge record confirmation --finding duplicate|already-fixed --where … --is …
   --detail …`, the detail naming the survivor or the release; then `forge advance --drop --why` for
   a duplicate and `forge advance --set closed --why` for a fix that landed. The read-first gate may
   hold the first write with the thread's unseen comments: read them, re-send the same command.
5. **The survivor keeps what the dropped body added.** One comment on it, carrying the evidence and
   any rule the duplicate stated better; a drop with nothing carried loses the second report's
   reading, which is the one thing it was worth.
6. **Count it in the fold** as a run not spent, with the query that found it, and say which query
   returned nothing where a set was judged complete.

## Posting it

How a disposition is posted and what earns the status move are the executor's, stated in the
disposition paragraph of `forge guide issue-flow`. A wave takes one for the same reasons and by the
same route.

The one thing that is the dispatcher's: whatever lease this write needs is a short one, and it says
on the record that nothing was worked under it. An issue left holding a lease from a triage pass is
a reclaim charged to the next run — the cost this skill exists to remove, paid back with interest.
Where the CLI offers a route that needs no lease at all, that is the route, and this skill stops
using one the CLI withholds rather than working around the refusal.

A disposition taken here is counted in the fold against the run it did not cost.
