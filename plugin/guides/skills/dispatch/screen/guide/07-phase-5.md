## Phase 5 — Dispatch through a role

Make one call per run, naming a role rather than a general agent with a model typed in beside it.
The role decides the model, the effort and the tools. The message is what `forge brief` printed for
that run, whole and unchanged. The hook refuses any other message. `forge doctor` answers which roles
this copy ships, and whether the copy a dispatch would load ships the same ones: a role that has not
reached the loaded copy will not resolve.

If a run seems to need something the brief does not carry, file that against the method or the verb.
It never goes into the message.
