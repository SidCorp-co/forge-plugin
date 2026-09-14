# polling — a wait that asks again spends a turn

Why: poll-shaped waits cost one session 143 minutes in three days.

**A wait is a call that comes back to you.** A backgrounded loop comes back to nobody and is
refused too; a lone `sleep` is untouched. None resumes a stopped run:

- a verdict call the work provides, returning a decision;
- the work in the foreground under the call's own timeout, to the ten-minute cap;
- `timeout <s> tail --pid=<pid> -f /dev/null` for work already running: `0` is that pid gone, `124`
  the deadline, anything else the wait failing, `0` at once for a pid that never was;
- past the cap, `Monitor`: its printed line is the answer, nothing read after. Watch the producer
  too: an ending that writes nothing is silence; the log is one this run made before starting it.

      while kill -0 <pid> 2>/dev/null && ! grep -q verdict: run.log; do sleep 10; done
      grep -m1 verdict: run.log || echo no verdict

The completion notice is none of them: it is how a session works on while work runs.

A read typed again with nothing done between is that wait, refused once.

Not judged: a `for` bounded by a count, a wait handed to another interpreter or tool, a file not
named like a log, another session's same read. `--off bash-guard` takes that gate's others.
