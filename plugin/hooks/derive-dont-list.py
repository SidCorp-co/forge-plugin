#!/usr/bin/env python3
"""Nudge once when a checker is about to hard-code the cases it knows.

A checker earns its keep by catching what nobody predicted. A list written by hand only
knows the cases its author had already met, and it fails twice over: it stays silent when
someone adds a case it never heard of, and it reports a false gap when someone extends the
thing correctly. The second failure is the expensive one — a checker that cries wolf gets
switched off, and a switched-off checker protects nothing.

Measured on this repo: an error-code test carried a six-item list copied by hand out of a
`switch`. Adding one arm to that switch and one code to the contract — a correct change,
both halves consistent — made the test fail on the correct change while a derived version
stayed green.

Deliberately a nudge, not a refusal. A hard-coded list is sometimes the honest answer: a
ratchet's list of migrated directories is *supposed* to be enumerated, because being
incomplete is the point. So this asks once per file per session and then gets out of the
way, the same way learning-gate.py does — the acknowledgement is that the question was put.

A comment sitting directly above the literal silences it outright. That is not politeness:
it is the difference between a list nobody examined and one somebody decided on, and the
decision is the only thing a reader downstream can act on.
"""
import hashlib
import json
import os
import re
import sys
import tempfile

# Only files whose job is to check something. Nudging every array literal in a codebase is
# how a guard earns its way into the ignore list.
CHECKER = re.compile(r"(lint|check|guard|rule|verify|validate|audit)[^/]*\.(py|mjs|js|ts)$|/scripts/[^/]+\.(mjs|js|py)$|\.test\.(ts|tsx|js|mjs)$")

# A run of quoted constants that reads like an enumeration of cases.
LIST = re.compile(r"""(?:const|let|var|^\s*[A-Z_]+\s*=)\s*[\w:\[\]<>,\s]*=\s*[\[\{]([^\]\}]{0,400})[\]\}]""", re.M)
CONSTS = re.compile(r"""['"]([A-Z][A-Z0-9_]{2,})['"]""")


def content_of(ev):
    ti = ev.get("tool_input") or {}
    parts = [ti.get("content") or "", ti.get("new_string") or ""]
    for edit in ti.get("edits") or []:
        parts.append((edit or {}).get("new_string") or "")
    return "\n".join(p for p in parts if p)


def is_explained(text, start):
    """A comment on the line above the literal means somebody decided to enumerate."""
    before = text[:start].rstrip()
    line = before[before.rfind("\n") + 1:].lstrip()
    return line.startswith(("//", "#", "*", "/*"))


def offending(text):
    """The longest run of ALL_CAPS string constants in one unexplained literal."""
    worst = []
    for m in LIST.finditer(text):
        if is_explained(text, m.start()):
            continue
        found = CONSTS.findall(m.group(1))
        if len(found) > len(worst):
            worst = found
    return worst


def already_asked(ev, path):
    key = hashlib.sha1(f"{ev.get('session_id', '')}\x00{path}".encode()).hexdigest()[:16]
    stamp = os.path.join(tempfile.gettempdir(), f"derive-dont-list-{key}")
    if os.path.exists(stamp):
        return True
    try:
        open(stamp, "w").close()
    except OSError:
        pass
    return False


def main():
    try:
        ev = json.load(sys.stdin)
    except Exception:
        sys.exit(0)
    if ev.get("tool_name") not in ("Write", "Edit", "MultiEdit"):
        sys.exit(0)
    path = (ev.get("tool_input") or {}).get("file_path", "")
    if not path or not CHECKER.search(path):
        sys.exit(0)

    found = offending(content_of(ev))
    if len(found) < 3 or already_asked(ev, path):
        sys.exit(0)

    sample = ", ".join(found[:4]) + ("…" if len(found) > 4 else "")
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": (
            f"Asked once, then this file is yours.\n\n"
            f"This checker is about to carry a hand-written list of {len(found)} constants "
            f"({sample}). A list only knows the cases you have already met: it stays silent "
            f"on a case it never heard of, and it reports a false gap when someone extends "
            f"the thing correctly — and a checker that cries wolf gets switched off.\n\n"
            f"Can it be DERIVED from the source instead? Read the enum, parse the switch, "
            f"key on the declared type rather than the name. Then a case added next year is "
            f"covered without anyone remembering this file exists.\n\n"
            f"If enumerating IS the point — a ratchet's migrated-directory list is supposed "
            f"to be incomplete — say so in a comment and send it again."
        ),
    }}))
    sys.exit(0)


if __name__ == "__main__":
    main()
