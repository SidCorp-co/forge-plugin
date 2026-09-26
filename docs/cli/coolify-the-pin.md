# Coolify — the pin

The scope a saved instance of the platform is reached under: why it exists at all, where it is
recorded, and the way out of a checkout that has none.

## The pin is the feature

An unpinned call answers for every application the token's team owns, and a mistyped uuid restarts
somebody else's service. So the scope a call is judged against can be neither the token's, which is
the whole team, nor an argument's, which any directory can pass: it is a project of the instance,
optionally narrowed to some of its environments, and the project's own configuration is the only
place it is read from. A resource the pin does not resolve to is turned away while the target is
being worked out, not after the answer comes back, and no flag, variable or configuration key turns
that off. A read-only subset without it would be worse than nothing, because it would read as safe.

The pin is not a credential and does not travel with one, and it is not an argument: one that a flag
could retarget would put the whole team back in reach from any directory. It is the project's, kept
on this machine and shared by every worktree of the checkout. The Python CLI's `.coolify.json` is
not read, not even as a fallback — one source, and no precedence rule for a reader to remember. The
cost, accepted when that was decided: the Python CLI still reads its own file, so the two can be
pointed at different projects.

## Reaching a pin

A saved credential and no pin is a state only a writer can leave: a refusal asking for a project
uuid is no way out when the one listing that shows one is refused for want of the pin it would
produce. So the pin has a writer of its own, `forge coolify pin`, and it is the command every
refusal about a pin names, because it reads the instance and nothing pinned — it answers in exactly
the states those refusals fire in, a pin that resolves to nothing among them.

**An application's name is the short route, and it settles two fields rather than one.** An
application names the environment it sits in, and following that environment up to its project
pins the environment the deployment is actually in; a project-only pin leaves the environment open
and the checkout reaching more than it deploys.

**A name is matched whole or by uuid, never in part.** Names are not unique on this platform, so two
that match are refused with the uuids that tell them apart; and a part of a name matching one
project is a guess the guard would then enforce against the wrong one.

**Named forms only.** The Python CLI guesses from the directory's name and offers a picker, both
behind a terminal check that every call an agent makes fails. Here a call with nothing to go on is
refused with the two forms and the projects the token can see, which is the listing a cold checkout
lacked.

**A pin already recorded is replaced only when asked**, and shown beside the one that would replace
it — the same consent every write of this verb takes, for the same reason.

The rest of the guard is unchanged by having a writer: the project listing still refuses without a
pin, because the pin's own command is where a listing that produces one lives.

**A pin that resolves to nothing fails closed.** A mistyped project, or a named environment that no
longer exists, leaves the guard with an empty set to check against — and an empty set that means
"allow everything" is the whole team in reach by exactly the typo this was built for. The Python CLI
prints a warning there and carries on; here the call is refused and the refusal says which uuid to
check and how to re-pin. A project uuid the instance does not know at all answers its environments
route with a 404, which is read as a project with no environments so that it reaches this refusal
rather than a generic one that names no way out. It is the one state where being useless is the
correct behaviour.

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
