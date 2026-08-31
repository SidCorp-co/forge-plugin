# `forge codex` answers as a different model, and it can be wrong

Read this before asking for a second opinion, and again before acting on one.

It is GPT-5 Codex over the gateway's own API — a genuinely different provider, which is the only
reason a second opinion is worth its tokens. `consult` refuses outright if the model slot resolves
to this model's own family, so a consult that runs is one worth reading.

**Pipe it your intent, and name the files.** The file text is sent for you, so never paste it; the
intent is the part it cannot see, and a review that knows what you were trying to do is a different
review:

```
echo "what I was doing and why, the plan, the decisions I made" | forge codex consult src/a.mjs
```

With no file named it consults on the documents this turn changed. It has no tools, so it may reply
asking for a file — that is handled for you, up to three model calls, and never shown as if it were
a finding.

**It runs after the built-in advisor, never before, and it must be told what the advisor said.**
That one reads this conversation and cannot open a file; codex reads the files and has never seen the
conversation. The advisor's reply is unreadable after the fact, so the only moment its content can
reach codex is the same turn — write it into the intent. Skip that and codex re-treads covered
ground, its agreement reads as independent confirmation when it is duplication, and a disagreement
between the two is invisible.

**Ask it to rule, not to roam.** `--diff` sends each file's diff and refuses findings about code the
turn did not touch; `--verify "<risk>"` (repeatable) hands it named risks to answer CONFIRMED /
REFUTED / CANNOT TELL against a quoted line. Both raise precision sharply, because a reviewer
verifying a stated risk is reliable where a reviewer inventing one is not. `--only blocker,major`
drops the rest entirely rather than downgrading it.

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

Then close the loop: `forge codex verdict --accepted n --rejected n --note "..."` — it is replayed
into the next consult, and without it "resolved / still open" is a guess. Rejecting a finding with a
reason is a legitimate outcome and belongs in the note. When a finding traces to a *document* that
allowed the mistake, fix the document too, not only the code.

Anything that is the user's call goes through AskUserQuestion rather than being settled between two
models.
