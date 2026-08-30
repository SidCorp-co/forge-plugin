"""Which files a tool call just wrote — whichever route it took.

The file hooks used to watch Write/Edit/MultiEdit and nothing else, so every edit made
through the shell — `sed -i`, a heredoc, a python one-liner — passed all of them unseen.
Under a permission mode that encourages Bash that is not an edge case, it is the main road.

Parsing the shell command is the wrong tool: there is no bounded set of ways to write a file.
So this asks the disk instead. Any path-shaped token in the command that names a real file
whose mtime is within the last breath is a file this call just wrote — which covers `sed`, a
heredoc, `tee`, `cp`, and a python script that opens a path it mentions, without any of them
being understood.
"""
import os
import re
import time

TOKEN = re.compile(r"[A-Za-z0-9_./@\-]+\.[A-Za-z0-9]+")
FRESH_SECONDS = 120


def touched(ev, fresh=FRESH_SECONDS):
    tool = ev.get("tool_name")
    ti = ev.get("tool_input") or {}
    if tool in ("Write", "Edit", "MultiEdit"):
        path = ti.get("file_path")
        return [os.path.realpath(path)] if path else []
    if tool != "Bash":
        return []

    cwd = ev.get("cwd") or os.getcwd()
    now = time.time()
    out = set()
    for token in TOKEN.findall(ti.get("command", "")):
        for cand in (token, os.path.join(cwd, token)):
            try:
                if os.path.isfile(cand) and now - os.path.getmtime(cand) <= fresh:
                    out.add(os.path.realpath(cand))
                    break
            except OSError:
                continue
    return sorted(out)
