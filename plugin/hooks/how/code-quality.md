# code-quality — the project's own lint, on the files it could not see

Why: the shipped hook watches the tool routes only, so a file written by `sed` or a heredoc was never
linted. This forwards to the project's own copy — its config, its thresholds.

How to clear it: fix what each finding names, at the source. `--fix` is refused. Comment density
inverts, so read that one twice: shortening a string raises the ratio, and the header comment is what
to trim in the same edit.

It writes. The delegate runs the project's `prettier` before linting, so a file written by `sed` comes
back formatted. A file is reported once per content in a session: a command that only names it again
is not answered twice, and the log line carries the rules that fired.

Not judged: anything the project has not configured. No ESLint means silence, which is an opt-out and
not a misconfiguration. Every rule comes from the project.
