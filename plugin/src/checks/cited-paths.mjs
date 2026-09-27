/* A path a comment or a clause names is a claim about this checkout that fails in silence: two
   citations outlived the moves that broke them, releases long, every gate green (ISS-154). Bare as
   well as spanned, which is why claims() saw neither; three bases, the third being the tail of a
   real path — a file named from further up, which this tree writes in a dozen places. */
import { posix } from "node:path";

import { LINK_TARGET_PATTERN, lineAt } from "../markdown.mjs";

const SOURCE = "(?:mjs|cjs|js|[jt]sx?|json|md|sql|ya?ml|sh|py|toml)";
const SEGMENT = "[\\w.@-]+";
const NAMED = new RegExp(`^(?:\\.\\.?/)?${SEGMENT}(?:/${SEGMENT})*\\.${SOURCE}$`, "u");

/* An extension used as a noun is not a path; a fragment is a place in a file; a lone filename is
   read only in a span or a link, R-19's line. Each end bounds it: `docs/a.md.bak` is not cut back to
   the `.md` that resolves, and none starts after a separator — `<project>/lib/x.ts` is another tree's. */
const A_NOUN = /^\.[\w.]+$/u;
const PLACE = /[#?].*$/u;
/* A `$` before it makes the token a template: `$DIR/src/cli.mjs` names a file of whichever copy
   was invoked, which no base here expands (ISS-197). */
const SHAPES = [
  new RegExp(`(?<![\\w.@/$-])((?:\\.\\.?/)?${SEGMENT}(?:/${SEGMENT})+\\.${SOURCE})`
    + "(?![\\w-])(?!\\.[\\w-])", "gu"),
  new RegExp("`(" + SEGMENT + "\\." + SOURCE + ")`", "gu"),
  new RegExp(LINK_TARGET_PATTERN, "gu"),
];

/* Only the bare shape can be a string literal; a span or a link is a claim however it is quoted. */
const QUOTES = new Set(["\"", "'"]);

export const citedIn = (text) => {
  const held = String(text ?? "");
  const found = SHAPES.flatMap((shape, which) =>
    [...held.matchAll(shape)].map(({ 1: path, index }) => ({
      path: path.replace(PLACE, ""),
      line: lineAt(held, index),
      quoted: which === 0 && QUOTES.has(held[index - 1]),
    })));
  const seen = new Set();
  return found
    .filter(({ path, line, quoted }) => {
      const key = `${line}\0${path}\0${quoted}`;
      if (seen.has(key) || !NAMED.test(path) || A_NOUN.test(path)) return false;
      seen.add(key);
      return true;
    })
    .sort((one, other) => one.line - other.line);
};

const names = (rel, path, tree, tails) =>
  tree.has(posix.join(posix.dirname(rel), path))
  || tree.has(posix.normalize(path))
  || tails.has(path);

/* A quoted string whose head is a package the caller names is what node resolves through
   node_modules, and node_modules is never part of the tree read; a head this tree also carries at its
   root stays a claim about the tree, so a package named like a directory hides nothing (ISS-197). */
const INSTALLED = "node_modules/";
const specifier = ({ path, quoted }, modules, roots) =>
  path.startsWith(INSTALLED)
  || (quoted && !roots.has(path.split("/")[0])
    && modules.some((name) => path === name || path.startsWith(`${name}/`)));

/** `paths` is the working tree and `modules` the packages it declares; the citing file is never its
 *  own candidate. */
export const problems = (files, paths, modules = []) => {
  const tree = new Set(paths);
  const roots = new Set(paths.map((one) => one.split("/")[0]));
  const tails = new Set();
  const byName = new Map();
  for (const one of paths) {
    const name = posix.basename(one);
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(one);
    const segments = one.split("/");
    for (let from = 1; from < segments.length; from += 1) tails.add(segments.slice(from).join("/"));
  }
  return files.flatMap(({ rel, text }) =>
    citedIn(text)
      .filter((one) => !specifier(one, modules, roots) && !names(rel, one.path, tree, tails))
      .map(({ path, line }) => {
        const elsewhere = (byName.get(posix.basename(path)) ?? []).filter((one) => one !== rel);
        const said = elsewhere.length
          ? `${elsewhere.join(" and ")} carr${elsewhere.length === 1 ? "ies" : "y"} that name: cite`
            + " the one meant, and cite it whole"
          : "and nothing here carries that name either: correct it, or delete the claim";
        return `${rel}:${line} cites ${path}, which names no file — not from ${posix.dirname(rel)},`
          + ` not from the repository root, and not as the tail of any path here. ${said}`;
      }));
};
