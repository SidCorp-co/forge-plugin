# `stats runs` — the rows the profile prints, and what each one is

What this verb reads, where its corpus comes from and what a wait is: [`stats.md`](stats.md).
Every row below is one this reading had to be taught, and the paragraph is the argument for it.

## The classifier, and the wrong rows it was built to avoid

The classifier is one table read top to bottom, and each correction below is a row a hand profile
got wrong:

- **A heredoc carries a document, not shell.** The criteria and plan files a run writes name
  `npm run check` in their text; read as commands, 423 of them counted as gate runs that never
  happened. The body is cut before the line is classified.
- **A word after the binary's name is not a verb.** Taken on trust, a heredoc mentioning the tool
  minted a class for whatever word came next, and a binary behind a shell expansion minted one for
  the expansion. What follows has to be a verb this CLI has, and the verb reached by path and by
  name is one row.
- **A bare space is not a command position.** Every row is anchored where a command actually
  starts — the beginning, or after one of the separators, with an assignment or a short list of
  leading words allowed in between; read as one, a space made an echoed reminder into a record and
  a search argument into a claim, each opening a phase the run had not reached.
- **A mention of a ship is not a ship.** A run waiting on one polls for the process by name; read
  as the invocation, that line moved every such run into its closing phase.
- **And an operator the shell spent as text opens no command either.** A separator inside a
  single-quoted argument, inside a comment or behind a backslash is a character of a word: 29 calls
  of this project's own corpus were filed under a class their text only quoted, a `pgrep` pattern
  among them counted as the gate it was watching for. Two spans go back to a shell and are left
  standing — a double quote, where a `$(…)` is live and this reading cannot tell it from the words
  beside it, and the body handed to a shell runner, taken off the word the quote opens so a body an
  interpolation cuts in two resumes. The character struck in is one no pattern reads rather than a
  space: with a space, `'/tmp/forge;close'` turned into a `forge close` nobody typed, and a reading
  that may only ever take a call away had invented one.

**The gate, the test, the ship and the call that ends a run's workspace are the project's own words,
where it has said them.** Those rows were literal alternations of the commands this repository runs,
applied to every project profiled: on one whose gate is spelled `make check` they read zero, the time
went into whatever class ran next, and the ship phase and the phase past it read zero runs apiece. A
project says what its own are under `stats.commands` in the `.forge.json` the profiled checkout resolves to — the
checkout the reading is about, never the one the caller is standing in — and a declaration
**replaces** the built-in pattern for its class rather than joining it, because a project that has
said what its gate is has said what its gate is. The command is matched as the text the project
typed, at a command position, and nothing is read out of its shape: guessing that a script whose
name merely looks like a gate's is one is how a profiler starts counting a project's unrelated
tooling. A project that declares nothing keeps the built-in patterns and reads exactly as it did.

**A class nothing was classed as, on a checkout that declared none, prints as unrecognised rather
than as nought** — the rule the outcome figures already keep, applied to the half that lacked it.
That covers the per-run line, the ships line whole, and the phase rows: a phase whose marker class
is unrecognised says so, and so does a phase reachable only past one, which would otherwise print
the most confident zero in the table. Beside them is the one line naming what would declare each
class (ISS-1586).

Three verbs earn a row per action, because their actions cost differently: a verdict against the other
records, a consult in the three shapes it comes in, and a knowledge write against a knowledge read.
The store is read where a run orients and written where it says what it learned, two phases at
opposite ends of a run, so one row over both put an opening read into the figure for what the run
took away from it. The whole-set read that earns a review, the
consult a commit gate asks for over what a commit stages, and a recheck are one verb and three
costs, and folding them left the review's own read indistinguishable from the build's. Which of the
three a call was is read off the flag its command line carries. A `codex.send` setting in a user's
configuration makes a bare consult a whole-set read too and no transcript records that, so on such a
run it is the whole-set read that is filed as an ordinary consult — and the review boundary it would
have opened is the one that goes missing. Writing a file earns a row per route — edit tool, write
tool, heredoc, whole-file redirect, `sed` — because one change carries a different number of characters
by each, and the `edits` line puts that number beside the route. The `ships` line counts a landing's
passes, resumes and rejected pushes: a landing that raced a sibling's paid the gate twice. Every
other verb is one row.

## The refusals listing, and the other errors beside it

