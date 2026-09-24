# SRS §17 — Non-functional requirements

← [Index](./README.md) · [§16 FR-14 The requirements tree](./fr-14-requirements-tree.md) · Next: [§18 Data](./18-data.md)

## What holds across every requirement

*Which qualities are not any one capability's?*

Each of these was fixed by a measurement or by a failure, and the reason is beside the clause. A
figure that was measured once is not restated elsewhere.

### NFR-01 — A gate costs the startup of one process per event

Rev: 1 · Enforces: BR-08

The gates share one process per event because a registration per gate paid a language runtime's
startup for each of them on every tool call, with several reading the same session history apart.

- **AC-17-1-1** · Rev: 1 · Proof: plugin/test/hooks/gate.test.mjs "before a call, the first gate to refuse is the answer and the rest are not asked"
  WHEN gates run for one event THEN they SHALL run in one process and SHALL share the reads they all
  need.

### NFR-02 — A gate fails open

Rev: 1 · Enforces: BR-13

The failure in this direction is undetectable — nothing looks more like a clean session than one
where no gate ran — so the switch errs toward running. Which way it errs and why is `docs/HOOKS.md`.

- **AC-17-2-1** · Rev: 1 · Proof: plugin/test/hooks/hook-switch.test.mjs "a config that will not parse runs every gate"
  IF the switch cannot be read THEN every gate SHALL run.

### NFR-03 — A refusal is small, and its document is capped

Rev: 1 · Enforces: BR-01

A refusal lands in a context window on every tool call, so it carries what was refused, the rule,
one action and where to read more, and nothing else. `docs/HOOKS.md` has the before and after of the
one message that was cut hardest, and what survived the cut.

- **AC-17-3-1** · Rev: 1 · Proof: plugin/test/hooks/hook-how.test.mjs "each document opens with its claim, argues briefly, and points nowhere unreachable"
  WHEN a gate's document is written THEN its argument SHALL be within the cap and the document
  within its own, and the rest SHALL be instruction.

### NFR-04 — Help is an answer

Rev: 1 · Enforces: BR-01, BR-14

Asking what to type is not a failure and not an argument: on the error stream a pipe printed
nothing and every caller learned to redirect first, and three verbs resolved project scope before
parsing anything, so the one command that says what to type was the one a caller could not run.

- **AC-17-4-1** · Rev: 1 · Proof: plugin/test/cli/cli-help.test.mjs "help is an answer, not a failure"
  WHEN help is asked for THEN it SHALL be answered on the output stream, before the verb parses
  anything, and SHALL never be read as the verb's own argument.
- **AC-17-4-2** · Rev: 1 · Proof: plugin/test/cli/cli-help.test.mjs "the write-time rules wait to be asked for"
  WHEN the write-time rules are not asked for THEN they SHALL not be printed, since they were paid
  for in every transcript that only asked what to type.

A text a run reads twice inside one session answered nothing on the first pass: a router that lists
many shapes moved what most callers need behind what most do not, so a bounded read never reached it,
or moved what a caller reaches from its own dedicated help back in front of it, buying that caller a
second look at both texts (ISS-2028).

- **AC-17-4-3** · Rev: 1 · Proof: plugin/test/tracker/filing/new-flags.test.mjs "the kinds table a filing needs comes before the goals list most filings never read"
  WHEN a caller reads `forge new -h` THEN the table of kinds and the sections each owes SHALL print
  before the paragraph a filing's `Serves:` line is read against, since every filing reads the table
  and most name no goal.
- **AC-17-4-4** · Rev: 1 · Proof: plugin/test/flow/record/record-rows.test.mjs "criteria and plan are the last two kinds forge record -h lists"
  WHEN a caller reads `forge record -h` THEN `criteria` and `plan` — the two kinds a caller reaches
  from their own dedicated help rather than from this list — SHALL be its last two rows.

A value is refused for its form as often as for its absence, and the two are not told alike: a set
of values a field declares is printed beside the flag, while a form a predicate holds the value to
reached the caller only in the refusal, after the write it refused had been composed (ISS-457).

- **AC-17-4-5** · Rev: 1 · Proof: plugin/test/flow/record/record-rows.test.mjs "a field its own rule refuses is told in its kind's help what it takes, and one with none is told nothing"
  WHERE a payload kind refuses a field's value for the form that value takes, that kind's own help
  SHALL print the form in the words the refusal states it, so the grammar is read before the write
  is composed rather than out of the write being turned back.

