#!/usr/bin/env python3
"""Stop between deciding to record something and recording it.

Two writes are guarded, and they are not the same write. A memory row is *project
knowledge*; an edit to a skill's own text is a *skill learning*, which develops the method
rather than the repository. Confusing them loses the lesson twice — the project inherits a
rule it never agreed to, and the skill repeats the mistake in the next repository.

The failure this guards is not a bad memory row — it is the reflex one. An agent that
finishes a task reaches for "save what I learned" as a closing ritual, and the corpus
fills with entries nobody reads, which is how the two or three that mattered get buried.

So the gate is deliberately cheap to pass and impossible to pass absent-mindedly: the
write is refused once, the four conditions and the category list come back as the reason,
a memory row passes on a second attempt carrying `metadata.checked: "<category>"` or a
valid `type:` in its frontmatter, and a file edit passes on the next attempt at the same
file in the same session. Naming the category is the point — it is the one part of the
test that cannot be answered by nodding.
"""
import hashlib
import json
import os
import re
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts"))
try:
    import skill_dup
except ImportError:
    skill_dup = None

FORGE_SOURCES = {
    "note": "episodic — why THIS issue happened, what one debugging run cost",
    "knowledge": "how this codebase actually works, traced and verified",
    "decision": "a choice among alternatives, with the reason it was chosen",
    "policy": "a rule that binds future work",
}
SKILL_CATEGORIES = {
    "trap": "the environment or a tool behaved unexpectedly -> prefer a check in the plugin",
    "method": "a phase produced the wrong outcome, or had no branch for what happened",
    "invariant": "holds in EVERY project, not just this one -> a rule, and only if it outranks a phase",
    "discovery": "Phase 0 should have established this and did not",
    "boundary": "the skill asserted what a project decides -> DELETE it, say what replaced it",
}
FILE_TYPES = {
    "user": "who the user is — role, expertise, standing preferences",
    "feedback": "guidance on how to work, with the why",
    "project": "ongoing work, goals, constraints not derivable from the code",
    "reference": "a pointer to something external — URL, dashboard, ticket",
}

TEST = """Recording is the exception, not the closing ritual. All four must hold:
  1. it cost a cycle, not a thought
  2. it will recur — a property of the tool, repo or domain, not of this issue
  3. its failure is silent (a thing that reports its own cause needs no note)
  4. it is not already written — search first; a second copy drifts from the first
Fail any one and write nothing. That is the normal outcome of a round.

Before either destination: does the wrong state have a SHAPE — a command pattern, a
missing field, a violated ordering? Then it is a check waiting to be written, and a
check cannot be missed the way a sentence can."""


def skill_root(path):
    """Walk up to the directory holding SKILL.md, or None if this is not a skill file."""
    d = os.path.dirname(os.path.abspath(path))
    for _ in range(4):
        if os.path.exists(os.path.join(d, "SKILL.md")):
            return d
        d = os.path.dirname(d)
    return None


def duplicates(root, path, text):
    """Sentences in the proposed text that the rest of the skill already says.

    Run before the write, not after: the point is that the second copy never lands. The
    file being edited is excluded, or every unchanged line would match itself.
    """
    if skill_dup is None or not text.strip():
        return []
    incoming = [("<proposed>", s) for s in skill_dup.sentences(text)]
    if not incoming:
        return []
    rel = os.path.relpath(os.path.abspath(path), root)
    existing = skill_dup.load(root, {rel})
    return skill_dup.compare(incoming, existing, 0.34, 5)


def already_asked(ev, path):
    """Ask once per file per session, then get out of the way.

    A memory row can carry `metadata.checked`, but a file edit has no field to put an
    acknowledgement in — forcing one into the content would write the gate's bookkeeping
    into the skill it is guarding. So the acknowledgement is the fact that the question
    was already put, recorded outside both files.
    """
    key = hashlib.sha1(
        f"{ev.get('session_id', '')}\x00{path}".encode()
    ).hexdigest()[:16]
    stamp = os.path.join(tempfile.gettempdir(), f"learning-gate-{key}")
    if os.path.exists(stamp):
        return True
    try:
        open(stamp, "w").close()
    except OSError:
        pass
    return False


def deny(reason):
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": reason,
    }}))
    sys.exit(0)


