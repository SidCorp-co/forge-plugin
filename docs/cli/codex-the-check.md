# codex — the check

The reviewer runs nothing for itself. What a finding coming back has to carry:
[the finding](codex-the-finding.md). What a round buys: [the round](codex-the-round.md).

**No local agent.** The first engine spawned a `claude` session with `--allowedTools Read Grep Glob`;
that flag auto-approves and does not confine, so the child inherited this machine's skills, answered a
review prompt by running a multi-agent review skill, and had to be killed by pid after eleven minutes.
The tools a reviewer is handed read the checkouts under review and nothing else.

**And no check either.** For a while the one exception was a command the checkout named, run once per
consult under a clock, because "the tests pass" was the claim every review said it could not verify.
Two things ended it. The landing gates every change on the base as it is, so a suite a reviewer ran
measured nothing the landing would not; and it was the one call that could outlive the consult that
made it — 26 of the 78 consults here that ran or cut a check returned after the caller's call had
already ended, against 3 of the 5,935 that ran none (ISS-2108). Only the landing runs the whole-tree
gate (ISS-3184), so the reviewer is offered no command at all.

**What the key still does.** `codex.check` names the checks a consult tells the reviewer this
project runs, where the caller passes no `--checks`, so a finding one of them already refuses is
left out rather than spent a round on. Nothing runs it, so `forge doctor` reports a `codex.checkMs`
still set as a miss: a clock for a check that never starts. Log rows written before this
still carry `check` and `checkCommand`, and `forge codex log` prints them as the history they are.
