# code-quality — the plugin fires, the project decides

`eslint-plugin-code-quality` ships its own Claude plugin whose hook script resolves the
consumer project's workspace, ESLint binary and config. Reimplementing that here would be a
second copy of something already maintained, so this hook forwards to it instead — preferring
the project's own copy in `node_modules`, falling back to `hooks/vendor/` for a project that
never installed the package. A project with no ESLint stays silent either way; the script
treats that as an opt-out rather than a misconfiguration.

The gap that justifies a wrapper is routes, not rules: the shipped hook's matcher is
`Edit|Write|MultiEdit|NotebookEdit`, so the shell route was unwatched.

The vendored copy is a copy on purpose — that script is built to travel alone into a plugin
cache, and its own header says so. Its source is `packages/code-quality/`, a package of this
repository, so `plugin/scripts/check-vendor.mjs` compares the two on every check rather than
only when a checkout happens to be present, and a source that has gone missing fails. It
compares code rather than commit ids: the package moving without touching that file is not
drift.

`hooks/vendor/text-overlap.js` is here for the same reason and read by a different caller:
`plugin/scripts/skill-dup.mjs`, so the duplicate-text measurement the `no-duplicate-comment`
ESLint rule uses is the one the skill audit uses. Every file in `vendor/` names its own
upstream path in its header, which is what lets the check walk the directory instead of
carrying a list of what is vendored.

The delegate runs the project's `prettier` before linting, so it **writes** the file.
Extending it to the shell route means a file written by `sed` gets formatted too — the same
contract every project already accepted on `Edit`.
