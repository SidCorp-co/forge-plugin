"""Small shared helpers."""

import json
import os
import sys


class CliError(Exception):
    pass


def read_json(path, default=None):
    try:
        with open(path, encoding="utf-8") as handle:
            return json.load(handle)
    except FileNotFoundError:
        return default
    except json.JSONDecodeError as exc:
        raise CliError("%s is not valid JSON: %s" % (path, exc))


def write_json(path, data, indent=2):
    directory = os.path.dirname(os.path.abspath(path))
    if directory:
        os.makedirs(directory, exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=indent)
        handle.write("\n")
    os.replace(tmp, path)


def parse_json_object(text):
    """Parse a model reply that should be a JSON object, tolerating fences and prose."""
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = stripped.split("\n", 1)[1] if "\n" in stripped else ""
        if stripped.rstrip().endswith("```"):
            stripped = stripped.rstrip()[:-3]
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass
    start = stripped.find("{")
    end = stripped.rfind("}")
    if start == -1 or end <= start:
        raise CliError("model did not return JSON:\n%s" % text[:400])
    try:
        return json.loads(stripped[start:end + 1])
    except json.JSONDecodeError as exc:
        raise CliError("model returned malformed JSON (%s):\n%s" % (exc, text[:400]))


def err(message):
    sys.stderr.write(message.rstrip() + "\n")


def chunk_items(items, max_chars, max_items):
    """Group (key, text) pairs into batches small enough to survive one round trip."""
    batch, size = [], 0
    for key, text in items:
        cost = len(text) + len(str(key)) + 8
        if batch and (size + cost > max_chars or len(batch) >= max_items):
            yield batch
            batch, size = [], 0
        batch.append((key, text))
        size += cost
    if batch:
        yield batch
