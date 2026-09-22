# Coolify

Why a deployment platform is reachable from the tracker's own CLI, and why the guard came before
the first command rather than after it.

## The pin is the feature

An unpinned call answers for every application the token's team owns, and a mistyped uuid restarts
somebody else's service. So `.coolify.json` — read by walking up from the working directory, and
read from nowhere else — is what every route-index command runs inside. A resource the pin does not
resolve to is turned away while the target is being worked out, not after the answer comes back,
and no flag, variable or configuration key turns that off. A read-only subset without it would be
worse than nothing, because it would read as safe.

The pin is not a credential and does not travel with one. It is a property of the checkout, which
is why a flag cannot retarget it: an argument that could would put the whole team back in reach
from any directory.

**A pin that resolves to nothing fails closed.** A mistyped project, or a named environment that no
longer exists, leaves the guard with an empty set to check against — and an empty set that means
"allow everything" is the whole team in reach by exactly the typo this was built for. The Python CLI
prints a warning there and carries on; here the call is refused and the refusal says which uuid to
check. It is the one state where being useless is the correct behaviour.

**A deployment is placed by an id its own application's listing may not carry.** A deployment names
its application by that application's id and by nothing else, and an instance may answer the
applications route with the uuid alone — which leaves the allow-set holding nothing, and every
deployment of the pinned project then reads as somebody else's and is counted as an ordinary
exclusion. So the id is resolved through the resources route for whatever the applications route
left unkeyed, and that route is read for the id only: which applications the pin admits stays the
applications route's answer, because the other spans services and databases no deployment names. An
application the pin admits that neither route can key refuses the call rather than shrinking the
set — a set that is merely smaller turns that one application's deployments into another project's,
which is the failure this whole guard exists to prevent wearing the face of it working.

## The surface is derived, not typed

`routes.json`, which ships beside this verb, is the index the external Python plugin generates from the
v4 OpenAPI document, copied byte for byte. It matters because each operation in it carries the list
of its own arguments that name a resource, and that list is what the guard reads. An operation
added to the served set therefore arrives already tied to the pin, rather than arriving and then
being tied to it by hand — which is the step somebody eventually forgets.

The groups that index leaves out — servers, private keys, teams, destinations, cloud tokens,
provisioning, the toggles — are out by a judgement somebody made, not by an oversight. Nothing here
reaches for them, and putting them back would be reversing that judgement without making one.

Only the deploy path is served: what is running, what it says, what it was built from, the routes
that redeploy or restart it, and the two that set one of its environment variables. The rest of the
index is carried but unreachable, which is what makes a later group a line rather than a design.

## Three readings a port loses by default

**A tag cannot be checked.** One operation takes a tag instead of a uuid, and a tag spans projects,
so the pin can say nothing about what it selects. The Python CLI prints a warning and sends the
request; here it is refused, because a warning that precedes the damage is the unscoped escape in a
different spelling.

**One word of a status is noise and the rest is signal.** The platform joins two readings with a
colon, and the second is a default rather than a measurement wherever nobody configured one. A port
that passes the pair through turns that default into a fault report, which is how a working service
gets restarted. Dropping the whole second reading would lose the measurements that are real, so only
the default word goes.

**Ninety fields is a leak, not a listing.** An application record carries about ninety fields, some
of them secrets, so one object answers with a curated set and names on stderr what it left out. A
name tells a reader what to ask for next; a count only tells them to guess.

## Two credentials that never meet

The instance and its token live under a key of this CLI's own configuration at 0600, beside the
other credentials that are this machine's rather than the tracker's. They resolve from that file
and from no environment variable, so there is no precedence rule to remember and nothing about
which one answered to report.

The token travels in a request header and is struck out of anything printed, including the text of
a failure whose body echoed it back. A gateway that repeats a request is otherwise how a credential
reaches a transcript, and from a transcript a review or a comment.

## A write says so

Why consent is a typed flag and not a prompt: a prompt answers itself where nothing is attached to
a terminal, which is every invocation an agent makes. The Python CLI's confirmation returns yes in
exactly that case, so porting it faithfully would have meant auto-confirming every destructive call
in precisely the situation the confirmation exists for.

Seeing the request without sending it is the other half of the same arrangement — and the guard's
own lookups still run while nothing is being sent, because suppressing them would switch the guard
off exactly when somebody is checking that it is on.

## Why a configuration value belongs to the deploy verb

A variable is read at boot, so setting one is part of getting a release to run rather than a thing
apart from it. The alternative was leaving it out, and the cost of that is measurable: a run whose
whole deliverable was one variable on one application could establish which variable, which value
and which application, and then had to hand a person a click — and could not even report whether
the value was already there, so it had to say unknown where it meant absent. A surface that can
read a configuration but not write one turns every configuration issue into two sessions.

**Create and update stay two operations.** The platform refuses a duplicate key and its refusal
names the other one, so a caller who reaches for the wrong half is told which to reach for by the
authority on the question. Folding them into one that picks would put a guess between the caller
and that answer, and would be a third operation the index does not declare — and the index being
the whole surface is what makes the guard automatic.

**A preview of a write is masked by the rule that masks an answer.** This is the only request this
verb sends with a password in it, so the command that shows a call before making it would otherwise
be the one command that prints a credential. The same rule decides each direction, which is why
there is one rule and not several: it pairs a variable's name with the value beside it, keeps the scheme,
user and host of a connection string readable, and drops what is secret. What goes on the wire is
never masked — a masked preview and a masked payload would look identical at the terminal and
differ entirely at the instance.

The same rule answers a third direction: a platform that refuses a write quotes back the value it
refused, so the words this prints on a failure are struck of the caller's own secret the way they
were always struck of ours. Which strings those are is read off the masking rule rather than asked
of a second one, so a value that would be hidden in a listing is hidden in a rejection.
