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

Two more rows sit beside these and are neither: a compaction and an API error are a run's own
condition rather than a call this plugin made, refused, or judged — [stats — the
condition](stats-the-condition.md).
