# The field rules — three values judged on what they say, and the two ways round a check

Every field of every record shape was checked for form: present, one of a set, a sha of the right
length. Form is cheap and it is not the question a reader has. So a confirmation whose *where* read
`everywhere`, a decision carrying two of its three parts, and a failing verdict with no reason all
passed the write and earned their statuses, and each cost somebody the same thing afterwards — a
reader who had to go and find out what the record was for.

Three rules answer that, and what they judge is content rather than form:

- a **`--where`** names a path or an identifier — a file, a symbol, a clause, an issue key — so a
  reader can go and open it;
- a **`--decision`** carries all three parts of `reading | assumption | undo`, the undo being what
  the record exists for: a decision nobody can reverse is a decision, not a record of one;
- a **failing `--verdict`** carries `--why`, because a `fail` is the one verdict another run acts on,
  and one saying only `fail` sends them back to run it again to find out what.

**Each is applied twice**: at the write, where the author can still fix it, and again on the
read-back, where a record typed past this verb reaches the entry checks by routes no gate sits
before. That second application is what makes the rules worth having — a comment carrying the tag
and the keys is a whole payload as far as a presence check is concerned. It also means a record
already on the tracker can stop earning a status: that is the rule arriving rather than a defect, and
`forge record <kind>` written again on this build clears it.

Only the rules a reading can settle are here. Whether the path a *where* names is the right path, and
whether the undo would really undo anything, are the reviewer's questions — a check attempting either
would pass a dishonest answer and refuse an honest one.

## The two ways round a check, and what each leaves behind

A check that cannot be gone round is a check that traps an issue. Three of them read something only a
person supplies — a reviewer's comment, a credential, a status the tracker itself set — so the flow
needs one route past the table, and the only question is what that route records. It used to be a raw
tool call, printed by the refusal that could not be cleared. That works, and it records nothing: the
status moved, the field changed, and the page said neither that a check had been skipped nor why.

`forge advance <ref> --set <status> --why <w>` and `forge issue <ref> --set <field>=<value> --why <w>`
are those two writes with three things added:

- the `--why` is refused empty before anything is sent, the reason being the only thing on the record
  that says why the ladder was gone round;
- the reply says no entry check read it, so whoever is watching the output learns it there and not
  from the history a week later;
- a correction goes on the record naming what was set and the reason, which is the payload every
  other after-the-fact change in this flow already uses.

`--set` on a status reaches a side status with the payload the tracker demands of one — the reason,
and the waiting kind where it wants one — so it is a park's transport without a park's entry checks.
Into `needs_info` the correction goes up *first*, because any comment there is read as the reporter's
answer and would put the issue straight back to `open`.

A *field* set on an issue already waiting for an answer is refused outright, for the same reason read
the other way round: the correction an override owes is a comment, so writing one there would move
the status as a side effect and leave a record that mentions only the field. The refusal names the
two moves in the open — the status first, the field after it.

That order has one cost, and it is stated where it lands. A move refused after its record went up
leaves a page reading as a status the issue does not hold, so both routes that write record-first ask
for the tracker's refusal rather than exiting on it, and report the pair: the record that stands, the
status that did not move, and the two commands that settle it.

**A field a record writes is refused rather than overridden.** The plan, the criteria, the release
note and the lease each have a verb, and a status is earned by the payload that verb writes; letting
`--set` reach one of them would be a status earned by a field nobody checked, wearing a correction
that says as much. So `--set` is for the fields no record owns — the complexity, the category, the
title — and for the status where a person has decided something no record can carry.

The value itself goes to the tracker as given. This CLI declares no set for a field it has no verb
for, so what is legal there is the tracker's answer and its refusal is what a caller reads; the cap
the route table declares for a field is still spent, because that one is knowable here.
