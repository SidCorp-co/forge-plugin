/* The command table is the only route to a verb's handler, so an entry loads the one verb it was
   asked for and nothing else runs. The table named every verb module at the top of the file until
   ISS-1775, and an import put back beside the table undoes a loader in it without being visible in
   it. Which module answers which verb is read off the table's own loaders, and a dynamic import is
   out of this graph on purpose: it is what a path the invocation did not take does not spend. A
   module reached for something other than its handler is another rule's subject, not this one's —
   so every reachable edge into a verb's module is read, and not the one a walk happened to arrive
   by, an earlier helper-only import having hidden a handler import behind it otherwise. */
import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

const FROM = /(?:^|[\s;])(?:import|export)[\s\S]*?from\s+["'](\.[^"']+)["']/g;
const BARE = /^\s*import\s+["'](\.[^"']+)["'];?\s*$/gm;
const LOADS = /^ {2}([a-z]+): loads\("\.(\/[^"]+)"/gmu;

export const importsIn = (text) =>
  [...new Set([...String(text).matchAll(FROM), ...String(text).matchAll(BARE)].map((one) => one[1]))];

export const graphOf = (root, files, read = (one) => readFileSync(resolve(root, one), "utf8"),
  there = (one) => existsSync(resolve(root, one))) => {
  const edges = new Map();
  for (const file of files) {
    const at = dirname(resolve(root, file));
    edges.set(file, importsIn(read(file))
      .map((one) => relative(root, resolve(at, one)))
      .filter((one) => there(one)));
  }
  return edges;
};

/** Each name the entry reaches, answering with the module that reached it: an edge is a line to remove, a chain is not. */
export const reachedFrom = (edges, entry) => {
  const by = new Map([[entry, null]]);
  const queue = [entry];
  while (queue.length) {
    const held = queue.shift();
    for (const one of edges.get(held) ?? []) {
      if (by.has(one)) continue;
      by.set(one, held);
      queue.push(one);
    }
  }
  return by;
};

export const verbModules = (table, at = "plugin/src") =>
  new Map([...String(table).matchAll(LOADS)].map(([, verb, path]) => [`${at}${path}`, verb]));

/** Whether one module's text takes `name` from the specifier ending `tail`; a namespace or a default binding takes everything. */
export const takesFrom = (text, tail, name) => {
  for (const [whole, spec] of String(text).matchAll(FROM)) {
    if (!spec.endsWith(tail)) continue;
    const clause = whole.slice(0, whole.lastIndexOf("from"));
    if (/\*\s+as\s/u.test(clause)) return true;
    if (new RegExp(String.raw`(?:^|[\s{,])${name}(?:[\s,}]|$)`, "u").test(clause)) return true;
  }
  return false;
};

export const problems = (edges, entry, verbs, read) => {
  const found = [];
  for (const from of reachedFrom(edges, entry).keys()) {
    for (const module of edges.get(from) ?? []) {
      const verb = verbs.get(module);
      if (!verb) continue;
      if (!takesFrom(read(from), `/${module.split("/").pop()}`, verb)) continue;
      found.push(`${entry} loads the \`${verb}\` handler: ${from} imports it from ${module} at the top `
        + `of the file, so every call this entry takes pays for \`forge ${verb}\` whatever it was asked `
        + "for. The command table's loaders are the one route to a handler — take it there.");
    }
  }
  return found;
};
