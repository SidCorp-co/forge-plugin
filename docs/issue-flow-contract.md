# The issue-flow contract

Its text is `plugin/guides/contract/<flow>/`, one file per part under the flow it answers for, and
`forge guide contract` prints its table of contents — one part per line, with the command that
prints that part. `default` ships every part and is the base every other flow inherits from;
[the guides](cli/the-guides.md) says what a flow may change about it.

It lives inside the plugin because installing copies `plugin/` and nothing beside it, so a rule kept
in this directory was a rule no project but this checkout could reach. Every citation of this
document elsewhere under `docs/` names a part of it by heading, and the same heading is what
`forge guide contract <section>` and `forge guide contract <status>` take.
