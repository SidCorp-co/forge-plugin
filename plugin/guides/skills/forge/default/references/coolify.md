<!-- forge:when tool.coolify configured -->
# `forge coolify` answers over one of two routes

Read this before the first `forge coolify` call of a task. Run `forge coolify -h` for the sub-verbs
the route answering here serves; these are the things `-h` does not say.

**Which route answers is a setting on this machine, and the listing says which.** By default it is
the tracker's own binding of the platform to this project, on the credential already held: nothing
has to be saved and no file has to be in the checkout. `forge doctor --coolify-route instance`
points the verb at an instance saved by `forge coolify login` instead. The two serve different
sub-verbs, so what `-h` lists is the answer to which one you are on.

**A name the answering route does not serve is refused by that name, and is never sent to the other
one.** Read that refusal for where the thing you wanted lives now. Switch routes only where it is
genuinely on the other side, never to get past a refusal.

**On the tracker's route the scope is this project's own bindings.** Nothing there reads a file in
the checkout and no refusal there is about a missing pin. What is in reach is what the project is
bound to, and an empty listing means this project deploys nothing rather than that something is
unconfigured.

**On the instance's route every resource command runs inside one project, and `forge coolify pin`
is what sets it.** In a checkout with none, every such command refuses and names that command — run
it with the application this checkout deploys (`--app <name>`), which settles the project and the
environment together; with no flag it lists the projects the token can see. A refusal naming a uuid outside the pin is the same guard working: that resource belongs to
a project this checkout does not own, so list what is in scope and act on that instead. There is no
flag, variable or key that widens it, and looking for one is looking for the defect the guard exists
to prevent.

**A call that changes something is refused until it is asked for in as many words**, on either
route. `--dry-run` prints the request and sends nothing, which is how to see what a deploy would do
before committing to it; the instance route's scope guard still runs while nothing is being sent.

**A deploy the tracker declined to dispatch is reported as a refusal, not as a deploy.** The refusal
names what did not go and what would release it. Act on that; sending the same call again does not
change what held it.

**A status has already been read for you.** On the instance's route the platform calls a container
unhealthy whenever it has no healthcheck configured, so that word is dropped before you see it and
`running` here means running. Never report a service as broken on the strength of a word this verb
did not print.
<!-- forge:end -->
