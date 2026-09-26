# ask-decide — a question the owner's own answers already settle

Why: a question stops the session until the owner answers. Where the owner has answered the same
question before and the choice undoes in one step, the stop buys nothing.

Off unless the project opts in: `forge doctor --set asks.mode=decide`. Under `off`, or any other
value, nothing is read, built or logged.

How to have a question decided: end it with `[reversible: <the one command or correction that undoes
the choice>]`. Without that line it goes to the owner, and the session is told once.

What decides it: this project's own earlier answers and recorded decisions, from its transcripts. A
consult picks the option the closest of them point to; where none is close, the close ones disagree,
or anything fails, the owner is asked. A call is decided whole or not at all.

Always the owner's: a secret, spend, a production or outward write, discarding the owner's work,
filing or dropping product work, a contract others build against. `asks.owner` adds terms, never
removes these.

Review: each outcome is a line in `decided.jsonl` beside the project's config; `forge doctor` names it.

Not judged: whether the declared reversal really undoes the choice.