### NFR-05 — A projection carries no byte that says nothing

Rev: 1 · Enforces: BR-14

The identifier column of a browse was a fifth of its bytes and bought nothing; a null field and an
empty collection were a tenth of an issue's bytes and said only that the field exists. Absence
means absence.

- **AC-17-5-1** · Rev: 1 · Proof: plugin/test/cli/commands.test.mjs "an attachment collapses to the url that fetches it"
  WHEN a record is projected THEN a field with nothing in it SHALL be left out, and an attachment
  SHALL collapse to the reference that fetches it.

### NFR-06 — Nothing about a run is remembered outside the record

Rev: 1 · Enforces: BR-02, BR-05

A run that dies has to be resumable by another, so the tracker holds the process and the pushed
branch holds the code (C-10). A commit is pushed as it is made.

- **AC-17-6-1** · Rev: 1 · Proof: plugin/test/flow/lease.test.mjs "a reclaim reads out the line it took over and the line it took on, and tells them apart"
  WHEN a run resumes an issue THEN everything it needs SHALL be readable from the record.

### NFR-07 — A write is idempotent

Rev: 1 · Enforces: BR-02, BR-03

Which writes are idempotent, and how each resolves a repeat, is the contract's "The record is the
checkpoint" — so a retry after a dropped connection is safe and a report does not double-count.

- **AC-17-7-1** · Rev: 1 · Proof: none yet — ISS-252
  WHEN the same payload is written twice THEN the record SHALL hold it once.

### NFR-08 — A credential never reaches a file that travels

Rev: 1 · Enforces: BR-17

The credential lives in the account's directory at owner-only permissions, and anything written to
a log is masked first — a value named as a credential is masked whatever it looks like, because the
shape of a secret is not reliable and the name is.

- **AC-17-8-1** · Rev: 1 · Proof: plugin/test/hooks/scrub.test.mjs "a credential is masked before it is written down"
  WHEN a line is logged THEN any credential in it SHALL be masked before the line is written.

### NFR-09 — A project that decided nothing hears nothing

Rev: 1 · Enforces: BR-07

Silence is an opt-out and not a misconfiguration. A repository with no linter, no gate and no
settings of its own gets no findings from this product about what good code is.

- **AC-17-9-1** · Rev: 1 · Proof: plugin/test/gates/code-quality.test.mjs "a project that configured no linter hears nothing, and the same file speaks once it configures one"
  IF the project configures nothing THEN the product SHALL say nothing about its code.

### NFR-10 — The half no check reaches is verified by reading it

Rev: 1 · Enforces: BR-16

BR-16 is the rule, and this clause only records that no requirement in this tree promises
otherwise: an answer's quality is a person's finding, never a gate's.

- **AC-17-10-1** · Rev: 1 · Proof: tools/diff-python.mjs
  WHEN the output for a known input changes THEN the change SHALL be shown to a person rather than
  judged by a check.

### NFR-11 — A wait costs no turn

Rev: 3 · Enforces: BR-18

Asking again is what a wait costs: each wake-up spends a turn on a question one call could have put
once, and the routes that spend none are the ones whose own call carries the answer back.
`plugin/hooks/how/polling.md` holds the figures that settled this, the routes themselves, and what
the rule leaves unjudged.

A turn that stops instead of taking one of those routes spends the same cost a worse way: nothing
resumes it but a person watching from outside. What it left running is read back at the stop and
answered the same way asking again is. A wait needs no directory to name, so the process keeps the
one the session already stood in and every run on that host shares it: inside a worktree of the
turn's own, anything standing there is that turn's; outside one, what is running a command one of
that turn's own calls carries, as the words it typed, is, and nothing else is. Words as well as
text: a turn that quotes another run's whole command line as one argument has named it, not run it.

- **AC-17-11-1** · Rev: 1 · Proof: plugin/test/gates/bash-guard.test.mjs "a wait that polls is refused, and a pause on its own is not"
  IF a pause stands inside a wait for other work THEN the product SHALL refuse the command and SHALL
  name the routes that wait without asking.
