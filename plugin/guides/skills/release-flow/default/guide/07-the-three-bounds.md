## Three bounds, and none of them is time remaining

A run stops when any one of these is crossed. They are read, not felt, and the account says which one
ended the attempt.

- **Total elapsed since the code reached the production branch.** The clock starts where the change
  became production's problem, not where you started work on it. A release that has been in flight
  too long is a release people are already asking about.
- **Time since the last evidence of progress.** Evidence means a reading that moved: an identity that
  changed, a health check that flipped, a log line that appeared. Attempts made are not progress, and
  neither is a hypothesis refined without an observation behind it.
- **Regression.** Health that passed before an attempt and fails after it. This one stops the run on
  the spot, whatever the other two clocks say: the world is now worse than it was, and the next
  action is a person's.

**Time remaining is never on its own a reason to continue.** It is the reasoning that turns a run
with no leading hypothesis into six more attempts, and it is what the first two bounds are written
against. Having time left permits continuing only where there is also something to try that a reading
would distinguish; where there is not, the run hands over with time to spare and says so.
