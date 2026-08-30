#!/usr/bin/env python3
"""Find text a skill says twice.

A skill that states a rule in its spine and again in a reference has two authorities for
one rule, and the pair diverges the first time someone corrects only the copy they found.
That divergence is silent: both files read as correct on their own. This measures the
overlap instead of trusting a reading.

The comparison is lexical, not semantic — a Jaccard index over content words, with a floor
on how many words two sentences must actually share. It cannot know that two differently
worded sentences mean the same thing, so it is a floor on quality, not a proof of absence.

  skill_dup.py <skill-dir>              audit a whole skill
  skill_dup.py <skill-dir> --against -  read proposed text on stdin, compare it to the skill
  skill_dup.py <skill-dir> --exclude references/learning.md --threshold 0.4
"""
import argparse
import os
import re
import sys

FENCE = re.compile(r"```.*?```", re.S)
TABLE_ROW = re.compile(r"^\s*\|.*\|\s*$", re.M)
HEADING = re.compile(r"^#{1,6}\s.*$", re.M)
MARKUP = re.compile(r"[*`_>\[\]()]")
SPLIT = re.compile(r"(?<=[.!?:])\s+|\n\n")
WORD = re.compile(r"[a-z][a-z-]{3,}")

# Words that carry no distinguishing weight here: every second sentence in a workflow
# document contains them, so leaving them in inflates every comparison uniformly.
STOP = {
    "that", "this", "with", "from", "into", "than", "then", "what", "when", "which",
    "there", "these", "those", "your", "yours", "have", "has", "been", "being", "does",
    "will", "would", "should", "must", "never", "always", "only", "also", "rather",
    "because", "before", "after", "does", "not", "and", "the", "for", "are", "its",
}


def sentences(text):
    text = FENCE.sub(" ", text)
    text = TABLE_ROW.sub(" ", text)
    text = HEADING.sub(" ", text)
    text = MARKUP.sub("", text)
    return [s.strip() for s in SPLIT.split(text) if len(s.strip()) >= 40]


def content_words(s):
    return {w for w in WORD.findall(s.lower()) if w not in STOP}


def compare(a_units, b_units, threshold, floor):
    """a_unit/b_unit are (label, sentence). Yields (score, a, b), worst first."""
    hits = []
    for la, sa in a_units:
        ta = content_words(sa)
        if len(ta) < floor:
            continue
        for lb, sb in b_units:
            if (la, sa) == (lb, sb):
                continue
            tb = content_words(sb)
            if len(tb) < floor:
                continue
            shared = ta & tb
            if len(shared) < floor:
                continue
            score = len(shared) / len(ta | tb)
            if score >= threshold:
                hits.append((score, (la, sa), (lb, sb)))
    return sorted(hits, key=lambda h: -h[0])


def load(skill_dir, exclude):
    units = []
    for root, _, names in os.walk(skill_dir):
        for n in sorted(names):
            if not n.endswith(".md"):
                continue
            path = os.path.join(root, n)
            rel = os.path.relpath(path, skill_dir)
            if rel in exclude:
                continue
            with open(path, encoding="utf-8") as fh:
                for s in sentences(fh.read()):
                    units.append((rel, s))
    return units


def report(hits, limit):
    seen = set()
    shown = 0
    for score, (la, sa), (lb, sb) in hits:
        key = frozenset(((la, sa), (lb, sb)))
        if key in seen:
            continue
        seen.add(key)
        shown += 1
        if shown > limit:
            break
        print(f"{score:.2f}  {la}\n        {sa[:150]}")
        print(f"      {lb}\n        {sb[:150]}\n")
    return len(seen)


def main():
    ap = argparse.ArgumentParser(
        description="Find text a skill says twice.",
        epilog="Exit 0 when clean, 1 when a duplicate is found, 2 on a usage error.",
    )
    ap.add_argument("skill_dir", help="directory holding SKILL.md")
    ap.add_argument("--against", metavar="FILE",
                    help="compare this text (or - for stdin) against the skill instead of "
                         "comparing the skill with itself")
    ap.add_argument("--exclude", action="append", default=[], metavar="REL",
                    help="skip this path, relative to the skill dir; repeatable")
    ap.add_argument("--threshold", type=float, default=0.34,
                    help="Jaccard index at which two sentences count as duplicates "
                         "(default: %(default)s)")
    ap.add_argument("--floor", type=int, default=5,
                    help="how many content words two sentences must share before the "
                         "index is even computed (default: %(default)s)")
    ap.add_argument("--limit", type=int, default=10, help="pairs to print (default: %(default)s)")
    args = ap.parse_args()

    if not os.path.isdir(args.skill_dir):
        ap.error(f"not a directory: {args.skill_dir}")

    exclude = set(args.exclude)
    if args.against:
        text = sys.stdin.read() if args.against == "-" else open(args.against, encoding="utf-8").read()
        incoming = [("<proposed>", s) for s in sentences(text)]
        if not incoming:
            return 0
        hits = compare(incoming, load(args.skill_dir, exclude), args.threshold, args.floor)
        label = "the proposed text repeats what the skill already says"
    else:
        units = load(args.skill_dir, exclude)
        hits = compare(units, units, args.threshold, args.floor)
        label = "the skill says the same thing twice"

    if not hits:
        print("clean — no duplicated statement found")
        return 0
    n = report(hits, args.limit)
    print(f"{n} duplicate pair(s): {label}.")
    print("Keep it in one place and cite it from the other; two authorities for one rule "
          "diverge the first time someone corrects only the copy they found.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
