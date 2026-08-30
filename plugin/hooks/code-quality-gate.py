#!/usr/bin/env python3
"""Run the project's own linter on the files a tool call just wrote.

The gate already knows what good code is here — reimplementing any of its rules in a hook
would be a second definition, and the second definition is the one that drifts. So this runs
the repository's own eslint on exactly the files that changed and hands back what it said.

It fires only where a lint config governs: walking up from the file, the nearest directory
holding an eslint config is the workspace, and a file with no such ancestor is not code this
project lints — documentation, a scratch script, another repo. Nothing to say there.

Runs after the write, not before, which is what lets it see edits made through the shell. A
`sed -i` and a heredoc leave no tool_input to inspect, but they do leave a file on disk.
"""
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _touched import touched  # noqa: E402

CODE = (".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs")
SKIP = ("/node_modules/", "/dist/", "/.next/", "/coverage/", "/.git/")
CONFIGS = ("eslint.config.mjs", "eslint.config.js", "eslint.config.ts", ".eslintrc.json", ".eslintrc.js")
MAX_FILES = 5


def workspace_of(path):
    """Nearest ancestor holding a lint config — that is what 'a code directory' means here."""
    d = os.path.dirname(path)
    while d and d != "/":
        if any(os.path.exists(os.path.join(d, c)) for c in CONFIGS):
            return d
        d = os.path.dirname(d)
    return None


def main():
    try:
        ev = json.load(sys.stdin)
    except Exception:
        sys.exit(0)

    files = [
        f for f in touched(ev)
        if f.endswith(CODE) and not any(s in f for s in SKIP)
    ][:MAX_FILES]
    if not files:
        sys.exit(0)

    by_ws = {}
    for f in files:
        ws = workspace_of(f)
        if ws:
            by_ws.setdefault(ws, []).append(f)
    if not by_ws:
        sys.exit(0)

    findings = []
    for ws, group in by_ws.items():
        try:
            run = subprocess.run(
                ["npx", "eslint", *group],
                cwd=ws, capture_output=True, text=True, timeout=60,
            )
        except Exception:
            continue
        # 1 is "the code is wrong"; 2 is "eslint could not run". Only the first is the
        # author's problem, and a broken invocation must not stand between them and the work.
        if run.returncode == 1 and (run.stdout or "").strip():
            findings.append(run.stdout.strip())

    if not findings:
        sys.exit(0)

    body = "\n".join(findings)
    print(json.dumps({
        "decision": "block",
        "reason": (
            "The project's own linter rejected what was just written:\n\n"
            f"{body}\n\n"
            "Fix the source, not the check — no disable comment, no raised limit, no "
            "`--fix` sweep. If the rule is wrong, the rule gets fixed in the same change."
        ),
    }))
    sys.exit(0)


if __name__ == "__main__":
    main()
