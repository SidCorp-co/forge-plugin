# learning-gate — two writes, and they are not the same write

A memory row is *project knowledge*. An edit to a skill's own text is a *skill learning*, which
develops the method rather than the repository. Confusing them loses the lesson twice: the project
inherits a rule it never agreed to, and the skill repeats the mistake in the next repository.

The failure this guards is not a bad memory row — it is the reflex one. An agent that finishes a task
reaches for "save what I learned" as a closing ritual, and the corpus fills with entries nobody
reads, which is how the two or three that mattered get buried.

So the gate is cheap to pass and impossible to pass absent-mindedly. The write is refused once: a
memory row passes on a second attempt carrying `metadata.checked`, a file edit on the next attempt at
the same file in the same session. Naming the category is the point — it is the one part of the test
that cannot be answered by nodding.

**The reason is a pointer, not a copy of the document.** The four conditions, the five categories and
their destinations are in `skills/issue-flow/references/learning.md`; a refusal that reprinted them
spent the same 300 tokens on every edit, measured at eight refusals in one session. What comes back is
one line of test, the names to answer with, and `forge hooks --why learning-gate`. A file read once
beats a paragraph read eight times, and one copy cannot drift from another.

**A declared `type:` buys nothing.** It once ended the check, so the only memory write ever stopped
was a malformed one — and shape is not what is wrong with a second copy. The schema is in the agent's
own instructions, so `type: feedback` costs nothing to type. Every memory write and edit is stopped
once per file with one action fitted to the case: a new file is asked why it should exist and given
the shape, an edit is told to replace the wrong rule in place rather than append a version beside it,
and a restatement is named. A write carrying no content is reminded too, because emptying a memory is
exactly when "delete it if the rule no longer holds" is the advice.

Condition 4 is the one a hook can check, so the text is compared sentence by sentence with the other
memories in the directory, and above 0.45 the reminder names the file it restates. Calibrated on six
real memories: five score 0.00 against the others, the one genuinely related pair 0.27, a paraphrase
re-filed under a new name 1.00. A file is excluded from its own comparison, so revising one never
reads as duplicating it. What it quotes as evidence is one line, since a sentence can run from a
frontmatter description into the next key.

A memory or skill file written through the shell would pass all of that unseen — `sed -i` and a
heredoc carry no content to read, and the decision has to happen *before* the write — so that route
is closed for these two kinds of file rather than approximated. Naming a file is not touching it: only
a command carrying a write shape is asked about, so reading a skill stays free. What counts as a
write, and why each shape is anchored: `forge hooks --why writes`.

**A heredoc body is data — until an interpreter executes it.** `python3 - <<PY` hands its body to a
program that runs it, so discarding it left a `write_text` aimed at a guarded directory invisible and
a memory file was rewritten unasked. A body survives when the operator's own line names something that
executes stdin, which `cat` does not.

The cost is real. A program that carries a write shape *and* quotes a guarded path is refused even
when the path is only prose — which caught the very commit documenting this. Which token the program
would open is not knowable from the text, and refusing is the right side to err on when the way out is
one tool call.
