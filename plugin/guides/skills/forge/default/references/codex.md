# `forge codex` answers as a different model, and it can be wrong

Read this before asking for a second opinion, and again before acting on one. What to type is
`forge codex -h`; when a gate asks for one and how to clear it is that gate's own page. What is
here is neither.

It is a genuinely different provider, which is the only reason a second opinion is worth its
tokens — `consult` refuses outright if the model slot resolves to this model's own family, so a
consult that runs is one worth reading.

**The intent is the part it cannot see.** Each file's diff and size travel for you and it reads the
rest itself, so never paste a file; say what you were trying to do, what you decided and why. A
review that knows the plan is a different review from one inferring it, and a review that has not
been told what the built-in advisor already said re-treads that ground and reads as independent
confirmation when it is duplication.

**Ask it to rule, not to roam.** A reviewer answering a named risk against a quoted line is
reliable; a reviewer inventing one is not, and a review pinned to what the turn changed cannot
wander into code nobody touched. Measured: six open rounds on one patch each found something
smaller than the last, so the round after a fix confirms or refutes the last round's findings
rather than looking again.

## Receiving it

A model's own errors are the ones it cannot see; it fixes them readily once someone else points at
them. So the finding is a *pointer*, and it is worth only as much as your verification of it:

```
READ all of it → RESTATE what it claims → VERIFY against the code → DECIDE → then change something
```

**Never answer "you're absolutely right".** Never start implementing before verifying — a model
challenged on a correct answer tends to cave, and capitulating to a wrong finding costs more than
missing a right one. If any finding is unclear, resolve *all* of them before changing anything;
they interact, and half-understood advice produces the wrong fix. Before "implementing properly",
grep for whether the thing is even called. Take blockers first, then the cheap ones, and test each
change on its own.

Rejecting a finding with a reason is a legitimate outcome, and the reason rides with the finding's
own id into the next consult. When a finding traces to a *document* that allowed the mistake, fix
the document too, not only the code.

Anything that is the user's call goes through AskUserQuestion rather than being settled between two
models.
