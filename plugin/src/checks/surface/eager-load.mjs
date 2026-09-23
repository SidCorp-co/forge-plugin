/* The command table is the only route to a verb's handler, so an entry loads the one verb it was asked for and nothing else runs. The table named every verb module at the top of the file until ISS-1775, and an import put back beside the table undoes a loader in it without being visible in it. Which module answers which verb is read off the table's own loaders, and a dynamic import is out of this graph on purpose: it is what a path the invocation did not take does not spend.
   A module reached for something other than its handler is another rule's subject, not this one's — so every reachable edge into a verb's module is read, and not the one a walk happened to arrive by, an earlier helper-only import having hidden a handler import behind it otherwise. */
import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

import { namesOn } from "../../hooks/hook-switch.mjs";

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

/* The same reading, rooted at a hook rather than at the CLI's entry: a gate exits for most calls it is
   asked about, so a module on its path before that decision is one every event in every session pays
   for, and three landed that way in one release range without a review that could see it. The roots
   are the registration's own, so a gate added later is covered without anybody remembering; the
   targets are declared, because what a gate needs before it exits is not in the graph. */

const SCRIPT = /hooks\/([\w/-]+)\.mjs/gu;

/** The file a registered name runs: flat beside the runner, or under `gates/` wherever the layout put it. */
const fileFor = (name, files, at) =>
  [`${at}/${name}.mjs`, ...files.filter((one) => one.startsWith(`${at}/gates/`) && one.endsWith(`/${name}.mjs`))]
    .find((one) => files.includes(one)) ?? null;

/** Every file `hooks.json` registers, and every name on it that no file answers — which is a finding
 *  and not a root quietly dropped: a rule whose roots come from a derivation that stopped matching
 *  looks exactly like a clean repository. */
export const hookRoots = (registration, files, at = "plugin/hooks") => {
  const roots = new Set();
  const unresolved = new Set();
  for (const blocks of Object.values(JSON.parse(registration)?.hooks ?? {})) {
    for (const block of blocks ?? []) {
      for (const one of block.hooks ?? []) {
        const command = String(one.command ?? "");
        for (const [, path] of command.matchAll(SCRIPT)) {
          if (files.includes(`${at}/${path}.mjs`)) roots.add(`${at}/${path}.mjs`);
          else unresolved.add(path);
        }
        for (const name of namesOn(command)) {
          const file = fileFor(name, files, at);
          if (file) roots.add(file);
          else unresolved.add(name);
        }
      }
    }
  }
  return { roots: [...roots].sort(), unresolved: [...unresolved].sort() };
};

/** What no hook may have on its path, what a hook takes instead, and the roots the target is right
 *  for with the reason each is — one gate whose whole subject is a heavy module is a declaration
 *  here, so the target stays refused for every other root rather than leaving the rule. */
export const HEAVY = [
  {
    target: "plugin/src/hooks/log/hook-log.mjs",
    what: "the refusal log's verb, which reads the log back, resolves a hook name and prints it",
    instead: "plugin/src/hooks/log/hook-log-file.mjs writes the line and plugin/src/hooks/log/scrub.mjs masks it",
    allowed: {},
  },
  {
    target: "plugin/src/stats/corpus/classes.mjs",
    what: "the transcript classifier, which compiles a table of patterns at import for a corpus no gate reads",
    instead: "plugin/src/stats/corpus/declared.mjs carries what a project declared its commands to be",
    allowed: {},
  },
  {
    target: "plugin/src/spec/",
    what: "the requirements tree, which is walked and parsed to answer for one clause",
    instead: "plugin/src/checks/claude-md-goals.mjs holds the claim that is read against that tree",
    allowed: {
      "plugin/hooks/gates/plan-scope.mjs":
        "the clause a plan cites is this gate's whole subject, so the tree is what it was registered to read",
    },
  },
];

/** The chain that reached `target`, root first: the reader is owed the line to remove and not only the arrival. */
const chainTo = (by, target) => {
  if (!by.has(target)) return null;
  const held = [];
  for (let at = target; at; at = by.get(at)) held.unshift(at);
  return held;
};

const named = (module, target) => module === target || (target.endsWith("/") && module.startsWith(target));

export const heavyLoads = (edges, roots, heavy = HEAVY) => {
  const found = [];
  for (const root of roots) {
    const by = reachedFrom(edges, root);
    for (const one of heavy) {
      if (one.allowed[root]) continue;
      /* Where the target is a subsystem, the line to remove is the edge INTO it: a module the
         subsystem reached itself is not a line anybody here wrote. */
      const arrivals = [...by.keys()]
        .filter((each) => named(each, one.target) && !named(by.get(each) ?? "", one.target));
      for (const module of arrivals) {
        const chain = chainTo(by, module);
        found.push(`${root} loads ${one.what}: ${chain.join(" -> ")}. A registered hook pays for every `
          + `module on its path before it decides it has nothing to do, so the line to remove is the one `
          + `in ${chain.at(-2)} that imports ${module}. Move the binding the hook needs into a module of `
          + `its own — ${one.instead} — or declare this hook beside that target with the reason it is `
          + "right for it.");
      }
    }
  }
  return found;
};

/** Every finding the registration earns: a name no file answers, a verb's handler on a hook's path,
 *  and a declared heavy target on one. */
export const hookLoads = ({ edges, registration, files, verbs, read, heavy = HEAVY, at = "plugin/hooks" }) => {
  const { roots, unresolved } = hookRoots(registration, files, at);
  return [
    ...unresolved.map((name) => `${at}/hooks.json registers \`${name}\` and no file under ${at}/ or `
      + `${at}/gates/ answers that name, so this rule reads nothing of that hook's path. Name the file `
      + "the registration means, or take the name off the line."),
    ...roots.flatMap((root) => problems(edges, root, verbs, read)),
    ...heavyLoads(edges, roots, heavy),
  ];
};