A row is a line one of this plugin's own refusals was written in, and the row is the line that
**names the rule** — so the listing reads as which rules fire and how often. Four shapes, each read
off the source that writes it: a gate's `Hold —` or `Refused.` opener, the `How:` line every gate's
refusal ends with, a tracker refusal's `<name> refused:` with its reason inline or on the next line,
and a verb's own refusal sentence, which opens with a verb this CLI has. Where a body carries more
than one, the last is the row: a `forge` command prints its provenance banner before it refuses, and
keying on the body's first line filed 187 of those banners under a row that named nothing.

**A marked line beats a verb sentence wherever each of them sits**, which is a precedence rather
than an ordering, and it has a cost either way. A marked refusal quotes the lines it was refused
over, and those quotations read as verb sentences: taking the last of both filed 73 of the 76 runs
that met the issue-shape refusal under a line from inside that refusal's own body. The cost paid
instead is the mirror case — a chained call that printed a marked line it was only reading, then met
a verb-sentence refusal of its own, is filed under the line it was reading.

Two of the four are read off the call's exit code as well. The verb sentence, because a line an
*answering* call printed looks exactly like one — `project id: …` opens with a verb too. And the
`How:` line, which counts only where it is the body's **last** line on a call that failed: a gate's
denial is the whole result the harness returns and ends there, while a document or a test's output
quoting one goes on printing past it, which is fourteen of the 516 bodies carrying that line.

The two openers and `<name> refused:` count however the call exited. A run that pipes a refusal
through `tail`, or ends the line with `; echo EXIT=$?`, met it just the same and the shell answered
0 for it; on this corpus that is 411 refusals of 813.

**The reading is of shape and never of provenance.** A body that merely quotes a refusal it did not
meet is one this listing cannot tell from one that met it; seven of the 813 above are that. And a
refusal written in none of the four shapes — the hook harness running out of time, a missing
endpoint, a missing project slug — is counted with the other errors rather than dropped.

Those other errors are one line, broken down by the class of the call that exited non-zero. Read as
refusals they were six of the listing's top ten: a test's failure line, a `grep` that matched
nothing, a `-h` read whose help text carries the word, an issue body that does.

## Compactions and API errors: a run's condition, not its cost

Two more records sit in the transcript the corpus reader already walks for its calls, and neither
is a call at all. `isCompactSummary` on a user record is the host losing what a run knew — the
context ceiling reached, its history rewritten into a summary — and the run carrying on from there.
`isApiErrorMessage` on an assistant record is a request that came back as an error rather than an
answer, always under the marker model the token tally already drops, so it was never a measured
request either. Measured against this project's own corpus the week this was filed: compactions fell
from 127 across 58 of 272 runs to 30 across 16 of 280 — one run in five hitting the ceiling, down to
one in eighteen — while API errors rose, on three independent projects at once.

**Neither is a call this plugin issued, refused, or answered for**, so neither belongs beside the
refusals listing or the other-errors line above: a `grep` that matched nothing is a call this reading
classified and found wanting, where an API error record carries no `tool_use` block for this reader
to have opened in the first place. They are counted apart, off the one pass the rest of the profile
is taken in, and the network is asked nothing either way.

**Compactions print as two counts and not one**, because a run that lost its history three times is
one run that ran out of room, not three runs that did. The runs figure and the compaction figure move
independently — a corpus where every compacting run compacted twice would halve the first without
moving the second at all — and folding them into one number would hide exactly that.

**Neither figure is folded into `forge stats eval`'s angle set.** Every shipped angle is a price —
`better: -1` over what a run *spent* — and a compaction is not spending: it is a run that carried on
from a worse position than the one it had, which is a fact about the run's own *condition*. That
makes it the first figure this reading holds that is not simply a smaller cost, but it is still not a
quality measure — it does not meet the six conditions [stats — the angles](stats-the-angles.md)
holds a quality figure to, foremost among them that a quality reading tests an artefact's outcome
against criteria fixed independently of the run, and a compaction count tests neither. So it prints
beside the cost figures, with no disposition, no floor and no verdict of its own, exactly as the
angle topic's closed set stays closed around it.

**A figure whose population is empty is unavailable, and is not the zero a clean window would also
print.** Where the window holds no run there is nothing to have compacted and no request to have
failed, which is a different sentence from "nothing went wrong" — so both figures print as
unavailable there, the same rule the outcome figures and the token medians already keep.
