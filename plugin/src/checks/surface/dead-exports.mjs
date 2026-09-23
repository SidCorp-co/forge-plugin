/* An export nobody imports passes `no-unused-vars`, which counts the `export` keyword as a read, so
   the same module took two of them in one release range after a review had removed three (ISS-114).
   Read over code with every comment, string and regex blanked, and the specifiers read back off the
   string spans, so an `import` spelled inside a sentence or a fixture is not an edge. */
import { dirname, join, normalize } from "node:path";

import { lineAt } from "../../markdown.mjs";
import { codeOf, quoted } from "../tracker-names.mjs";

const NAME = String.raw`[A-Za-z_$][\w$]*`;
const ONE_NAME = new RegExp(`^${NAME}$`, "u");
const DECLARED = new RegExp(String.raw`\bexport\s+(?:async\s+)?(?:function\s*\*?|class)\s*(${NAME})`, "gu");
const BOUND = /\bexport\s+(?:const|let|var)\s+/gu;
const LISTED = /\bexport\s*\{([^}]*)\}(\s*from\b)?/gu;
const STARRED = new RegExp(String.raw`\bexport\s*\*\s*(?:as\s+(${NAME})\s*)?from\b`, "gu");
const DEFAULTED = /\bexport\s+default\b/gu;
const STATIC = /\bimport\s+([^;()]*?)\s*from\b/gu;
const BARE = /\bimport\s*(?=\s["'])/gu;
const WORD = new RegExp(NAME, "gu");

/** Every name, which is what a namespace takes. */
const EVERY = "every";
/** The names the importing file spells, which is all a dynamic import or a path in a string says. */
const SPELLED = "spelled";

/** The string that opens next after `at`, provided nothing but space stands between. */
const specAfter = (spans, code, at) => {
  const next = spans.find((one) => one.from > at);
  return next && !/\S/u.test(code.slice(at, next.from - 1)) ? next : null;
};

/** The names one `{ a, b as c }` clause carries, each as the name it had and the name it takes. */
const clauseNames = (clause) => clause.split(",").map((one) => one.trim()).filter(Boolean)
  .map((one) => {
    const [had, took = had] = one.split(/\s+as\s+/u).map((part) => part.trim());
    return { had, took };
  });

/** The bracket-balanced pattern opening at `at`, so a nested destructuring is read whole. */
const balanced = (code, at) => {
  const close = code[at] === "{" ? "}" : "]";
  let depth = 0;
  for (let one = at; one < code.length; one += 1) {
    if (code[one] === code[at]) depth += 1;
    else if (code[one] === close && (depth -= 1) === 0) return code.slice(at + 1, one);
  }
  return code.slice(at + 1);
};

/** The parts of a pattern's inside split at its own `by`, never at a nested one: at its commas, or
 *  at the `=` a default opens, so a nested pattern holding a default of its own is kept whole. */
const topLevel = (inner, by = ",") => {
  const parts = [];
  let depth = 0;
  let from = 0;
  for (let at = 0; at < inner.length; at += 1) {
    if ("{[(".includes(inner[at])) depth += 1;
    else if ("}])".includes(inner[at])) depth -= 1;
    else if (inner[at] === by && depth === 0) {
      parts.push(inner.slice(from, at));
      from = at + 1;
    }
  }
  return [...parts, inner.slice(from)];
};

/** The names a declaration binds from `at`: one name, or every name a destructuring pattern takes. */
const bindingsAt = (code, at) => {
  if (code[at] !== "{" && code[at] !== "[") {
    const found = new RegExp(`^${NAME}`, "u").exec(code.slice(at));
    return found ? [found[0]] : [];
  }
  return topLevel(balanced(code, at)).flatMap((part) => {
    const held = topLevel(part, "=")[0].trim().replace(/^\.\.\./u, "");
    const colon = held.indexOf(":");
    const side = colon >= 0 && code[at] === "{" ? held.slice(colon + 1).trim() : held;
    if (/^[{[]/u.test(side)) return bindingsAt(side, 0);
    return ONE_NAME.test(side) ? [side] : [];
  });
};

/* Where a line break at depth 0 does not end the declaration: the line before it is left open by an
   operator or a comma, or the next one opens by continuing an expression. */
const CARRIES = /[=,([{+\-*/%&|^!?:<>~.]$/u;
const CONTINUES = /^[,.?:+\-*/%&|^=<>)\]}]/u;

/** Every declarator of one `export const a = …, b = …;` — the code having its strings blanked, a
 *  bracket counted here is a bracket — each start read by `bindingsAt`. */
const declaratorsAt = (code, at) => {
  const starts = [at];
  let depth = 0;
  for (let one = at; one < code.length; one += 1) {
    const held = code[one];
    if ("([{".includes(held)) depth += 1;
    else if (")]}".includes(held)) depth -= 1;
    else if (depth === 0 && held === ";") break;
    else if (depth === 0 && held === ",") starts.push(one + 1 + /^\s*/u.exec(code.slice(one + 1))[0].length);
    else if (depth === 0 && held === "\n" && !CARRIES.test(code.slice(at, one).trimEnd())
      && !CONTINUES.test(code.slice(one).trimStart())) break;
  }
  return starts.flatMap((start) => bindingsAt(code, start));
};

const exportedIn = (text, code) => {
  const out = [];
  const add = (name, index) => out.push({ name, line: lineAt(text, index) });
  for (const one of code.matchAll(DECLARED)) add(one[1], one.index);
  for (const one of code.matchAll(BOUND)) {
    for (const name of declaratorsAt(code, one.index + one[0].length)) add(name, one.index);
  }
  for (const one of code.matchAll(DEFAULTED)) add("default", one.index);
  for (const one of code.matchAll(STARRED)) if (one[1]) add(one[1], one.index);
  for (const one of code.matchAll(LISTED)) {
    for (const { took } of clauseNames(one[1])) add(took, one.index);
  }
  return out;
};

/** What a static clause takes: `default` for a default binding, each named one, or every name. */
const importedNames = (clause) => {
  if (/\*\s*as\s/u.test(clause)) return EVERY;
  const braced = /\{([^}]*)\}/u.exec(clause);
  const names = braced ? clauseNames(braced[1]).map(({ had }) => had) : [];
  const head = clause.replace(/\{[^}]*\}/u, "").split(",")[0].trim();
  return ONE_NAME.test(head) ? [...names, "default"] : names;
};

/** Every edge one file makes: a named import, a re-export, a star, and a whole module whose names
 *  the clause does not say — a dynamic import, or a path spelled in a string for one to reach. */
const edgesIn = (code, spans) => {
  const out = [];
  const clauses = new Set();
  const add = (at, names) => {
    const span = specAfter(spans, code, at);
    if (!span) return;
    clauses.add(span);
    out.push({ spec: span.held, names });
  };
  for (const one of code.matchAll(STATIC)) add(one.index + one[0].length, importedNames(one[1]));
  for (const one of code.matchAll(BARE)) add(one.index + one[0].length, []);
  for (const one of code.matchAll(LISTED)) {
    if (one[2]) add(one.index + one[0].length, clauseNames(one[1]).map(({ had }) => had));
  }
  for (const one of code.matchAll(STARRED)) add(one.index + one[0].length, { star: one[1] ?? null, line: one.index });
  for (const one of spans) if (!clauses.has(one)) out.push({ spec: one.held, names: SPELLED });
  return out;
};

/** One source read into what it exports, the edges it makes, and every name it spells. */
const moduleOf = (text) => {
  const source = String(text);
  const code = codeOf(source);
  const spans = quoted(source);
  const edges = edgesIn(code, spans).map((one) => (one.names?.line === undefined ? one
    : { ...one, names: { star: one.names.star, line: lineAt(source, one.names.line) } }));
  return { exports: exportedIn(source, code), edges, words: new Set(source.match(WORD)) };
};

/** The source a specifier reaches from `from`: relative to it, or rooted at the repository. */
const reached = (from, spec, files) => {
  const at = /^\.\.?\//u.test(spec) ? normalize(join(dirname(from), spec)) : spec;
  return files.has(at) ? at : null;
};

const starsOf = (read, files) => [...read].flatMap(([from, held]) => held.edges
  .filter(({ names }) => names?.line !== undefined)
  .map(({ spec, names }) => ({ from, to: reached(from, spec, files), ...names }))
  .filter(({ to }) => to && to !== from));

/** A barrel's `export *` is an export of every name its source has, `default` apart, at the star's
 *  own line, so a barrel nobody imports from is where the finding lands rather than nowhere. */
const starred = (read, stars) => {
  let grew = true;
  while (grew) {
    grew = false;
    for (const { from, to, line } of stars.filter((one) => one.star === null)) {
      const own = new Set(read.get(from).exports.map(({ name }) => name));
      for (const { name } of read.get(to).exports) {
        if (name === "default" || own.has(name)) continue;
        read.get(from).exports.push({ name, line });
        grew = true;
      }
    }
  }
};

/** What one edge takes of its target's names: a star re-export takes every name but `default` and
 *  hands the finding to the barrel, whose own export list the star has already grown. */
const tookOf = (names, theirs, words) => {
  if (names === EVERY) return theirs;
  if (names === SPELLED) return theirs.filter((one) => words.has(one));
  if (names.line !== undefined) return names.star === null ? theirs.filter((one) => one !== "default") : theirs;
  return names;
};

const takenBy = (read, files, loaded) => {
  const taken = new Map([...read.keys()].map((path) => [path, new Set()]));
  for (const [from, held] of read) {
    for (const { spec, names } of held.edges) {
      const target = reached(from, spec, files);
      if (!target || target === from) continue;
      const theirs = read.get(target).exports.map(({ name }) => name);
      for (const one of tookOf(names, theirs, held.words)) taken.get(target).add(one);
    }
  }
  for (const { where, names } of loaded) for (const one of names) taken.get(where)?.add(one);
  return taken;
};

/** The modules the rule holds: the CLI's source and the hooks, the vendored copy apart, which carries
 *  its own gate as `packages/code-quality/` does. */
export const exporting = (path) =>
  /^plugin\/(?:src|hooks)\//u.test(path) && !path.startsWith("plugin/hooks/vendor/");

/** Each export of a module `exporter` accepts that no file takes. `files` maps every path read to its
 *  text; `loaded` is what a loader reads off modules it reaches by a path it computes. */
export const deadExports = (files, { exporter, loaded = [] }) => {
  const read = new Map([...files].map(([path, text]) => [path, moduleOf(text)]));
  starred(read, starsOf(read, files));
  const taken = takenBy(read, files, loaded);
  return [...read].filter(([path]) => exporter(path)).flatMap(([path, held]) =>
    held.exports.filter(({ name }) => !taken.get(path).has(name)).map((one) => ({ where: path, ...one })));
};

export const deadExportProblems = (found) => found.map(({ where, line, name }) =>
  `${where}:${line} exports \`${name}\`, and no file in the repository imports it. Drop the \`export\` keyword, `
  + "and the binding too where nothing in its own file reads it; or import it in the module that was "
  + "meant to read it.");

/** The harness reads one name off each gate the registration names, by a path it computes, so that
 *  edge is read off the registration and the harness rather than off an import clause. */
const HARNESS = { loader: "plugin/hooks/_hook.mjs", reads: "run", under: "plugin/hooks/gates/" };

export const harnessLoads = (files, roots, harness = HARNESS) => {
  const code = codeOf(files.get(harness.loader) ?? "");
  if (!new RegExp(String.raw`\.${harness.reads}\(`, "u").test(code)) {
    throw new Error(`${harness.loader} no longer reads \`.${harness.reads}(\` off a gate, so the edge `
      + `plugin/src/checks/surface/dead-exports.mjs declares for every registered gate is not one the `
      + "harness makes. Correct HARNESS there to what the harness reads.");
  }
  return roots.filter((one) => one.startsWith(harness.under)).map((where) => ({ where, names: [harness.reads] }));
};