- **AC-17-11-2** · Rev: 1 · Proof: plugin/test/gates/bash-guard.test.mjs "the same read of a log typed again is refused, and another question of it is not"
  WHEN a read of a log is repeated with nothing done between it and the read before THEN the product
  SHALL refuse it once, and a different question of the same log SHALL pass.
- **AC-17-11-3** · Rev: 1 · Proof: plugin/test/gates/turn/stop-check.test.mjs "a process still standing in a worktree the turn left refuses the stop, named"
  WHEN a turn ends and a process that turn began still stands, by its working directory, inside the
  worktree that turn stood in THEN the product SHALL refuse the stop and SHALL name that process's
  id in the refusal.
- **AC-17-11-4** · Rev: 2 · Proof: plugin/test/flow/lease/standing-in.test.mjs "a process standing in the tree by its cwd is found, whatever it is running"
  WHEN a process standing in a worktree of the turn's own is read for this rule THEN the product
  SHALL judge it by its working directory alone and SHALL NOT judge it by what command it is
  running.
- **AC-17-11-5** · Rev: 2 · Proof: plugin/test/gates/turn/stop-check.test.mjs "a process standing outside the worktree the turn left does not refuse the stop"
  IF a process stands outside the worktree the turn stood in and runs no command a call of that
  turn made THEN the product SHALL NOT refuse the stop on that process's account.
- **AC-17-11-6** · Rev: 1 · Proof: plugin/test/flow/lease/standing-in.test.mjs "since narrows to what began at or after that moment"
  IF a process began before the turn's own first moment THEN the product SHALL NOT read it as
  standing there on that turn's account.
- **AC-17-11-7** · Rev: 1 · Proof: plugin/test/gates/turn/stop-check.test.mjs "a process that has already ended does not refuse the stop"
  IF a process named by an earlier reading is no longer in the process table THEN the product SHALL
  NOT refuse the stop on that process's account.
- **AC-17-11-8** · Rev: 1 · Proof: plugin/test/gates/turn/stop-check.test.mjs "the same live process does not refuse the stop a second time this turn"
  WHERE a live process already refused this turn's stop once THEN the product SHALL let a second
  stop of that same turn end without refusing it again.
- **AC-17-11-9** · Rev: 2 · Proof: plugin/test/gates/turn/stop-check.test.mjs "a wait this turn started with no cd refuses the stop, outside any worktree"
  WHEN a turn ends and a process still stands, in a directory that is no worktree of that turn's,
  whose command line one of that turn's calls carries whole and carries as the words it typed, THEN
  the product SHALL refuse the stop and SHALL name that process's id in the refusal.
- **AC-17-11-10** · Rev: 1 · Proof: plugin/test/gates/turn/stop-check.test.mjs "a process another run left standing where this turn stood does not refuse the stop"
  IF a process stands outside every worktree that turn stood in, and neither its command line nor
  any call that turn made contains the other once quoting is dropped and the shell's own separators
  are read as blanks, THEN the product SHALL NOT refuse the stop on that process's account.
- **AC-17-11-11** · Rev: 1 · Proof: plugin/test/flow/lease/started-here.test.mjs "a process running a command this turn ran is found wherever it stands"
  WHERE a process is matched to a turn by a command that turn ran, the product SHALL find it
  wherever that process stands.
- **AC-17-11-12** · Rev: 1 · Proof: plugin/test/flow/lease/started-here.test.mjs "a command too short to identify a process matches none"
  IF a command a turn ran is too short to identify a process THEN the product SHALL match no
  process against it.
- **AC-17-11-13** · Rev: 1 · Proof: plugin/test/gates/turn/stop-check.test.mjs "the same command another run began before this turn's own call does not refuse the stop"
  IF two turns ran the same command and the process still standing began outside the call the turn
  that is ending made THEN the product SHALL NOT refuse that turn's stop on its account.
- **AC-17-11-14** · Rev: 1 · Proof: plugin/test/gates/turn/stop-check.test.mjs "the same command another run began after this turn's call came back does not refuse the stop"
  IF a turn's own call has come back and another run begins the same command after that call's
  window has closed THEN the product SHALL NOT refuse that turn's stop on what it left standing.
- **AC-17-11-15** · Rev: 1 · Proof: plugin/test/flow/lease/started-here.test.mjs "a command whose path only begins another run's is not read as the same job"
  IF one command's path only begins another's THEN the product SHALL NOT read the two as one job.
