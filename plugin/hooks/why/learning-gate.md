# learning-gate — two writes, and they are not the same write

A memory row is *project knowledge*. An edit to a skill's own text is a *skill learning*,
which develops the method rather than the repository. Confusing them loses the lesson twice:
the project inherits a rule it never agreed to, and the skill repeats the mistake in the next
repository.

The failure this guards is not a bad memory row — it is the reflex one. An agent that
finishes a task reaches for "save what I learned" as a closing ritual, and the corpus fills
with entries nobody reads, which is how the two or three that mattered get buried.

So the gate is cheap to pass and impossible to pass absent-mindedly. The write is refused
once. A memory row passes on a second attempt carrying `metadata.checked`, and a file edit
passes on the next attempt at the same file in the same session. Naming the category is the
point — it is the one part of the test that cannot be answered by nodding.

**The reason is a pointer, not a copy of the document.** The four conditions, the five
categories and the destinations are `skills/issue-flow/references/learning.md`, and a refusal
that reprinted them spent the same 300 tokens on every edit — measured at eight refusals in
one session, restructuring five skills. What comes back now is one line of test, the category
names to answer with, and the path; the path itself is printed for the first refusal of a
session only, stamped like any other once-per-session decision. A file read once beats a
paragraph read eight times, and it is also the only copy, so the two cannot drift.

**A declared `type:` buys nothing.** It used to end the check, so the only memory write ever stopped
was a malformed one — and shape is not what is wrong with a second copy. The schema is in the agent's
own instructions, so `type: feedback` costs it nothing to type. Every memory write and edit is now
stopped once per file, with one action fitted to the situation: a new file is asked why it should
exist and given the shape, an edit is told to replace the wrong rule in place rather than append a
version beside it, and a restatement is named. A write carrying no content is reminded too rather
than waved through, because emptying a memory is exactly when "delete it if the rule no longer
holds" is the advice.

Condition 4 is the one a hook can actually check, so the text is compared sentence-by-sentence with
the other memories in the directory and above 0.45 the reminder names the file it restates.
Calibrated on six real memories: five score 0.00 against the others, the one genuinely related pair
0.27, a paraphrase re-filed under a new name 1.00. A file is excluded from its own comparison, so
revising one never reads as duplicating it.

A memory or skill file written through the shell would pass all of that unseen, because
`sed -i` and a heredoc carry no content the gate can read, and the decision has to happen
*before* the write. So that route is closed for those two kinds of file rather than
approximated. Naming a file is not touching it: only a command carrying a write shape is
asked about, so reading a skill stays free. That shape counts only as a token of its own — a write
flag read unanchored matched inside the filename `erp-issue-workflow.md`, and a redirect read the
same way matched the `<noreply@anthropic.com>` in a commit trailer. Variables are expanded first,
because assigning a guarded directory to a name and redirecting to that name walked straight past
an earlier version.

**A refusal names which kind of file it means**, states the rule in one line, and gives one action.
"A memory or a skill" makes the reader work out what it is being told, and a refusal that only
redirects the tool teaches nothing about whether the fact belongs in a file at all.

**A heredoc body is data — until an interpreter executes it.** `python3 - <<PY` hands its body to a
program that runs it, so discarding it as data left a `Path(...).write_text(...)` aimed at a guarded
directory invisible, and a memory file was rewritten unasked. Two faults: the write shapes an
interpreter uses (`write_text`, `writeFileSync`, `shutil.copy`, `os.replace`) were missing from the
list, and the body carrying them was thrown away. A body survives now when the operator's own line
names something that executes stdin, which `cat` does not. `bodiless` lives in `_hook.mjs` because
`codex-second` needs it too — a data heredoc there was an *intent* quoting the write shapes, and
the gate refused the consult that was about to describe them.

The cost is real. A program that carries a write shape *and* quotes a guarded path is refused even
when the path is only prose — which caught the very commit documenting this. Which token the program
would actually open is not knowable from the text, and refusing is the right side to err on when the
way out is one tool call.
