# code-quality — the plugin fires, the project decides

`eslint-plugin-code-quality` ships its own Claude plugin whose hook script resolves the
consumer project's workspace, ESLint binary and config. Reimplementing that here would be a
second copy of something already maintained, so this hook forwards to it instead — preferring
the project's own copy in `node_modules`, falling back to `hooks/vendor/` for a project that
never installed the package. A project with no ESLint stays silent either way; the script
treats that as an opt-out rather than a misconfiguration.

The gap that justifies a wrapper is routes, not rules: the shipped hook's matcher is
`Edit|Write|MultiEdit|NotebookEdit`, so the shell route was unwatched.

The vendored copy is a copy on purpose: a plugin directory travels alone and cannot import a
sibling package. Every file in `vendor/` names its upstream in its header, and a check compares
the two on every run — so a stale vendored rule is a failing gate here, never a project quietly
linted against last month's rules.

The delegate runs the project's `prettier` before linting, so it **writes** the file.
Extending it to the shell route means a file written by `sed` gets formatted too — the same
contract every project already accepted on `Edit`.
