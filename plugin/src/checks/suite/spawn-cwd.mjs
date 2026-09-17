/* A git child that names no `cwd` inherits the test process's, which the gate sets to the checkout,
   so the temporary room it really worked in reaches the audit nowhere (ISS-1721). Reached: a call
   through any binding of `node:child_process` whose command is spelt `git`, over the mask the two
   rules beside this share — which treats a template whole, interpolations and all. */

import { lineAt } from "../../markdown.mjs";
import { blanked, closesAfter } from "./wall-clock.mjs";

const SPAWNS = ["spawnSync", "spawn", "execFileSync", "execFile", "execSync", "exec", "fork"];

const FROM = /import\s+([^;]+?)\s+from\s+["']node:child_process["']/gu;

const NAME = /^[A-Za-z_$][\w$]*$/u;

const spelt = (names) => [...names].map((one) => one.replace(/\$/gu, "\\$")).join("|");

const GIT = /^(["'`])git\1$/u;

const HELD = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\{/gu;

const KEY = /^(["']?)cwd\1/u;

/* A property that is `cwd`: the name off the text, so a quoted key is the key it spells, and what
   follows it off the mask, so a comment between the key and its colon is the space it became. */
const keys = (text, code, edge, end) => {
  const lead = code.slice(edge, end);
  const at = edge + lead.length - lead.trimStart().length;
  const token = KEY.exec(text.slice(at, end));
  return Boolean(token) && /^\s*(?::|$)/u.test(code.slice(at + token[0].length, end));
};

/** Every top-level piece of a bracketed list, as `[start, end)` into the text it was read from. */
export const piecesAt = (code, from) => {
  const out = [];
  let depth = 0;
  let edge = from + 1;
  for (let at = from; at < code.length; at += 1) {
    const one = code[at];
    if (one === "(" || one === "[" || one === "{") depth += 1;
    else if (one === ")" || one === "]" || one === "}") {
      depth -= 1;
      if (depth === 0) {
        out.push([edge, at]);
        return out;
      }
    } else if (one === "," && depth === 1) {
      out.push([edge, at]);
      edge = at + 1;
    }
  }
  return out;
};

/* The specifier is read off the text, being the one string this must see, and the keyword off the
   mask, so an import a fixture spells inside its own text binds nothing here. */
const namesIn = (text, code) => {
  const bare = new Set(SPAWNS);
  const held = new Set();
  for (const hit of text.matchAll(FROM)) {
    if (!code.startsWith("import", hit.index)) continue;
    const clause = hit[1].trim();
    const braces = /\{([^}]*)\}/u.exec(clause);
    for (const one of braces ? braces[1].split(",") : []) {
      const [was, alias] = one.split(/\s+as\s+/u).map((each) => each.trim());
      if (SPAWNS.includes(was) && NAME.test(alias ?? was)) bare.add(alias ?? was);
    }
    const star = /^\*\s+as\s+([A-Za-z_$][\w$]*)/u.exec(clause) ?? /^([A-Za-z_$][\w$]*)\s*(?:,|$)/u.exec(clause);
    if (star) held.add(star[1]);
  }
  return { bare, held };
};

const says = (rel, line) =>
  `${rel}:${line} spawns git without naming the directory it stands in, so the child inherits this `
  + `process's — which the gate sets to the checkout — and reaches() in tools/gates/reads/sets.mjs `
  + `has to read this file as able to have read anything in the tree, spending it on every gate run `
  + `whatever moved. Pass cwd: the room this git works in, which is the directory -C, init or the `
  + `clone target already names; or cwd: the checkout root where it really does read this `
  + `repository, which keeps the file blind and says so.`;

/* Any argument but the command may be the options, and a name standing for one is read where its
   own block declared it. */
const namesCwd = (text, code, args, objects, upto) => args.slice(1).some(([from, to]) => {
  const shape = code.slice(from, to).trim();
  const at = shape.startsWith("{") ? code.indexOf("{", from)
    : objects.filter((one) => one.name === shape && one.at < upto && upto < one.until).at(-1)?.at;
  return at !== undefined
    && piecesAt(code, at).some(([edge, end]) => keys(text, code, edge, end));
});

/** One refusal per git child in this file that names no cwd, at the line that spawns it. */
export const spawnsIn = (text, rel) => {
  const code = blanked(text);
  const { bare, held } = namesIn(text, code);
  const objects = [...code.matchAll(HELD)].map((one) =>
    ({ name: one[1], at: code.indexOf("{", one.index), until: closesAfter(code, one.index) }));
  const call = new RegExp(String.raw`(?<![.\w$])(?:(?:${spelt(held) || "\\0"})\s*\.\s*)?`
    + String.raw`(?:${spelt(bare)})\s*\(`, "gu");
  const found = [];
  for (const hit of code.matchAll(call)) {
    const args = piecesAt(code, hit.index + hit[0].length - 1);
    if (args.length === 0 || !GIT.test(text.slice(args[0][0], args[0][1]).trim())) continue;
    if (!namesCwd(text, code, args, objects, hit.index)) found.push(says(rel, lineAt(code, hit.index)));
  }
  return found;
};
