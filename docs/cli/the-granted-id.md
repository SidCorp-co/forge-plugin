# the granted id — which call keeps the name it was given

A hook is handed no `FORGE_SESSION_ID`. It runs in the harness's process, so what it can read is the
command it is judging: the name spelt in that text, or the tree that text will stand in when it runs
(ISS-467). Two spellings put the name there, and `docs/cli/claim.md` says why a run needs one at
all. This page says what each spelling survives and what the tree answers for, because a call whose
name is lost falls back to the tree, and with no tree to whatever dispatched the session — a whole
wave of runs under one id — and the next write is held on the run's own record.

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
rather than guess. An `unset`, a `source`, a `sudo`, a `su` or an `env -i`/`-u`, either spelling, takes the name back.

**The take-back and the reach read the same quoting** as the openers below: `\unset` and `"unset"`
take the name back, an escaped `;` or a comment's `unset` does not, and the reach ends at any opener
below a shell would act on, a bare `(` too. A here-document whose body is data is none of those:
its operator is a redirection, and the export reaches past it.

**A second id is a second assignment to this name**, read wider than a grant is. A longer variable
whose name ends in this one is a different variable and costs nothing. Everything else assigning
*this* name is a second id, the unresolvable ones included: `FORGE_SESSION_ID=` with no value,
`FORGE_SESSION_ID="$OTHER"`, and `FORGE_SESSION_ID=X"other"`, the one word `Xother` a shell joins.
That last is why wide is safe — read narrowly it looks like `X`, and a text exporting `X` further
out would grant a name the process never holds. A grant has to be a name; a mention only has to be
there.

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
| `<<` whose body runs a substitution, or which this reader cannot delimit | the shell expands that body before the command runs, and a body with no end is one this reader does not model | a quoted delimiter, or a `\` on the `$` or backtick inside the body |
| `<<<` | a word the shell expands, and one this reader does not model | either quote, since neither performs one |

**What decides is the quoting, and one reader answers it.** `plugin/src/hooks/shell-spans.mjs` reads
a shell text once and says what quoting each character stands under, so the question asked of an
opener is the one a shell asks: would this run, written here. A line continuation is removed before
the reading, both characters of it, because the shell removes it and joins what it split — so a `$`
and a `(` a backslash-newline sits between are one opener and lose the name.

Nothing inside an opener that does run is read: a `forge` call nested in one would write under no
name at all, so refusing unread is the safe direction.

**The one quoting this cannot place: `$'…'`.** Inside an ANSI-C quoted word a backslash escapes, so
the apostrophe that looks like the closing one may not be, and every single-quote boundary after it
is a guess. A command carrying one is answered the way every opener was answered before any of this:
present anywhere, and the name is lost. Spell the value with ordinary quotes and it is read.

**So an identifier in a record's prose goes in as the rest of this repository writes it**, in
backticks, inside single quotes. In double quotes a backtick still runs, so escape it or apostrophe
the value; and the export form has none of this.

## A here-document's body is data

A body is the stdin of the command it stands on. What that process does with its stdin is its own,
exactly as a script file handed to `bash` is, and this reader never opens one of those either. So
where the body can be delimited exactly, every reader here takes it out before reading: the words
in it are no call, no id and no move. A comment written by `cat > file <<'EOF'` can quote the
variable and name every verb it likes, and the `forge` call after it keeps its grant, its reach and
its tree.

Four shapes are read as they were before, with the operator still an opener, because each one is a
body this reader cannot vouch for:

- **An unquoted delimiter whose body runs a substitution** — `$(…)`, a backtick, `${ …; }`. The
  invoking shell runs it before the command and without a prefix's assignment. Inside the body a
  quote is data and stops nothing; only a `\` on the `$` or the backtick does, and a
  backslash-newline joins an opener it splits, as it does on a shell line.
- **No delimiter line.** The shell reads to the end of the text; this reader does not guess where the
  author meant it to stop.
- **A quoting the walk guesses at** before the operator's line ends — the `$'…'` and nested-quote
  cases above.
- **An operator inside an open parenthesis.** In `$((…))` and `((…))` a `<<` is a shift, and in
  `$(…)` or a subshell the body is one the reach already stops at.

What that costs: a body a program runs — `bash <<'EOF'`, `node - <<'EOF'` — that calls `forge`
itself is read as data too. Under an export that call inherits the id, so nothing is lost. Under a
prefix on another call it does not, and the grant is wrong by one hold, which is what the lost
name cost every heredoc command before. Put such a call in its own shell call.

## The tree the command will stand in

Where the text spells no name, the gate reads the tree instead — off the same text, since a `cd`
into a worktree moves the write and not the hook, whose own directory is the session's. Without
that, the two resolve two ids and every write after the first is held for the record the run itself
just made. A move joined by `;` may have failed; the reading taken is the one where it succeeded,
wrong only where it did not and costing the same round a lost name costs. Two `forge` calls in one
text standing in trees that answer differently name no id at all, and a text carrying an opener is
left unread whole, as the prefix form is: the writer inside one stands where this cannot follow.

## The other reader, and the other question

The stop gate asks something else: not *which run do the writes in this command belong to*, but
*which run did this turn's writes go under*. There is no one command and no one shell — a transcript
is a sequence of Bash calls — so the answer is the last name one of them granted. Both readers spell
the name and the value the same way, out of `plugin/src/resolve/session/granted-id.mjs`, so one
run's work is never credited to two holders; what they do not share is the reach rule above, which
has nothing to answer over a turn.

Each call is read alone, because a later shell cannot revoke what an earlier one already wrote
under: a call ending having taken the name back or assigned it nothing granted nothing, and one that
granted nothing leaves the turn's answer where the call before it left it. What counts is an
assignment and never a mention — `echo FORGE_SESSION_ID=X` hands the name to a command as a word and
no write goes under it, where the wide read above is asked another question and counts it. An
assignment is one at the head of a command, through any run of `export`, `env` and other assignment
words; the first word that is neither ends the run, which keeps `echo` and `grep` out.
Where a command begins is `spans`' answer, and each word is taken whole — so a quoted separator
starts nothing and this name inside another word's value is no assignment. A prefix assignment's own
name has to be unquoted, as a shell asks, and only its value is dequoted; a word handed to `export`
or `env` is that wrapper's argument and is dequoted whole. A subshell's is that subshell's. Where the turn granted no name the gate falls back to the
session's own key, which costs a lease the gate does not notice rather than one it names wrongly.

## Where a lost name shows

Nothing refuses, and `forge doctor` will not show it. Of the two readers only one is affected: the
CLI is handed `FORGE_SESSION_ID` in its own environment and goes on using it, which is
what doctor reports, while the hook has only the text. Where that text will run in a tree naming its
own run, the hook reads the same id from there and nothing is lost. Where it will not, the hook
falls back to the dispatching session's id, the write lands under the run's own name and the *gate*
credits the wave. The cost arrives one write later: the gate holds the next write to that issue and
quotes the run its own record back. An identical re-send clears it —
`forge hooks --how issue-read-first`.

Read with this: [`claim`](claim.md) for the lease the name is the key to, and
[`the-consult`](codex-the-consult.md) for the other place a run's identity is recorded.
