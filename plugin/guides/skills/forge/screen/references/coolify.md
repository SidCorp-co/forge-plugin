# `forge coolify` runs inside a pinned project

Read this before the first `forge coolify` call of a task. Run `forge coolify -h` for the sub-verbs;
these are the four things `-h` does not say.

**Every resource command runs inside one project, and the project is a file.** `.coolify.json`,
found by walking up from the working directory, is what pins it. In a checkout that has none, every
such command refuses — that is the arrangement, not a fault to work around.

**A refusal naming a uuid outside the pin is the guard working.** It means that resource belongs to
a project this checkout does not own, so list what is in scope and act on that instead. There is no
flag, variable or key that widens it, and looking for one is looking for the defect the guard exists
to prevent.

**A call that changes something is refused until it is asked for in as many words.** `--dry-run`
prints the request and sends nothing, which is how to see what a deploy or a restart would do before
committing to it; the scope guard still runs while nothing is being sent.

**A status has already been read for you.** Coolify calls a container unhealthy whenever it has no
healthcheck configured, so that word is dropped before you see it and `running` here means running.
Never report a service as broken on the strength of a word this verb did not print.
