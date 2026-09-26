# Coolify — the saved instance

How the surface an instance of the platform answers on a credential this machine holds is derived,
the three readings a faithful port of somebody else's client would have lost, and what a write
owes. What every call there runs inside is [the pin](coolify-the-pin.md).

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

The rule reaches what comes back as well. A platform quotes what it was sent — a refusal names the
value it refused, an acceptance can repeat it — and the structural rule cannot see that, because it
hides a field by its name and the field here is `message`. So the caller's own value is struck out
of everything printed, the way our credential always was, and which strings those are is read off
the masking rule rather than asked of a second one — the value as it was sent, and whatever the rule
hid inside it. A connection string keeps its host readable, so what was hidden is the password
alone, and that is what a platform refusing one names.

The rule reports what it struck as it strikes it, rather than being asked afterwards what it must
have hidden. Working that out from the masked copy is possible and wrong: a parser hands back a
normalized string — a scheme lowercased, a default port dropped — so the two no longer line up, and
the answer to a question about a secret would come back empty rather than wrong.

That striking happens to the parts and never to the finished line. A value holding a quote or a
newline is re-escaped on its way into a rendered line, and a replacement made afterwards is looking
for something that is no longer there — which would leave exactly the secrets that most need it.
