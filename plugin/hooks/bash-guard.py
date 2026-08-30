#!/usr/bin/env python3
"""Refuse the shell commands whose damage cannot be undone by the agent that caused it.

Every rule here used to be a sentence in a skill. A sentence is read by an agent that
decided to read it, and the two failures below are the ones where a single missed reading
costs work nobody can reconstruct: a process the user has been running for days, or
uncommitted changes with no history to restore from.

Deliberately narrow. A guard that refuses too much gets disabled, and a disabled guard
protects nothing — so each pattern names one command shape with a stated safer form, and
anything it cannot recognise is allowed through.
"""
import json
import os
import re
import subprocess
import sys

# (regex, why it is refused, what to do instead)
RULES = [
    (
        re.compile(r"\b(pkill|killall)\b"),
        "pkill and killall select by name, so they match every process whose name fits — "
        "including the ones the user has been running since before this session.",
        "Find the one process you mean (`lsof -ti :PORT`, `pgrep -f <exact>`), confirm the "
        "pid is the one you established you may stop, then `kill <pid>`.",
    ),
    (
        re.compile(r"\bgit\s+add\s+(-A\b|--all\b|\.(\s|$))"),
        "git add -A stages everything in the tree, including work in progress that is not "
        "yours and probes you meant to throw away.",
        "Stage the paths you changed, explicitly.",
    ),
    (
        re.compile(r"\bgit\s+stash\b"),
        "git stash silently reverts the working tree, so everything read afterwards reports "
        "about code that is no longer there.",
        "Copy the file aside to undo a probe, or use a separate `git worktree` for a clean "
        "baseline.",
    ),
    (
        re.compile(r"\bgit\s+checkout\s+(--\s+\S|-{2}\s|\S+\.\w)"),
        "git checkout of a tracked path discards uncommitted work with no history to "
        "restore it from.",
        "Copy the file aside first, or make the change you actually want.",
    ),
    (
        re.compile(r"\bgit\s+reset\s+--hard\b"),
        "git reset --hard discards every uncommitted change in the tree at once.",
        "Reset the specific paths, or commit first so the state is recoverable.",
    ),
]

GIT_RULES = {1, 2, 3, 4}          # indices whose danger is conditional on a dirty tree


def tree_is_dirty(cwd):
    """A git rule only bites when there is uncommitted work to lose.

    Returns True on any doubt: if git cannot answer, the safe reading is that something is
    at stake.
    """
    try:
        out = subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=cwd or None, capture_output=True, text=True, timeout=5,
        )
    except Exception:
        return True
    if out.returncode != 0:
        return False                      # not a repository: the rule has nothing to protect
    return bool(out.stdout.strip())


def main():
    try:
        ev = json.load(sys.stdin)
    except Exception:
        sys.exit(0)
    if ev.get("tool_name") != "Bash":
        sys.exit(0)
    command = (ev.get("tool_input") or {}).get("command", "")
    if not command:
        sys.exit(0)

    for index, (pattern, why, instead) in enumerate(RULES):
        if not pattern.search(command):
            continue
        if index in GIT_RULES and not tree_is_dirty(ev.get("cwd", os.getcwd())):
            continue
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": f"Refused.\n\n{why}\n\nInstead: {instead}\n\n"
                                        "If you have a reason this case is safe, say it and "
                                        "ask the user rather than rephrasing around the guard.",
        }}))
        sys.exit(0)
    sys.exit(0)


if __name__ == "__main__":
    main()
