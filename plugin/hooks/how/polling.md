# polling — a wait that asks again is a turn spent asking

Why: over three days, poll-shaped calls cost one session 143 minutes and another 1,344, every
wake-up being a model turn; 46 of them ran past the shell tool's ten-minute cap and ended with the
state they were waiting on lost.

Two routes wait without asking. In the foreground, give the call its own timeout, up to that
ten-minute cap, and the work either finishes or the cap is the answer. In the background, start it
and let the harness's completion notice be the wake-up: it arrives whenever the work ends, so
nothing is spent waiting and no cap applies. Which one to take is the expected duration — under the
cap, the foreground; over it, or unknown, the background.

Re-send the command with the wait taken off. A single `sleep` is untouched, so a pause before one
call is still a pause.

If the wait genuinely has no completion to notice — nothing exits, nothing writes — say so to the
user rather than shortening the interval until the refusal misses.

Not judged: how long the work takes, a `for` bounded by a count, and a wait inside a body handed to
another interpreter. Turning this off with `--off bash-guard` takes that gate's other refusals with
it, since the switch is the gate's and not the topic's.
