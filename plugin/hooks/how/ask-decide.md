# ask-decide — a question that is not the owner's

Why: a question stops the session until the owner answers. Off a strict project the agent decides and
the record follows, so a routine question only spends the owner's time.

What it does by default (`asks.mode` unset or `record`): reads the project's gate profile once per
question. Off `strict`, a question naming none of the owner's subjects is refused. Decide it, record
it on the item it shapes with `forge record decision ISS-nn --decision "reading | assumption | undo"`,
and carry on.

Still the owner's: every question on a `strict` project, every question when the profile cannot be
read, and a question naming a secret, spend, a production or outward write, discarding the owner's
work, filing or dropping product work, or a contract others build against. `asks.owner` adds terms,
never removes these. The screen reads English and Vietnamese; text it cannot read goes to the owner.

`asks.mode=decide`: a question ending `[reversible: <the one command or correction that undoes the
choice>]` is answered from the owner's earlier answers where they are close and agree; anything else
goes to the owner. Each outcome is a line in `decided.jsonl`, which `forge doctor` names.

`asks.mode=off`: every question goes to the owner.

Not judged: whether a refused question was really routine, or a declared reversal really undoes.
