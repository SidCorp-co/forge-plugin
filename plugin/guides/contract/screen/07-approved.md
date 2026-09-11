### `approved` — reads the decision record, the plan, the criteria, the clause the issue cites and the blocking relations

The plan is a typed payload, not free prose. This contract checks that its sections are there;
whether an answer is any good is the reviewer's to say. A plan already on the tracker stays writable,
and nothing earns a status on an untyped one.

The decision record is read here rather than at a rung of its own: a reading that says an explicit
*none found* is still the record this status refuses without, and where it says something, the plan
beside it is where that reading has to appear anyway. Each of the three is dropped by its own row of
the ladder, so a rung that owes no plan may still owe the reading.

The cited clause is a fourth reading, and one only a project keeping a requirements tree is asked
for. `forge advance <ref> --owed` says whether this issue owes one; `forge record criteria -h` says
which fields answer it and in what form, so a file is written carrying it rather than corrected once
the refusal has already cost the consult that read it.
