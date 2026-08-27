"""Walking i18n JSON files: nested objects, arrays, and merge-back."""

import copy

from .util import CliError


def flatten(node, path=()):
    """Every translatable string in the tree, as (path, text).

    Paths are tuples so a key containing a dot cannot be confused with nesting.
    """
    items = []
    if isinstance(node, dict):
        for key, value in node.items():
            items.extend(flatten(value, path + (key,)))
    elif isinstance(node, list):
        for index, value in enumerate(node):
            items.extend(flatten(value, path + (index,)))
    elif isinstance(node, str):
        items.append((path, node))
    return items


def get_path(node, path):
    for step in path:
        try:
            node = node[step]
        except (KeyError, IndexError, TypeError):
            return None
    return node


def set_path(node, path, value):
    """Create the containers a path needs, then write the leaf."""
    for index, step in enumerate(path[:-1]):
        nxt = path[index + 1]
        if isinstance(step, int):
            while len(node) <= step:
                node.append([] if isinstance(nxt, int) else {})
            if node[step] is None:
                node[step] = [] if isinstance(nxt, int) else {}
            node = node[step]
        else:
            if not isinstance(node.get(step), (dict, list)):
                node[step] = [] if isinstance(nxt, int) else {}
            node = node[step]
    leaf = path[-1]
    if isinstance(leaf, int):
        while len(node) <= leaf:
            node.append("")
        node[leaf] = value
    else:
        node[leaf] = value


def label(path):
    return ".".join(str(step) for step in path)


def pending(source, target, overwrite=False, keys=None):
    """Which source strings still need a translation in `target`."""
    wanted = None
    if keys:
        wanted = set(keys)
    out = []
    for path, text in flatten(source):
        name = label(path)
        if wanted is not None and name not in wanted and name.split(".")[0] not in wanted:
            continue
        if not text.strip():
            continue
        if not overwrite:
            existing = get_path(target, path)
            if isinstance(existing, str) and existing.strip() and existing != text:
                continue
        out.append((path, text))
    return out


def merge(target, translations):
    """Write translations into a copy of the target tree, keeping its other keys."""
    merged = copy.deepcopy(target) if isinstance(target, (dict, list)) else {}
    for path, value in translations.items():
        set_path(merged, path, value)
    return merged


def prune(tree, source):
    """Drop keys the source no longer has, so a stale locale does not drift."""
    keep = {path for path, _ in flatten(source)}
    result = copy.deepcopy(tree)

    def walk(node, path):
        if isinstance(node, dict):
            for key in list(node):
                child = path + (key,)
                if isinstance(node[key], (dict, list)):
                    walk(node[key], child)
                    if not node[key]:
                        del node[key]
                elif child not in keep:
                    del node[key]
        elif isinstance(node, list):
            for index in range(len(node) - 1, -1, -1):
                child = path + (index,)
                if isinstance(node[index], (dict, list)):
                    walk(node[index], child)
                elif child not in keep:
                    del node[index]

    walk(result, ())
    return result


def load_tree(path, data):
    if not isinstance(data, (dict, list)):
        raise CliError("%s must contain a JSON object or array" % path)
    return data
