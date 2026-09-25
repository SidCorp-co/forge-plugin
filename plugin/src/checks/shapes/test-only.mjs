/* An export whose every importer is a test is a seam the product does not have: the case proves a
   function production never calls, or a twin of the one it does, and passes while the path users
   take goes unguarded (ISS-2502). `dead-exports.mjs` counts a test as a caller, which is right for
   what it asks and blind to this. The same graph, read twice: once whole, once with the tests out,
   and a name alive in the first and dead in the second is alive only for them. A name its own
   module reads is one production reaches, and a test importing it is proving a unit of that path.

   A rule checker under `plugin/src/checks/` is the exception by design: the case that runs it is
   the only caller it has. */
import { deadExports, exporting } from "../surface/dead-exports.mjs";
import { codeOf } from "../tracker-names.mjs";

export const CHECKERS = "plugin/src/checks/";

/** What counts as a test's file: anything under a `test` directory, and any `*.test.*` file. */
export const isTest = (path) => /(?:^|\/)test\//u.test(path) || /\.test\.[cm]?js$/u.test(path);

const held = (path) => exporting(path) && !path.startsWith(CHECKERS);

/* Whether a module reads its own export past the declaration: an export clause names a binding
   without reading it, so every clause is cut before the name is counted. */
const readsItself = (text, name) => {
  const code = codeOf(text).replace(/\bexport\s*\{[^}]*\}(?:\s*from\b)?/gu, "");
  const spelled = new RegExp(String.raw`(?<![\w$])${name.replace(/\$/gu, "\\$")}(?![\w$])`, "gu");
  return (code.match(spelled) ?? []).length > 1;
};

/** Each export of `plugin/src` or `plugin/hooks` that tests import and nothing else reads. */
export const testOnlyExports = (files, { loaded = [] } = {}) => {
  const key = ({ where, name }) => `${where}\0${name}`;
  const deadAnyway = new Set(deadExports(files, { exporter: held, loaded }).map(key));
  const product = new Map([...files].filter(([path]) => !isTest(path)));
  return deadExports(product, { exporter: held, loaded })
    .filter((one) => !deadAnyway.has(key(one)) && !readsItself(files.get(one.where), one.name));
};

export const testOnlyProblems = (found) => found.map(({ where, line, name }) =>
  `${where}:${line} exports \`${name}\`, and every file importing it is a test, so the case proves a `
  + "path the product never takes. Prove the behaviour through the production caller the export should "
  + "go through, and drop the `export`; or, where production should call it, call it there.");
