#!/usr/bin/env python3
"""Classify a migration by whether deploying it can be undone.

A pipeline that ships without asking needs one thing a human was previously supplying:
the judgement that this particular change is recoverable. Most of that judgement has a
shape. A deploy can be rolled back, a status reopened, a branch reverted — but a column
that has been dropped is gone, and re-adding it restores the schema and not the values.

So this splits migrations three ways rather than warning about all of them, because a
checker that fires on every migration is one nobody reads:

  destructive  data cannot be reconstructed from the schema after this runs
  tightening   the statement can fail on existing rows, so the deploy can halt midway
  additive     reversible by dropping what it added

Statements inside a transaction that also rewrites the data are still destructive: this
reads SQL text, not intent, and says so rather than guessing.

  migration_risk.py <file.sql>...          classify each
  migration_risk.py --since <git-ref> DIR  classify only what that ref does not have
"""
import argparse
import os
import re
import subprocess
import sys

DESTRUCTIVE = [
    (re.compile(r"\bDROP\s+COLUMN\b", re.I), "drops a column — its values are not recoverable"),
    (re.compile(r"\bDROP\s+TABLE\b", re.I), "drops a table — its rows are not recoverable"),
    (re.compile(r"\bTRUNCATE\b", re.I), "truncates — every row goes"),
    (re.compile(r"\bDELETE\s+FROM\b", re.I), "deletes rows"),
    (re.compile(r"\bDROP\s+TYPE\b", re.I), "drops a type — columns using it go with it"),
    (re.compile(r"\bALTER\s+COLUMN\s+\S+\s+TYPE\b", re.I),
     "changes a column's type — a narrowing cast silently loses precision or truncates"),
]
TIGHTENING = [
    (re.compile(r"\bSET\s+NOT\s+NULL\b", re.I), "fails if any existing row holds NULL"),
    (re.compile(r"\bADD\s+CONSTRAINT\b.*\b(UNIQUE|CHECK|FOREIGN\s+KEY)\b", re.I | re.S),
     "fails if existing rows violate it"),
    (re.compile(r"\bCREATE\s+UNIQUE\s+INDEX\b", re.I), "fails if existing rows are not unique"),
]
# DROP INDEX and DROP CONSTRAINT are deliberately absent: both are rebuilt from the schema
# alone, so losing one costs a migration, never data.


def classify(path):
    try:
        sql = open(path, encoding="utf-8", errors="replace").read()
    except OSError as error:
        return "unreadable", [str(error)]
    # A line comment can contain the word DROP without doing anything.
    body = re.sub(r"--[^\n]*", " ", sql)
    hits = [why for rx, why in DESTRUCTIVE if rx.search(body)]
    if hits:
        return "destructive", hits
    hits = [why for rx, why in TIGHTENING if rx.search(body)]
    if hits:
        return "tightening", hits
    return "additive", []


def since(ref, directory):
    try:
        out = subprocess.run(["git", "ls-tree", "-r", "--name-only", ref, "--", directory],
                             capture_output=True, text=True, timeout=10)
        known = set(out.stdout.split())
    except Exception:
        known = set()
    found = []
    for root, _, names in os.walk(directory):
        for n in sorted(names):
            if n.endswith(".sql"):
                p = os.path.join(root, n)
                if os.path.relpath(p, ".") not in known:
                    found.append(p)
    return found


def main():
    ap = argparse.ArgumentParser(
        description="Classify migrations by whether deploying them can be undone.",
        epilog="Exit 0 additive only, 1 something tightening, 2 something destructive.",
    )
    ap.add_argument("paths", nargs="+", help="SQL files, or a directory with --since")
    ap.add_argument("--since", metavar="REF",
                    help="classify only the .sql files this git ref does not already have")
    args = ap.parse_args()

    files = since(args.since, args.paths[0]) if args.since else args.paths
    if not files:
        print("no migrations to classify")
        return 0

    worst = 0
    for path in files:
        verdict, why = classify(path)
        worst = max(worst, {"additive": 0, "tightening": 1,
                            "destructive": 2, "unreadable": 2}[verdict])
        print(f"{verdict:<12} {path}")
        for line in why:
            print(f"             {line}")

    if worst == 2:
        print("\nA destructive migration is the one deploy this pipeline does not take on its "
              "own: re-adding a column restores the schema and not the values, so no automatic "
              "rollback exists. Say what is lost and ask.")
    elif worst == 1:
        print("\nTightening can halt a deploy midway on existing rows. Run it against a copy of "
              "the deployed data before shipping; if it passes there, ship without asking.")
    return worst


if __name__ == "__main__":
    sys.exit(main())
