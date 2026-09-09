# the granted id — which call keeps the name it was given

A hook is handed no `FORGE_SESSION_ID`. It runs in the harness's process, so the only place it can
learn which run is about to write is the command it is judging. Two spellings put the name there, and
`docs/cli/claim.md` says why a run needs one at all. This page says what each spelling survives,
because a call whose name is lost is credited to whatever dispatched the session — a whole wave of
runs, under one id — and the next write is then held on the record the run itself just wrote.

## The export form has no opener limit

`export FORGE_SESSION_ID=<id>` puts the name in the shell's own environment, so everything that
shell goes on to start inherits it: a later command, a pipeline stage of one, a substitution inside
one. Nothing about a covered call's own words is read, so none of the openers below apply to it.

It has a limit of its own, which is reach. The reader covers a later call only where nothing could
run that call without the export having run first: reached unconditionally, or joined to it by an
unbroken `&&` that no `||` can jump into. So `cd /tmp && export FORGE_SESSION_ID=a-run; forge …`
grants nothing — the `;` puts the write outside the export's own condition — and neither does an
export inside a subshell whose write is outside it, or one on the far side of a pipe.

What loses it besides is a name the reader cannot resolve or cannot trust. Spell the id out — this
reader has the text and not the shell that will run it, so `"$RUN_ID"` names nothing. One text names
one run: two different ids, or a second id mentioned anywhere in the text, and the reader declines
rather than guess. An `unset`, a `source`, a `sudo`, a `su` or an `env -i` takes the name back.

## The prefix form covers one command

`FORGE_SESSION_ID=<id> forge …` is an assignment on a single command. The prefixed process does hold
it, and so does anything that process itself starts. What never sees it is anything the *invoking*
shell expands while building this command, because that happens before the assignment is applied —
and that is the whole of what follows.

**What the call may carry.** Anything but a second command. A redirection belongs to the process
being granted, so `2>&1` and `> out.log` keep the name, and so does any character a quoted argument
hands on as prose — an ampersand, a semicolon, a pipe, a parenthesis, a `$` that expands rather than
runs, a `>` that is part of a sentence rather than of the shell.

**What loses it.** A command inside the command, in any of the ways a shell writes one:

| Written | Why it loses the name |
|---|---|
| `$(…)` | a subshell of its own, expanded before this command runs and without its assignment |
| `` `…` `` | the same substitution, older spelling |
| `<(…)` and `>(…)` | a process substitution, likewise its own shell |
| `${ …; }` and `${\| …; }` | bash 5.3's brace substitutions, which run in this shell but before the assignment applies |
| `<<` and `<<<` | a body the shell expands, and one this reader does not model |

Each is refused without being read, and that is deliberate. A `forge` call nested in one would write
under no name at all, so refusing is the safe direction; and no reading of what sits inside an opener
has survived review. An apostrophe delimits nothing inside double quotes, quote removal spells
`for"ge"` into `forge`, a `#` makes the reader drop the rest of a here-doc line, and a backslash
before a newline makes an opener out of two characters neither of which is one. So the question asked
is whether an opener is present, never what follows it, and an opener inside single quotes is refused
along with the rest.

**The consequence to write around: an identifier in a record's prose goes in without backticks.**
This repository's writing convention is to put one around every identifier, and a backtick is an
opener whichever quote surrounds it. Write the name plain, or use the export form, which has none of
this.

## Where a lost name shows

Nothing refuses, and `forge doctor` will not show it. Two readers are in play and only one is
affected: the CLI is handed `FORGE_SESSION_ID` in its own environment and goes on using it, which is
what doctor reports, while the hook has only the text and falls back to the dispatching session's
id. So the write lands under the run's own name and the *gate* credits the wave. The cost arrives one
write later: the gate holds the next write to that issue and quotes the run its own record back. An
identical re-send clears it, that being the whole of that gate's rule and not a second defect —
`forge hooks --how issue-read-first`.

Read with this: [`claim`](claim.md) for the lease the name is the key to, and
[`the-consult`](codex-the-consult.md) for the other place a run's identity is recorded.
