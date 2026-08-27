"""Markdown segmentation: translate the prose, leave the machinery alone."""

import re

FENCE = re.compile(r"^\s{0,3}(`{3,}|~{3,})")
SPLIT = re.compile(r"(\n[ \t]*\n)")
INLINE_CODE = re.compile(r"`[^`\n]+`")
LINK_TARGET = re.compile(r"\]\(([^)\s]+)")
SENTINEL = re.compile(r"⟦VI\d+⟧")
NOTHING_TO_SAY = re.compile(r"^[\s\W\d]*$")
COMMENT_ONLY = re.compile(r"^\s*<!--.*-->\s*$", re.S)
LINK_DEF = re.compile(r"^\s*\[[^\]]+\]:\s*\S+\s*$")
HEADING = re.compile(r"^(#{1,6})\s+(.*\S)\s*$")


def segment(text):
    """Split into ("text", block) pieces to translate and ("keep", block) pieces to copy.

    Fenced code, frontmatter, link definitions, HTML comments and the blank lines
    between blocks are all "keep" — they pass through byte for byte.
    """
    pieces = []
    # Line endings are kept on the lines, so concatenating every piece reproduces
    # the file byte for byte — the property the whole command rests on.
    lines = text.splitlines(keepends=True)
    index = 0

    if lines and lines[0].strip() == "---":
        for end in range(1, len(lines)):
            if lines[end].strip() in ("---", "..."):
                pieces.append(("keep", "".join(lines[:end + 1])))
                index = end + 1
                break

    buffer = []
    while index < len(lines):
        line = lines[index]
        match = FENCE.match(line)
        if match:
            marker = match.group(1)
            block = [line]
            index += 1
            while index < len(lines):
                block.append(lines[index])
                closed = lines[index].strip().startswith(marker[0] * len(marker))
                index += 1
                if closed:
                    break
            _flush(pieces, buffer)
            pieces.append(("keep", "".join(block)))
            continue
        buffer.append(line)
        index += 1
    _flush(pieces, buffer)
    return pieces


def _flush(pieces, buffer):
    if not buffer:
        return
    body = "".join(buffer)
    buffer.clear()
    for part in SPLIT.split(body):
        if not part:
            continue
        if SPLIT.fullmatch(part) or _untranslatable(part):
            pieces.append(("keep", part))
            continue
        # Surrounding whitespace rides along as "keep": the model would not give it
        # back, and losing a trailing newline silently reflows the document.
        body_text = part.strip("\n")
        head = part[:part.index(body_text)]
        tail = part[part.index(body_text) + len(body_text):]
        if head:
            pieces.append(("keep", head))
        pieces.append(("text", body_text))
        if tail:
            pieces.append(("keep", tail))


def heading_trails(pieces, root=None):
    """Where each prose block sits in the document, keyed by index in `pieces`.

    A locale string is sent with its key path because "save" means one thing
    under `common.buttons` and another under `billing`. A paragraph in a spec
    has the same problem and no key: lifted out of its section it can mean
    several things, and the model has been guessing. The heading above it is
    the key path it already has — so send it.

    Keyed by index in `pieces`, not by position among the prose blocks: the
    two callers number their items differently and only this index is common
    to both.
    """
    trails, stack = {}, []
    for index, (kind, block) in enumerate(pieces):
        if kind != "text":
            continue
        own = [title for _, title in stack]
        for line in block.splitlines():
            match = HEADING.match(line)
            if not match:
                continue
            level = len(match.group(1))
            # A new heading closes every deeper one; its own trail is its parent's.
            while stack and stack[-1][0] >= level:
                stack.pop()
            own = [title for _, title in stack]
            stack.append((level, match.group(2)))
        trail = ([root] if root else []) + [t for t in own if t]
        trails[index] = " › ".join(trail)
    return trails


def _untranslatable(block):
    stripped = block.strip()
    if not stripped:
        return True
    return bool(
        NOTHING_TO_SAY.match(stripped)
        or COMMENT_ONLY.match(stripped)
        or LINK_DEF.match(stripped)
    )


def protect_inline(block, slots):
    """Swap inline code spans for sentinels so the model cannot reword an identifier."""
    def swap(match):
        token = "⟦VI%d⟧" % len(slots)
        slots.append(match.group(0))
        return token

    return INLINE_CODE.sub(swap, block)


def restore_inline(block, slots):
    def swap(match):
        index = int(match.group(0)[3:-1])
        return slots[index] if index < len(slots) else match.group(0)

    return SENTINEL.sub(swap, block)


def verify(source, translated):
    """What a Markdown block must keep: its sentinels and its link targets."""
    want_slots = sorted(SENTINEL.findall(source))
    got_slots = sorted(SENTINEL.findall(translated))
    if want_slots != got_slots:
        return "code span or placeholder token lost"
    want_links = sorted(LINK_TARGET.findall(source))
    got_links = sorted(LINK_TARGET.findall(translated))
    if want_links != got_links:
        return "link target changed"
    if source.lstrip().startswith("#"):
        want = len(source.lstrip()) - len(source.lstrip().lstrip("#"))
        got = len(translated.lstrip()) - len(translated.lstrip().lstrip("#"))
        if want != got:
            return "heading level changed"
    return None
