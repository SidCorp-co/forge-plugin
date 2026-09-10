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

**What loses it.** A command inside the command, in any of the ways a shell writes one, and only
where the shell would run it there:

| Written | Why it loses the name | Where it is prose instead |
|---|---|---|
| `$(…)` | a subshell of its own, expanded before this command runs and without its assignment | single quotes, or a `\` on the `$` inside double quotes |
| `` `…` `` | the same substitution, older spelling | single quotes, or a `\` on the backtick |
| `${ …; }` and `${\| …; }` | bash 5.3's brace substitutions, which run in this shell but before the assignment applies | single quotes, or a `\` on the `$` inside double quotes |
| `<(…)` and `>(…)` | a process substitution, likewise its own shell | either quote, since neither performs one |
| `<<` and `<<<` | a body the shell expands, and one this reader does not model | either quote, for the same reason |

**What decides is the quoting, and one reader answers it.** `plugin/src/hooks/shell-spans.mjs` reads
a shell text once and says what quoting each character stands under, so the question asked of an
opener is the one a shell asks: would this run, written here. A line continuation is removed before
the reading, both characters of it, because the shell removes it and joins what it split — so a `$`
and a `(` a backslash-newline sits between are one opener and lose the name.

Nothing inside an opener that does run is read, and that is deliberate: a `forge` call nested in one
would write under no name at all, so refusing unread is the safe direction, and no reading of what
sits inside an opener has survived review.

**The one quoting this cannot place: `$'…'`.** Inside an ANSI-C quoted word a backslash escapes, so
the apostrophe that looks like the closing one may not be, and every single-quote boundary after it
is a guess. A command carrying one is answered the way every opener was answered before any of this:
present anywhere, and the name is lost. Spell the value with ordinary quotes and it is read.

**So an identifier in a record's prose goes in as the rest of this repository writes it**, in
backticks, inside single quotes. In double quotes a backtick still runs, so escape it or apostrophe
the value; and the export form has none of this.

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
