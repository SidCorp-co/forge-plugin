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
| superseded | the release or the issue that replaced the flow, named, and the reading that says this issue's own ask is answered there, differently |

Anything else *holds*, and holding is the ordinary answer. Most issues are real.

**Superseded is not obsolete.** Obsolete is the subject gone — the file, the verb, the surface.
Superseded is the subject still standing, inside a flow a later release replaced or an ask a later
release answered differently.

**Age earns neither, nor any other row.** An old issue describing something still true is still
real, and the bar does not fall because nobody has looked in a year.

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
   rank never compares; `forge knowledge search "<title>"` asks the near-duplicate search a filing
   is measured against, which is the one route that reads a family whose members chose different
   words for one cause, and it answers with scores and the tracker's own ids rather than keys. A
   path relation at directory level means nothing; a title that says the same thing in the same
   words is a lead, not a verdict.
2. **Read the cause, not the vocabulary.** Open each candidate's "Why it happens" and the file it
   names. Two bodies naming one module and one mechanism are one issue; two naming the same shape in
   different modules are two, and each gets a comment naming the other. The older filing is the
   survivor unless the newer states the cause and the older only the symptom. What decides a fold is
   reports-or-symptoms, never the module: two reports of one thing fold onto a survivor wherever they were
   filed, and two distinct symptoms of one cause fold nowhere, however far inside one module and one
   mechanism they sit. Those leave triage as the phase's cluster instead.
3. **Verify "already fixed" live, once for the set.** Run the verb on the installed copy by its own
   path, not the checkout, and name the landing that fixed it with its release. One live read covers
   every filing on that cause. Where the evidence is another repository's source rather than this
   one's behaviour the rule is the same and easier to miss: a checkout answers for its own date, so
   the date is read and written beside the finding. A tree a day behind reads exactly like a current
   one, and will say a shipped surface does not exist.
4. **Post, per issue, on its own command line.** `forge claim`, then `forge record confirmation
   --finding duplicate|already-fixed|superseded --where … --is … --detail …`, the detail naming the survivor or
   the release; then `forge advance --drop --why` for a duplicate or a supersession and plain `forge
   advance` for a fix that landed under another key, whose confirmation already earns the drop and
   carries its own reason — a status typed past the one the record earns is refused. The read-first
   gate may hold the first write with the thread's unseen comments: read them, re-send the same
   command.
5. **The survivor keeps what the dropped body added.** One comment on it, carrying the evidence and
   any rule the duplicate stated better; a drop with nothing carried loses the second report's
   reading, which is the one thing it was worth.
6. **Count it in the fold** as a run not spent, with the query that found it, and say which query
   returned nothing where a set was judged complete.

## A round over the whole backlog, rather than over a wave's few

**Slice the set by family, never by count.** Splitting a backlog between two readers by giving one
the first N and the other the rest cuts through families, and a family cut in two is folded twice,
onto two heads, each holding half the evidence and neither aware of the other. Reconciling that
costs more than the split saved, and nothing reports it: both readers finish clean.

**The fold floor is a filing's, not a pair's.** `FOLD_FLOOR` is calibrated for one new body measured
against the whole corpus, where a near-copy scores high. Two issues already open, filed apart by
authors who chose different words for one cause, read below it and are still one issue. So a round
that stops at the floor leaves behind exactly the families the floor was never meant to catch: read
the band beneath it, and report where the yield falls away, because that figure is the only evidence
anyone has for where the line belongs when both sides are already open.

## Posting it

How a disposition is posted and what earns the status move are the executor's, stated in the
disposition paragraph of `forge guide issue-flow`. A wave takes one for the same reasons and by the
same route.

The lease these writes take is not a disposition's and is not stated here. Which of this phase's
writes need one at all is the method's Phase 2, and the refusal a write with no lease meets prints
the command in full.

A disposition taken here is counted in the fold against the run it did not cost.

**A reading this page cannot make is filed, never supplied by hand.** Where an issue fits no row and
*holds* is not honest either, what is missing is a reading the method does not have, and it goes on
the backlog as a filing against the method.
