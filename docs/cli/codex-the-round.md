# codex — the round

A consult's rounds are its wall time and almost all of its cost, so what one buys, what it is asked at
and what stops it repeating itself are decided here. What travels in the request itself:
[the consult](codex-the-consult.md).

**Calls are the only lever on wall time**, which is `calls × ~45s`, almost all of it thinking before
the first token: one timed consult was 49.5s, 39.5s of it silence. Against the same gateway a trivial
call is 1.6–2.0s and this payload with one word asked for is 6.1s, so input size is not where the
minutes go. Eleven runs over a fixture with two planted defects: given ten calls it used two on a
two-file review and four on a four-file one with three named risks, and a cap of three lost no finding
while saving a third of the time (99s against 145s). Every run found both defects at every cap from one
upward, so rounds are for *reaching* code, not for thinking longer. The last call is warned one round
early: a model told mid-answer that its tools are gone has already spent the round it would have read
in.

**Three was a constant, and it was the wrong shape.** Over 487 answered consults, 384 ended at exactly
three calls, and what a reply then said tracked the cap and not the difficulty: a clause saying the
reviewer could not check something appears in none of the 22 one-call replies, 10 of the 75 two-call
ones and 251 of the 384 three-call ones. Three is now where a consult *starts*, and the payload moves
it — a `bodies` pass holds every file it was asked about and has nothing to fetch, so it starts a call
lower; each clipped file is the one thing that reliably costs a retrieval round, so it earns one back.
`--rounds n` is still used exactly as typed.

**A review that says it could not check is not shown and then patched by the next consult.** It is one
attempt short, so it gets one more at `codex.roundsMax`, and the caller sees nothing until that one
answers. Which is why the first attempt is buffered rather than streamed: "retried before it is shown"
and a stream to stdout cannot both hold, and what streaming was actually for — telling a slow review
from a hung one — is the `call N of M` and tool lines, which print either way. The predicate is one
definition, shared by the field on the row, the retry's trigger and the stats line, and the one thing
it must never match is `CANNOT TELL`: that ruling is what the verification grammar *asks for* on a risk
the reviewer cannot decide, and retrying there buys the same answer at twice the price.

Thinking tokens come out of the same ceiling as the reply, which is why 8,000 was mostly spent before
the review began.

**The effort travels on the model, because that is the channel the gateway reads.** `reasoning_effort`
looked like a lever and was not one: 326 of 400 logged consults named a model whose own id said `high`
while the parameter beside it said `low`, `medium` or `minimal`, and nothing downstream acted on the
parameter. This gateway states a model's effort in the model id and validates the suffix — an invented
one is refused with a 400, each real rung answers echoing the id — so the rung is the lever and the
parameter was being dropped on arrival. `codex.rungs` maps a level to a model; a level the table does
not name falls back to the base rung's model, and a machine naming no table at all reaches the one slot
the profile maps, exactly as it did before the table existed. A request carries whichever of the two
channels the resolved model leaves free and never both, and each record says which one carried it, so a
window from before this and a window from after are not scored as one treatment.

Medium is the rung a consult climbs from rather than a level nothing acts on. What moves it is the kind
and the size, one step and never two, the kind winning where both apply. A recheck is asked a narrower
question than the pass that raised the findings, so it steps down; a whole-set `--send bodies` review
and a `--verify` ruling on named risks are each a deeper read of a set already in hand, so they step up;
and a change under `codex.effortLines.small` steps down and one over `.large` steps up, measured on the
diff where the consult is anchored to one and on the bodies where it is not.

**A follow-up round verifies; it does not roam.** Six rounds on one patch, each a full review, each
finding a narrower hole than the last with no signal to stop on. `--recheck` replays the previous
consult's findings as the verification list, which is the shape the reviewer is reliable in.

That was half of what stops a consult repeating itself. The other half is that 100 of 196 rechecks raised something marked
New, and each one cost the head another fix and another round — a recheck asked to confirm went looking
instead. So a recheck now anchors to the head its findings were made against, which puts the diff since
that head in front of the reviewer instead of the whole file it has to find the change in again; where
nothing differs from that head the consult runs without a diff rather than refusing, because the
findings are still owed a ruling. And its system prompt carries a clause the first pass does not: the
round exists to close findings, not open them. It does not forbid a New one — a defect the fix itself
introduced is real — it requires the bullet to name why the earlier round could not have seen it, which
is the sentence a wasted round cannot write. `newFindings` on the row is what says how often that
worked.

**Angles are the checkout's.** On this CLI three of the four wrote "nothing material" in every one of
92 consults — output paid for, and the reader skimming past the one angle that mattered. The board
stays for a product with screens; `.forge.json` names the angles that fit.
