"""Placeholder accounting: what makes this more trustworthy than a curl wrapper.

A translation that loses `{{count}}` or turns `%s` into `%S` breaks the app at
runtime, silently, in a locale most of the team cannot read. Every translated
string is compared against its source before it is allowed into a file.
"""

import re
from collections import Counter

# Order matters: the longest, most specific forms are matched first.
PATTERNS = [
    re.compile(r"\$t\([^)]*\)"),                 # i18next nesting
    re.compile(r"%\{[^}]*\}"),                   # ruby / vue-i18n
    re.compile(r"%\([^)]*\)[a-zA-Z]"),           # python named
    re.compile(r"%\d+\$[a-zA-Z]"),               # positional printf
    # No space in the flag class on purpose: it would make "50% off" look like a token.
    re.compile(r"%[-+#0]*\d*(?:\.\d+)?[a-zA-Z%]"),  # printf
    re.compile(r"</?[A-Za-z][A-Za-z0-9._:-]*(?:\s[^<>]*)?/?>"),  # html / jsx tags
    re.compile(r"</?\d+>"),                      # <0> </0> from react-i18next Trans
    re.compile(r"(?<![:\w]):[a-zA-Z_][a-zA-Z0-9_]*"),  # :name (rails, i18n-js)
    re.compile(r"\\[nt]"),                       # literal escapes in the string
]

BRACE = re.compile(r"\{\{?\s*([A-Za-z0-9_.\-]*)")


def _brace_spans(text):
    """Every balanced {...} or {{...}} run, so ICU blocks count as one unit."""
    spans, depth, start = [], 0, None
    for index, char in enumerate(text):
        if char == "{":
            if depth == 0:
                start = index
            depth += 1
        elif char == "}" and depth:
            depth -= 1
            if depth == 0:
                spans.append((start, index + 1))
    return spans


def extract(text):
    """The multiset of placeholders in `text`.

    Braced forms reduce to their variable name, so `{count}` and the ICU
    `{count, plural, one{...} other{...}}` both count as `{count}` — the
    translator is allowed to reshape a plural block but not to rename its variable.
    """
    if not isinstance(text, str):
        return Counter()
    found = Counter()
    masked = list(text)
    for start, end in _brace_spans(text):
        chunk = text[start:end]
        match = BRACE.match(chunk)
        name = (match.group(1) if match else "").strip()
        # `{{name}}` and `{name}` are different interpolation syntaxes; swapping one
        # for the other breaks the app just as surely as dropping it.
        shape = "{{%s}}" if chunk.startswith("{{") else "{%s}"
        found[shape % name] += 1
        for index in range(start, end):
            masked[index] = "\0"
    rest = "".join(masked)
    for pattern in PATTERNS:
        for match in pattern.finditer(rest):
            token = match.group(0)
            found[token] += 1
            rest = rest[:match.start()] + "\0" * len(token) + rest[match.end():]
    return found


def diff(source, translated):
    """Human-readable description of what changed, or None when the two agree."""
    want, got = extract(source), extract(translated)
    if want == got:
        return None
    missing = want - got
    added = got - want
    parts = []
    if missing:
        parts.append("missing " + ", ".join(sorted(_expand(missing))))
    if added:
        parts.append("invented " + ", ".join(sorted(_expand(added))))
    return "; ".join(parts)


def _expand(counter):
    for token, count in counter.items():
        yield token if count == 1 else "%s x%d" % (token, count)
