# The stated budget

The tracker states what a call is allowed to spend, and a caller that reads only the refusal learns
it once per refusal. `plugin/src/tracker/rest.mjs` makes the requests; `plugin/src/wire/budget.mjs`
holds what their answers said about the allowance.

**Rate limits.** The server states its own wait. Failing instead of honouring it turns a two-second
pause into a lost run; honouring it without a ceiling turns a server saying 3600 into an hour of
sleep. Whether a call may be sent again at all is the row's own declaration and never a reading of
the payload: an action that mutated outside its data field was a write the payload reading called a
read.

**The budget is read while calls are still succeeding, not out of the refusal that ends them.** The
tracker states four headers on every answer — the window's size, what is left of it, when it resets
and the scope it belongs to — and a caller reading only `retry-after` learns the window once per
refusal: a sweep of this backlog discovered the same per-minute window 108 separate times.
`plugin/src/wire/budget.mjs` holds the reading per scope, because the bucket is the server's and one
route's spending is another's; a route is filed under the scope its own answers name. A call the
last reading leaves no room for waits for the stated reset instead of being sent to be refused.

Three things that reading will not do. It derives no window width: the stated reset is a deadline,
so an answer ten seconds before one would teach a ten-second window, and two resets a quiet process
saw are two deadlines rather than two adjacent windows. It computes no rollover either — past a
stated reset the call simply goes, and its answer opens the next window, which admits what a caller
already has in flight and no more than the same moment admits without any of this. And it never
accuses a sibling of spending the bucket on doubtful arithmetic: what is subtracted from the server's
count is this process's own calls in the window *and* those outstanding when it adopted the window,
since a call reserved before a reset may be charged after it. The sentence says *at least*.

**What a window lends is not what its reading says.** The answer that opens a window was written
before the calls still out of this process were counted, so lending the stated remainder to a caller
with eleven in flight is how sixty becomes seventy-one. What is out is deducted, and it is counted
live — every attempt retires its own reservation however it ended — because a count held against
what was *sent* never comes down, and an outage would become a debt every later window paid. The
conservative counters under the sharing sentence are the other kind on purpose: there, never coming
down only ever claims less for somebody else.

Where the four headers are absent, nothing is held and nothing is paced. A tracker that states no
budget is one this cannot pace against, and it is sent what it was sent before.