def main():
    try:
        ev = json.load(sys.stdin)
    except Exception:
        sys.exit(0)                       # never break a session over a parse failure

    tool = ev.get("tool_name", "")
    ti = ev.get("tool_input") or {}

    if tool.endswith("forge_memory_write") or tool.endswith("forge_memory.write"):
        src = ti.get("source", "")
        if src not in FORGE_SOURCES:      # issue/comment/job are system-authored
            sys.exit(0)
        md = ti.get("metadata") or {}
        if isinstance(md, dict) and md.get("checked"):
            sys.exit(0)
        cats = "\n".join(f"  {k:<10} {v}" for k, v in FORGE_SOURCES.items())
        deny(
            f"Hold — you are about to write project memory as `{src}`.\n\n{TEST}\n\n"
            f"If it survives, put it in the right category rather than all of it in one:\n{cats}\n\n"
            "Re-send with metadata.checked set to the category you chose, and say in one "
            "line which of the four conditions made it worth keeping."
        )

    if tool not in ("Write", "Edit", "MultiEdit"):
        sys.exit(0)
    path = ti.get("file_path", "")

    # --- a memory file: project knowledge ---
    # MEMORY.md is the index, not a memory: it carries pointers and no frontmatter.
    if "/memory/" in path and path.endswith(".md") and os.path.basename(path) != "MEMORY.md":
        body = ti.get("content") or ""
        if not body:
            # An Edit sends only the changed span, so the type lives in the file already;
            # gating on the span would refuse every legitimate revision of an existing fact.
            try:
                body = open(path, encoding="utf-8").read()
            except OSError:
                body = ""
            if not body:
                sys.exit(0)
        m = re.search(r"^type:\s*([a-z]+)\s*$", body, re.M)
        if m and m.group(1) in FILE_TYPES:
            sys.exit(0)
        if already_asked(ev, path):
            sys.exit(0)
        cats = "\n".join(f"  {k:<10} {v}" for k, v in FILE_TYPES.items())
        deny(
            f"Hold — you are about to write a memory file.\n\n{TEST}\n\n"
            f"If it survives, one file is one fact, and the frontmatter must declare which "
            f"kind it is:\n{cats}\n\n"
            "Add a valid `type:` to the frontmatter and re-send."
        )

    # --- a skill's own text: a skill learning ---
    if "/skills/" in path and re.search(r"/(SKILL\.md|references/[^/]+\.md)$", path):
        root = skill_root(path)
        proposed = (ti.get("content") or "") + "\n" + (ti.get("new_string") or "")
        if root:
            dups = duplicates(root, path, proposed)
            if dups:
                lines = []
                for score, (_, a), (lb, b) in dups[:3]:
                    lines.append(f"  {score:.2f}  you are writing: {a[:140]}\n"
                                 f"        {lb} already says: {b[:140]}")
                joined = "\n".join(lines)
                deny(
                    "This repeats what the skill already says — that is a defect, not a "
                    "style preference: two authorities for one rule diverge the first "
                    f"time someone corrects only the copy they found.\n\n{joined}\n\n"
                    "Keep it in one place and cite it from the other. If the existing "
                    "wording is the worse one, replace it rather than adding beside it.\n"
                    "Audit the whole skill with: scripts/skill_dup.py <skill-dir>"
                )
        if already_asked(ev, path):
            sys.exit(0)
        cats = "\n".join(f"  {k:<10} {v}" for k, v in SKILL_CATEGORIES.items())
        deny(
            "Hold — you are about to change a skill's own text. That is a skill "
            "learning, not project knowledge: it develops the method, so it must not "
            f"be a note about this one repository.\n\n{TEST}\n\n"
            f"If it survives, it lands in a specific place, not on a pile:\n{cats}\n\n"
            "Two more before you re-send. (a) Could a check in the plugin enforce this "
            "instead? A check cannot be missed the way a sentence can. (b) What does "
            "this displace? A skill that only accumulates stops being read — name the "
            "rule it replaces, or say that it adds without replacing.\n\n"
            "Re-send the same edit once you have answered both — say the category and "
            "what it displaces in your reply, not in the file."
        )

    sys.exit(0)


if __name__ == "__main__":
    main()