- **AC-17-11-16** · Rev: 1 · Proof: plugin/test/flow/lease/started-here.test.mjs "a process unobserved until long after its window closed is still placed inside it"
  WHERE a process is first read long after the window it began in has closed, the product SHALL
  place it at the moment it began rather than at the moment it was read.
- **AC-17-11-17** · Rev: 1 · Proof: plugin/test/flow/lease/started-here.test.mjs "a command line the turn only quoted as an argument does not make its process this turn's"
  IF a process carries more than one argument and they stand nowhere in a turn's calls but inside a
  single shell word of one THEN the product SHALL NOT read that process as one the turn started.

### NFR-12 — A ceiling drawn from one sample is redrawn from the population

Rev: 1 · Enforces: BR-12

The gate's own drift trigger fixed a whole run's ceiling at 1.25x a single sample measured on one
day. The population it stood for moved: read against this checkout's own ledger, the sample sat
below its population's 25th percentile and the fixed ceiling was crossed by most ordinary runs, so
crossing it stopped meaning anything (ISS-1142). A figure that is meant to say "unusual" has to be
drawn from what usual currently is, which is the population the ledger already keeps, and not from
whatever the population looked like the day someone last measured it.

- **AC-17-12-1** · Rev: 1 · Proof: plugin/test/tools/gates/timing.test.mjs "the ceiling a whole run is judged against is a percentile of the ledger's own same-table population, not a fixed sample"
  WHEN a whole run is judged against a ceiling THEN that ceiling SHALL be a percentile of the whole
  runs the ledger already holds at the same table size, rather than a fixed constant.
- **AC-17-12-2** · Rev: 1 · Proof: plugin/test/tools/gates/timing.test.mjs "fewer prior whole runs than the population floor leaves the ceiling unspoken"
  IF fewer than the declared minimum of same-table whole runs stand in the ledger before the one
  being judged THEN nothing SHALL be said about a ceiling for it.
- **AC-17-12-3** · Rev: 1 · Proof: plugin/test/tools/gates/timing.test.mjs "a spoken ceiling names its percentile, its population and the date it was drawn through"
  WHEN a run is said to be over the ceiling THEN the line SHALL name the percentile taken, the
  count of runs it was taken over and the date of the newest of them, so the figure can be
  recomputed rather than trusted.
- **AC-17-12-4** · Rev: 1 · Proof: plugin/test/tools/gates/timing.test.mjs "a population whose ordinary run sits under the ceiling is silent, and the same population shifted up makes an ordinary run of it speak"
  WHERE a synthetic ledger's population has an ordinary run under the ceiling drawn from it, that
  run SHALL be silent; WHERE the same population is shifted up, an ordinary run of the shifted
  population judged against the ceiling drawn from the population before it SHALL be said to be
  over.

### NFR-13 — The gate's instrument answers as the runtime it stands in for

Rev: 1 · Enforces: BR-12

The gate loads a read audit into every process of a step, so that what each test file read is known,
and it does so by standing a module of its own where this repository imports a file-system builtin.
One case replaced a builtin's function and asked the runtime to bring its named exports in step,
which the runtime does and the audit's stand-in did not: the case was red in every gate and green in
every run of it alone, and the re-run the gate uses to tell a case its neighbours broke from one the
tree broke ran without the audit, so it read the instrument's failure as company's (ISS-2419). An
instrument that changes what it measures makes the red it reports its own, and the re-run that
judges a red stands where that red stood.

- **AC-17-13-1** · Rev: 1 · Proof: plugin/test/tools/gates/reads/synced.test.mjs "a function replaced on a builtin's default object and synced reaches a by-name importer under the audit"
  WHEN a process under the gate's read audit replaces a file-system function on the builtin's
  default object and asks the runtime to bring the builtin's named exports in step THEN a module of
  this repository that imported that function by name SHALL call the replacement, as it does
  without the audit.
- **AC-17-13-2** · Rev: 1 · Proof: plugin/test/tools/gates/attribution.test.mjs "a case red under the read audit alone reproduces alone, its re-run recording inside its own room"
  WHEN the gate re-runs a failing case alone THEN the re-run SHALL run under the read audit its
  step ran under, recording into the re-run's own room.
