# codex — the check

The one thing in this design the reviewer runs for itself. What a finding coming back has to carry:
[the finding](codex-the-finding.md). What a round buys: [the round](codex-the-round.md).

**No local agent.** The first engine spawned a `claude` session with `--allowedTools Read Grep Glob`;
that flag auto-approves and does not confine, so the child inherited this machine's skills, answered a
review prompt by running a multi-agent review skill, and had to be killed by pid after eleven minutes.
The one exception since is `codex.check`: a command the *checkout* names in `.forge.json`, run at most
once per consult under a clock, exit code and tail returned. "The tests pass" was the claim every review
said it could not verify; a fixed command it did not choose is not a shell.

**And the clock is `codex.checkMs`, which is the half that had no surface.** A check stopped at it
costs the consult one of its few tool calls and hands back nothing, so the review that follows rules
by reading and says so — 33 of 1,119 consults over one week here, 13 of which closed saying they
could not check (ISS-1882). That clock defaults to 300000 milliseconds and the key that moves it is
the project's own, so the pair has to be legible together rather than one in a config and the other
in this module: `forge codex show` prints the command with the budget in force, `forge doctor` prints
it beside how often this machine's log recorded that same command stopped at or above it, and the
refusal the reviewer is handed names the clock and the key. None of those says the command will fail
— a check that returns early returns under any clock — and the budget a project wants is the one its
own recorded stops fall under, which is why the count is compared against the budget in force rather
than kept flat. Set it below the clock a whole consult runs under: past that, the consult's own
deadline expires first and the check takes the consult with it rather than coming back stopped.

**And the round now says which of five things became of the offer.** Whether a reviewer took it was
in no field at all: a row logged the tools called and the calls refused, and neither tells a consult
that was offered the command and let it alone from one taken where nothing names a command. Over
seven days on the machine that raised it, 1,778 of 1,814 answered consults called nothing and no
artifact of any of them said so, so a run that wanted to know read the reply for an absence — which
is a thing found after it has already acted on the review (ISS-1898). The row now carries `check`,
one of `ran`, `cut`, `failed`, `declined` and `none`, and `checkCommand` beside it, the command as
the scope froze it, so the row stays legible after the project has moved its own `codex.check` off
that value. The consult prints the word where it prints what the round cost, `forge codex log` puts
it on the line and the command under `--full`, and `none` is written rather than omitted because a
row carrying no field is one from before any of this and that is something else to know. Nothing
refuses on the word and no review is worth less for reading `declined`: the narrowing is deliberate
and a review by inspection is most of what a review is. What was wrong was that taking the offer and
leaving it alone read the same.

**And a red now hands back what failed, not only that something did.** The window is the end of the
output, and a suite puts its counts there and the line naming the case thousands of lines above:
`npm test` in this repository prints 1,047,557 characters over 4,195 top-level TAP subtests and 23
of them start inside the last 6,000, so one red in 182 could name its case and the rest reached the
reviewer as a number with nothing attached — two consults on ISS-1898 reported a failing test that
nobody, then or since, has been able to identify. What changed is what is selected into the window
rather than how big it is: a non-zero run's failures are read out of the output's own TAP and put
above the tail, each with whatever its diagnostic carried of where it failed, what kind of failure
it was, and the assertion itself. The stack and the operands stay out, every line spent there being
one the tail loses, and a run naming more failures than the bound says how many it did not name.
TAP because a format that announces itself is read exactly where a vocabulary of failure words is
guessed at, and node's runner writes TAP whenever its stdout is not a terminal, which under this
spawn it never is. Output that is not TAP is handed back exactly as it was before, the tail and
nothing else: this promises to read the failures a command named, never to invent them for one that
named none. Nor does it say whose the failure is — the red that raised this was most likely the
box refusing a fixture its temporary room, a thing this machine's own gate ledger has recorded 512
times, and the reason that could not be said at the time is that the sentence saying it was outside
the window (ISS-1901).

**The environment the check runs under is composed rather than inherited.** The spawn passed none at
all, so the command ran under whatever the consulting process happened to carry. It now runs under
this CLI's own copy of that environment with `FORGE_SESSION_ID` taken out: a check is the project's
command and not the run that consulted, and one reading that variable would write to the tracker as
a run it is not. `TMPDIR` is kept on purpose — a delegated run's scratch root is where a check's
leftovers belong, and it is what that run's own cleanup removes. What this does not claim is that
the inheritance was the defect: one arm of the same spawn, with that environment in place and under
three times the load of the occasion complained of, ran the same command green at 4,251 of 4,251.
