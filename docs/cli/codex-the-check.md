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
