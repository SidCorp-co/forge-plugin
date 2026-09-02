# What counts as a token layer, and what counts as a design system

The design system is the directory the primitives are exported from — a barrel beside them. A
directory with no `index.*` is not one: skip that question and pass no `--primitives`. Without a
system to point at, `no-raw-elements` reports every `<button>` and no message can say what to write
instead.

Where one exists, `--primitives=DIR` is enough — it exempts itself, and reports only the primitives
it exports. Two options are left to write by hand afterwards if the project needs them:

- `importPath` — how product code imports it, e.g. `@/components/ui`, used in the message.
- `rampClasses` — the class prefixes that mark a heading as deliberately on the type ramp.
