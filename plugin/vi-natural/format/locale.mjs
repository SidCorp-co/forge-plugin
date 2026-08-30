// Walking i18n trees: nested objects, arrays, and merge-back.
//
// Objects are Maps, from format/json-order.mjs — see that file for why an object would not do.

import { cloneOrdered } from './json-order.mjs';
import { CliError } from '../util.mjs';

/** Every translatable string in the tree, as [path, text].
 *
 *  A path step is a string key or a numeric index, so a key containing a dot cannot be confused
 *  with nesting. */
export function flatten(node, path = []) {
  const items = [];
  if (node instanceof Map) {
    for (const [key, value] of node) items.push(...flatten(value, [...path, key]));
  } else if (Array.isArray(node)) {
    node.forEach((value, index) => items.push(...flatten(value, [...path, index])));
  } else if (typeof node === 'string') {
    items.push([path, node]);
  }
  return items;
}

export function getPath(node, path) {
  let current = node;
  for (const step of path) {
    if (current instanceof Map) current = current.get(step);
    else if (Array.isArray(current) && typeof step === 'number') current = current[step];
    else return null;
    if (current === undefined) return null;
  }
  return current ?? null;
}

const container = (step) => (typeof step === 'number' ? [] : new Map());

function descend(node, step, next) {
  if (typeof step === 'number') {
    while (node.length <= step) node.push(container(next));
    if (node[step] === null || node[step] === undefined) node[step] = container(next);
    return node[step];
  }
  const existing = node.get(step);
  if (!(existing instanceof Map) && !Array.isArray(existing)) node.set(step, container(next));
  return node.get(step);
}

/** Create the containers a path needs, then write the leaf. */
export function setPath(node, path, value) {
  let current = node;
  for (let index = 0; index < path.length - 1; index += 1) {
    current = descend(current, path[index], path[index + 1]);
  }
  const leaf = path[path.length - 1];
  if (typeof leaf === 'number') {
    while (current.length <= leaf) current.push('');
    current[leaf] = value;
  } else {
    current.set(leaf, value);
  }
}

export function label(path) {
  return path.map(String).join('.');
}

/** Which source strings still need a translation in `target`. */
export function pending(source, target, { overwrite = false, keys = null } = {}) {
  const wanted = keys ? new Set(keys) : null;
  const out = [];
  for (const [path, text] of flatten(source)) {
    const name = label(path);
    if (wanted && !wanted.has(name) && !wanted.has(name.split('.')[0])) continue;
    if (!text.trim()) continue;
    if (!overwrite) {
      const existing = getPath(target, path);
      if (typeof existing === 'string' && existing.trim() && existing !== text) continue;
    }
    out.push([path, text]);
  }
  return out;
}

/** Write translations into a copy of the target tree, keeping its other keys. */
export function merge(target, translations) {
  const merged =
    target instanceof Map || Array.isArray(target) ? cloneOrdered(target) : new Map();
  for (const [path, value] of translations) setPath(merged, path, value);
  return merged;
}

/** Drop keys the source no longer has, so a stale locale does not drift. */
export function prune(tree, source) {
  const keep = new Set(flatten(source).map(([path]) => JSON.stringify(path)));
  const result = cloneOrdered(tree);

  const walk = (node, path) => {
    if (node instanceof Map) {
      for (const key of [...node.keys()]) {
        const child = [...path, key];
        const value = node.get(key);
        if (value instanceof Map || Array.isArray(value)) {
          walk(value, child);
          if (value instanceof Map ? value.size === 0 : value.length === 0) node.delete(key);
        } else if (!keep.has(JSON.stringify(child))) {
          node.delete(key);
        }
      }
    } else if (Array.isArray(node)) {
      for (let index = node.length - 1; index >= 0; index -= 1) {
        const child = [...path, index];
        if (node[index] instanceof Map || Array.isArray(node[index])) walk(node[index], child);
        else if (!keep.has(JSON.stringify(child))) node.splice(index, 1);
      }
    }
  };

  walk(result, []);
  return result;
}

export function loadTree(path, data) {
  if (!(data instanceof Map) && !Array.isArray(data)) {
    throw new CliError(`${path} must contain a JSON object or array`);
  }
  return data;
}

/** Give the target the source's key order; keep anything extra at the end. */
export function reorder(source, target) {
  if (!(source instanceof Map) || !(target instanceof Map)) return target;
  const out = new Map();
  for (const [key, value] of source) {
    if (target.has(key)) out.set(key, reorder(value, target.get(key)));
  }
  for (const [key, value] of target) {
    if (!out.has(key)) out.set(key, value);
  }
  return out;
}
