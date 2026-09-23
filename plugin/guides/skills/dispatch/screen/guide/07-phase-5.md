## Phase 5 — Dispatch through a role

Make one call per run, naming a role rather than a general agent with a model typed in beside it.
The role decides the model, the effort and the tools. The message is what `forge brief` printed for
that run, whole and unchanged. The hook refuses any other message. `forge doctor` answers which roles
this copy ships, and whether the copy a dispatch would load ships the same ones: a role that has not
reached the loaded copy will not resolve.

**Each dispatch is written onto the wave's headline before the call that dispatches it**, as its own
command: `forge record wave <headline> --member <key>... --role <role> --session <the id the brief
granted>`, with `--tree <its tree>` where the run was given one. It is one record per dispatch however
many issues the dispatch carries, and it holds what the dispatcher knows and nothing the run will
write: statuses and outcomes are read live. It takes no lease, so a headline one of the runs holds
takes it all the same. A dispatch with no record is one a restarted dispatcher cannot see.

If a run seems to need something the brief does not carry, file that against the method or the verb.
It never goes into the message.
