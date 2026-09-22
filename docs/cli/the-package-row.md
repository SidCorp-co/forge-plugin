# `forge doctor` — the package row

**A package the project declares and cannot resolve is a `miss`, and three states are silence.** A
manifest that has not moved satisfies every check keyed on the manifest, so an install broken after
it was written is the break a green report is blind to — this tree carried a dangling workspace link
for ten days with nothing saying so. Declared means `dependencies` and `devDependencies`; the other
two fields exist for a package that may legitimately be absent. Resolution is the package's own
manifest being readable under a `node_modules` at the root or any ancestor, weaker than loading it on
purpose: a bin-only package, one whose exports expose no root entry point and one hoisted above the
project all resolve, where a resolver probe would call two of them broken. No manifest, nothing
declared, and a Plug'n'Play loader each earn no row, the last because an absence below `node_modules`
proves nothing where nothing resolves through it. And the row names the command rather than running
it: an install is a write, and this verb makes none.

Why that count is a report and not a gate: [the proof escapes](the-proof-escapes.md).

← [the CLI](../FORGE-CLI.md) · [doctor](doctor.md)
