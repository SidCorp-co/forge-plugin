# The issue-flow contract

Its text is `plugin/guides/issue-flow-contract.md`, and `forge guide contract` prints its table of
contents — one part per line, with the command that prints that part.

It lives inside the plugin because installing copies `plugin/` and nothing beside it, so a rule kept
in this directory was a rule no project but this checkout could reach. Every citation of this
document elsewhere under `docs/` names a part of it by heading, and the same heading is what
`forge guide contract <section>` and `forge guide contract <status>` take.

The figures: [`diagrams/issue-flow.html`](diagrams/issue-flow.html).
