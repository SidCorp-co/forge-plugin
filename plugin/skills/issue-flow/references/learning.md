# Learning selectively

**Most rounds should record nothing.** A workflow that writes a lesson after every issue
produces a corpus nobody reads, and the few entries that mattered are buried in it. The
default at the end of a round is silence.

## First, separate two things that are not the same

- **Project knowledge** — true of *this repository*: an invariant, a danger, how a
  mechanism actually works. It belongs to the project: its `CLAUDE.md`, or the tracker's
  memory under the tracker's own categories. It is not this rule's business beyond saying
  where it goes.
- **A skill learning** — true of *the method*: the workflow anticipated something wrongly,
  or a trap recurs across projects. **This belongs to the skill and the plugin around it**,
  and this rule exists so the skill develops instead of accreting.

Writing a skill learning into project memory is the common mistake and it loses the lesson
twice: the project inherits a rule it never agreed to, and the skill repeats the mistake in
the next repository.

## The test — all four, not any

Whichever kind it is, recording it is worth doing only when every one of these holds:

1. **It cost a cycle**, not a thought. A wrong turn corrected in the next command is not a
   finding; an hour on a symptom whose cause was elsewhere is.
2. **It will recur.** It is a property of the tool, the repository or the method — not of
   this issue's particular shape.
3. **Its failure is silent.** A thing that announces its own cause needs no note; the next
   reader needs the same thirty seconds you spent reading the message.
4. **It is not already written.** Search first. A second copy is worse than nothing: the two
   drift, and whoever finds one cannot know the other exists.

Fail any of the four and the round ends with nothing recorded. That is the normal outcome.

## Where a skill learning goes

**1. Into the plugin's code.** A trap a program can recognise belongs in the program: a
hook that refuses the command, a check in the CLI, a validation that makes the mistake
unrepresentable. It is the only destination that cannot be missed — prose is read by an
agent that decided to read it; a check fires whether or not anyone remembered.

Judge it by whether the wrong state has a *shape*: a command matching a pattern, a field
absent, a file missing, an ordering violated. If it does, it is a check waiting to be
written, not a paragraph.

**2. Into the skill's own text — and into the specific place it belongs**, never appended
to a general pile:

| Category | What it is | Where it lands |
|---|---|---|
| **trap** | the environment or a tool behaves in a way the method did not anticipate | a check in the plugin; failing that, `verification.md` |
| **method defect** | a phase produced the wrong outcome, or had no branch for what happened | that phase in `SKILL.md` |
| **invariant** | something that must hold in every project, not just this one | a rule in `SKILL.md` — and only if it outranks a phase |
| **discovery gap** | something Phase 0 should have established and did not | `project-discovery.md`'s list of what to establish |
| **boundary error** | the skill asserted something that is a project's to decide | **delete it from the skill**, and say what replaced it |

The last row is a real outcome and the easiest to miss: some learnings *subtract*. A rule
that turned out to be one project's convention is removed, not softened.

**3. Nowhere.** Still the most common answer.

**A learning that survives lands in the reference for its category — not in `SKILL.md`.**
The spine is a fixed set of rules and phases; it changes only when a rule changes or a
phase's shape was wrong. Everything else that a round teaches grows in the references, and
a sentence that ends up in both is a correction waiting to be missed in one of them.

## Where project knowledge goes, since it will come up in the same breath

Under the destination's own categories, never as one undifferentiated entry. The tracker's
memory classifies by `source`: **`knowledge`** (how this codebase actually works — you had
to trace it), **`decision`** (a choice among alternatives, with the reason), **`policy`** (a
rule whose violation is a defect regardless of tests passing), **`note`** (episodic — why
this one issue happened). The agent's own memory files classify by `type`: **`user`**,
**`feedback`**, **`project`**, **`reference`**.

**One entry is one fact** — an entry holding three things is found by none of the three
queries that wanted one of them. And **a lesson about the user is never a lesson about the
code**: a preference is `feedback`, and filing it as `policy` turns one person's choice into
a rule the next project inherits.

## The second occurrence is the promotion trigger

A trap that fires twice while still living in prose is evidence the prose does not work. The
second occurrence is not a reason to word the sentence more firmly — it is the trigger to
move it down to destination 1. If it cannot be made into a check, say why in the same
change, because "this cannot be automated" is itself worth knowing.

## Pruning is half of learning

A skill only grows unless something removes from it, and a stale rule is read and obeyed.
Three things earn deletion:

- **A rule the plugin now enforces** — deleted from prose the day the check lands. Two
  authorities for one rule is how they diverge, and `scripts/skill_dup.py` measures it
  rather than leaving it to a reading.
- **A rule the tool now documents itself.** Anything a `-h`, a schema or an error message
  says is no longer the skill's to repeat.
- **A rule whose reason expired** — the bug was fixed upstream, the convention changed.

When a round records something, spend the same breath asking what it displaces. A skill that
only accumulates stops being read, and a skill that is not read enforces nothing.

## Changing the workflow itself

A phase skipped three times is evidence about the phase, not about the sessions that skipped
it. Record the pattern first and change the phase once it has recurred — a workflow
rewritten from a single bad round is fitted to that round. Then read
`references/prior-art.md`, which says what the current shape already considered and turned
down.

**The gate is a hook, not this paragraph.** `hooks/learning-gate.py` stops the first write
to a memory store *and* the first edit to a skill's own text, returning the four conditions
and the categories. It exists because the failure it guards is a reflex — reaching for "save
what I learned" as a way of ending a task — and a reflex is not interrupted by a document it
has already stopped reading.
