# Which gates run

The names are the hooks directory, read, so a hook added later is switchable without editing anything
here. Derivation alone did not make that true — an entry point can read no event and keep running while
`forge hooks --off` reports it off — so a test fails on a hook the switch cannot reach, and names the
fix. A typo is answered with the near miss, so a switch that silences nothing cannot be written.

One place answers whether a gate is off, and anything that is not a list reads as empty: a broken config
runs every gate rather than none. Nothing in the environment reaches that decision, and a test asserts
it against the source rather than by sampling names, because a second layer is a precedence rule plus a
report that has to say which layer holds a gate.

A name is a *type*: the answers name the event they turned off, and a test fails on a script registered
on two. `docs/HOOKS.md` says why the switch is read by the hook process rather than declared in
`hooks.json`.
