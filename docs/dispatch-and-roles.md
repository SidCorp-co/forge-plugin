# Roles, and why a definition holds so little

## The decision

Before this, every delegated run was spawned the same way: a catch-all agent, its model and tool set
chosen afresh at the keyboard, and the unchanging part of its instructions retyped from the
dispatcher's memory. Two things were wrong, and only one was visible. Choosing the model per dispatch
meant nothing anywhere recorded what a runner was supposed to be — the answer existed only in
whoever last typed it. And instructions retyped from memory drift: three claims in a single day's
briefs were wrong, and each one cost the agent that received it a round to find out.

A role moves the fixed half into a file that ships with the plugin. What survives in the message is
the half that could not have been written earlier.

## Why the definitions are three short files

The test that decides whether a sentence belongs in a definition: **would it have been true of the
dispatch before this one?** A tree cut this morning, an issue key, the files three running agents
hold — none of them survive that test, and a definition carrying one is wrong on every wave but the
one it was written for. It is wrong silently, too: nothing fails, the agent simply believes it.

The rules that *are* stable mostly have a home already, and the homes fire. Copying one into a
definition makes a second that does not — so the definitions carry what nothing else enforces, and no
more. `check:skill-paths` holds the path half of this mechanically; the rest is a reading, which is
why it is written here.

## What is deliberately not in them

A definition names none of the skill's rules, because the skill is loaded and states them; none of
the contract's, because a status refuses on its own terms; and none of the standing prohibitions,
because those fire from a hook whose message is what anybody actually reads. The skill text carries
the rule about that duplication. What belongs here is the consequence nobody sees until later: of two
copies of one rule, the one that fires stays true and the one that only sits in a file does not, so
the silent copy is the one a reader ends up trusting.

The preload key a definition could use to pull a skill's text into context at startup is left alone.
Where a skill is a stub that names a served body, preloading it saves nothing: the body is fetched in
the same call either way, and the stub is what would arrive.

## The restart

A definition is re-read while a session runs, but the watcher only covers directories that existed
when the session started. So the first file in a new one is invisible until a restart — which is why
the roles directory sits in the frozen set beside the skills, and why a dispatcher checks that the
copy a run would load ships the role before it names one.
