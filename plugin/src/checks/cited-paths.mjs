/* A path a comment or a clause names is a claim about this checkout that fails in silence: two
   citations outlived the moves that broke them, releases long, every gate green (ISS-154). Bare as
   well as spanned, which is why claims() saw neither; three bases, the third being the tail of a
   real path — a file named from further up, which this tree writes in a dozen places. */
import { posix } from "node:path";

import { LINK_TARGET_PATTERN } from "../markdown.mjs";

const SOURCE = "(?:mjs|cjs|js|[jt]sx?|json|md|sql|ya?ml|sh|py|toml)";
const SEGMENT = "[\\w.@-]+";
const NAMED = new RegExp(`^(?:\\.\\.?/)?${SEGMENT}(?:/${SEGMENT})*\\.${SOURCE}$`, "u");

/* An extension used as a noun is not a path; a fragment is a place in a file. A lone filename is
   read only in a span or a link target, R-19's line. The right boundary is the whole of it, or
   `docs/a.md.bak` reads as `docs/a.md` and a citation of no file passes on a prefix of one. */
const A_NOUN = /^\.[\w.]+$/u;
const PLACE = /[#?].*$/u;
const SHAPES = [
  new RegExp(`(?<![\\w.@/-])((?:\\.\\.?/)?${SEGMENT}(?:/${SEGMENT})+\\.${SOURCE})`
    + "(?![\\w-])(?!\\.[\\w-])", "gu"),
  new RegExp("`(" + SEGMENT + "\\." + SOURCE + ")`", "gu"),
  new RegExp(LINK_TARGET_PATTERN, "gu"),
];

const lineAt = (text, index) => text.slice(0, index).split("\n").length;
const base = (path) => posix.basename(path.replace(/\/$/u, ""));

export const citedIn = (text) => {
  const held = String(text ?? "");
  const found = SHAPES.flatMap((shape) =>
    [...held.matchAll(shape)].map(({ 1: path, index }) =>
      ({ path: path.replace(PLACE, ""), line: lineAt(held, index) })));
  const seen = new Set();
  return found
    .filter(({ path, line }) => {
      const key = `${line}\0${path}`;
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

/** `paths` is the working tree; the citing file is never its own candidate. */
export const problems = (files, paths) => {
  const tree = new Set(paths);
  const tails = new Set();
  const byName = new Map();
  for (const one of paths) {
    if (!byName.has(base(one))) byName.set(base(one), []);
    byName.get(base(one)).push(one);
    const segments = one.split("/");
    for (let from = 1; from < segments.length; from += 1) tails.add(segments.slice(from).join("/"));
  }
  return files.flatMap(({ rel, text }) =>
    citedIn(text)
      .filter(({ path }) => !names(rel, path, tree, tails))
      .map(({ path, line }) => {
        const elsewhere = (byName.get(base(path)) ?? []).filter((one) => one !== rel);
        const said = elsewhere.length
          ? `${elsewhere.join(" and ")} carr${elsewhere.length === 1 ? "ies" : "y"} that name: cite`
            + " the one meant, and cite it whole"
          : "and nothing here carries that name either: correct it, or delete the claim";
        return `${rel}:${line} cites ${path}, which names no file — not from ${posix.dirname(rel)},`
          + ` not from the repository root, and not as the tail of any path here. ${said}`;
      }));
};
