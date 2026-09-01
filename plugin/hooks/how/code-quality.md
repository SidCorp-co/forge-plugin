# code-quality — the project's own lint, on the files it could not see

Why: the shipped hook watches the tool routes only, so a file written by `sed` or a heredoc was never
linted. This wrapper adds that route and forwards to the project's own copy, with its config and its
thresholds.

How to clear it: fix what each finding names, at the source. `--fix` is refused by `bash-guard`, and
for the same reason — a green run nobody decided about. The finding that fires most here is comment
density, and it inverts: shortening a string literal raises the ratio, so trim the header comment in
the same edit rather than wondering why a deletion made it worse.

It **writes**. The delegate runs the project's `prettier` before linting, so a file written by `sed`
comes back formatted — the same contract every project already accepted on `Edit`.

The vendored copy under `hooks/vendor/` is a copy on purpose: a plugin directory travels alone and
cannot import a sibling package. Every file there names its upstream in its header and a check
compares the two on every run, so a stale rule is a failing gate here rather than a project quietly
linted against last month's rules.

**Not judged:** anything the project has not configured. No ESLint means silence, which is an opt-out
and not a misconfiguration. Every rule comes from the project; none from here.
