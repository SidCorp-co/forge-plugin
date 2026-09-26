# `stats runs` — the refusals a window met, and the other errors beside them

What this verb reads and what a wait is: [`stats.md`](stats.md). The classifier the rows below are
keyed by, and the wrong rows it was built to avoid: [stats — the rows](stats-rows.md).

A row is a line one of this plugin's own refusals was written in, and the row is the line that
**names the rule** — so the listing reads as which rules fire and how often. Four shapes, each read
off the source that writes it: a gate's `Hold —` or `Refused —` opener (`Refused.` in older logs),
the `How:` line every gate's refusal ends with, a tracker refusal's `<name> refused:` with its reason
inline or on the next line, and a verb's own refusal sentence, which opens with a verb this CLI has.
A gate's refusal leads with its route, so for a gate the row is the route line, which is as much
one rule's as the shape line was; a window spanning the change reads one rule under two rows here. Where a body carries more
than one, the last is the row: a `forge` command prints its provenance banner before it refuses, and
keying on the body's first line filed 187 of those banners under a row that named nothing.

**The harness report follows a cause, not a line.** A refusal's wording is the thing a gate
changes most often, so a report keyed on it reads every rewording as a fix and a new cause from
zero. There a refusal is keyed on the gate that wrote it, read off its `How:` line or the page a
repeat names, beside the name the gate gave that refusal: two wordings under one name are one cause,
because the gate said so. A gate that names nothing keeps one cause per wording, since one topic can
cover several different refusals, and a refusal no gate wrote keeps its line. What the gate did not
name may still be a reworded cause, so a row whose gate refused after its fix under any key the row
does not carry is not read as fixed.

**A marked line beats a verb sentence wherever each of them sits**, which is a precedence rather
than an ordering, and it has a cost either way. A marked refusal quotes the lines it was refused
over, and those quotations read as verb sentences: taking the last of both filed 73 of the 76 runs
that met the issue-shape refusal under a line from inside that refusal's own body. The cost paid
instead is the mirror case — a chained call that printed a marked line it was only reading, then met
a verb-sentence refusal of its own, is filed under the line it was reading.

Two of the four are read off the call's exit code as well. The verb sentence, because a line an
*answering* call printed looks exactly like one — `project id: …` opens with a verb too. And the
`How:` line, which counts only where it is the **last line the gate wrote** on a call that failed: a
gate's denial is the whole result the harness returns and ends there, while a document or a test's
output quoting one goes on printing past it, which is fourteen of the 516 bodies carrying that line.
The harness appends its own lines after it — that nothing in a several-command call ran, and once a
session where to file a refusal thought wrong — and those are read past, from the one module the
harness prints them from. Read as last lines, they turned every full gate refusal into an error.

**A repeat is a refusal too.** The shown ledger cuts a refusal the session has already seen to one
line, and that line is an opener of its own. It names the rule beside the route, so the report counts
a rule met again under the cause its full refusal is counted under; the row is the line, which names
the span refused, so a listing splits one rule by the commands that met it. Where the ledger cut it to
the lines not seen yet instead, no opener is left, and on a failed call the harness's sentence that
nothing in the command ran is what says a gate refused it. A one-command call cut that way carries
neither, and is counted with the errors: telling it apart would need the hook log joined to the
transcript. On 2026-09-24, before either was read, these were 56 of this project's 101 "other
errors".

The two openers and `<name> refused:` count however the call exited. A run that pipes a refusal
through `tail`, or ends the line with `; echo EXIT=$?`, met it just the same and the shell answered
0 for it; on this corpus that is 411 refusals of 813.

**The reading is of shape and never of provenance.** A body that merely quotes a refusal it did not
meet is one this listing cannot tell from one that met it; seven of the 813 above are that. And a
refusal written in none of the four shapes — the hook harness running out of time, a missing
endpoint, a missing project slug — is counted with the other errors rather than dropped.

Read as refusals, the other errors were six of the listing's top ten: a test's failure line, a `grep`
that matched nothing, a `-h` read whose help text carries the word, an issue body that does.

**An exit that is the command's answer is not an error.** `pgrep` finding nothing, `grep -q`
missing, a `timeout` ending the prescribed wait on a pid and `git diff --quiet` all answer with a
non-zero exit, and counted as errors they were most of the rows a reader was asked to act on. What
counts as one is a table, exit code to name to pattern, and a project that declares `stats.answers`
**replaces** the built-in table rather than joining it, as `stats.commands` replaces the built-in
commands. An exit is attributed to a command only where that command's status is the line's: the
last command, or one followed only by `&&`-joined `echo`, `true` or `:` of literal words. A `pgrep`
that found its process, then a test that failed, both answer 1, and nothing in the transcript says
which did — so that exit stays an error. Answers are counted in a row of their own and ranked
nowhere.

**An error is keyed on what failed:** its class, its exit code and the first line it printed, with
paths, hashes, issue keys and numbers taken out, so two failures of one class are two rows and one
failure met on two days is one row a later reading can follow. The host joins the two streams, so
that line is the first one printed and not always the error's own. The key's generation rides in
every reading and daily page as `errorRows`; one carrying none keyed on the class alone.

Two more rows sit beside these and are neither: a compaction and an API error are a run's own
condition rather than a call this plugin made, refused, or judged — [stats — the
condition](stats-the-condition.md).
