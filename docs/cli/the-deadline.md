# The deadline — what bounds an attempt in time, where the ladder bounds their number

`plugin/src/tracker/rest.mjs` sends every request this CLI makes, and the ladder beside it —
[one transport](one-transport.md) — counts how often a request that answers *badly* is sent again. It
says nothing about one that answers not at all.

## Why counting attempts is not a bound

*What answers a tracker that accepts the connection and then says nothing?*

Nothing, for as long as the session lasts. The promise stays pending, the verb prints no line, and a
hook holds a session's tool call open while it waits — worse than a refusal, because the session
cannot tell a slow tracker from a lost network from a call that already landed. So every request
carries a deadline, and running out is refused like any other failure: the method, the path, the
number of seconds and whose number it was.

**Two numbers, two owners.** How many attempts there are and how long the waits between them run is
the ladder's, `retrySeconds` setting the first wait. How long one attempt may take is `waitSeconds`,
read from the same account config, and a caller inside somebody else's clock names its own instead —
which is how a review whose whole budget is minutes does not spend them waiting. The refusal says
which of the two ran out, because a run told to raise a configured number when it was its own that
expired is told to change the wrong thing.

**Zero is a deadline that runs out at once, not the absence of one.** Reading the number for
truthiness is what made zero unusable, and a suite proving the refusal needs a number that fires. It
is the same shape `retrySeconds: 0` already has for the ladder: the value a project sets to prove the
message rather than the wait.

**A finite deadline can abort a request that would have finished, and that is the trade rather than a
defect.** The one request whose duration scales with what it carries is the upload, and no cap on it
is this CLI's. What stands against it is a refusal naming the number and the key, so the one line
that raises it is in front of whoever met it — rather than a design where the sending of bytes is
unbounded and only the wait for an answer is, which would be a second mechanism and is not one this
transport has.

## An attempt whose body ran out is a dropped attempt

*The headers said 200 and the body never came. Which of those is the attempt?*

The body. Headers describe a request the server answered; a body that never arrived describes the
connection dying before the answer got here, and reading the first as the verdict makes a 200 whose
body stalled a success — which is what it was read as until ISS-828, so a read the ladder would have
completed was refused instead. The status the ladder is asked about is therefore nothing at all
wherever something dropped: a read goes round the ladder as its row allows, a write is never sent
again and reads the ambiguous refusal, and no status buys an exception from that, a 429's included.

**What the rule costs is stated rather than exempted.** A 429 whose body stalls waits the ladder's
own number instead of the one the server sent, and a read whose 4xx body stalls is sent again up to
the ladder's four rather than once. Both are bounded by the ladder, neither can write twice, and
either would have cost an exception in the middle of a one-sentence rule.
