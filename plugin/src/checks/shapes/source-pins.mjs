/* A test that reads a module's source and matches its text breaks on a rename that changes no
   behaviour, and keeps passing while the behaviour it meant goes wrong in a way the text still
   spells (ISS-2502). A rule checker does this by design, which is why `plugin/test/checks/` is not
   walked; everywhere else the behaviour is what a case proves, through the module's entry point.
   A match naming a banned module or global — no environment read in a module, no `node:fs` import —
   is an architecture rule and survives any rename, so it is not a pin. One naming a local, an
   imported one included, is.

   Reached: a `readFileSync` or `readFile` whose path resolves, through `new URL(…, import.meta.url)`,
   `join`, `resolve`, `dirname` and the constants the same file declares, under `plugin/src` or
   `plugin/hooks`; and a match on what it read, inline or through the name it was bound to while
   that binding is in scope. A path built out of anything else is out of this reading's reach. */

import { dirname, join, normalize } from "node:path";

import { lineAt } from "../../markdown.mjs";
import { blanked, closesAfter, spansIn } from "../suite/wall-clock.mjs";
import { argumentsAt } from "./calls.mjs";

const NAME = String.raw`[A-Za-z_$][\w$]*`;
const ONE_NAME = new RegExp(`^${NAME}$`, "u");

export const EXEMPT = "plugin/test/checks/";
const PINNED = /^plugin\/(?:src|hooks)\/(?!.*\.md$)/u;

/* The runtime's own names: a text match on one reads the same after any rename in the module. */
const GLOBALS = ["process", "globalThis", "console", "Date", "Math", "JSON", "Buffer", "fetch", "setTimeout",
  "setInterval", "clearTimeout", "require", "performance", "structuredClone", "AbortController"];
const RULE = new RegExp(String.raw`node:|(?<![\w$.])(?:${GLOBALS.join("|")})\b`, "u");

const READ = /(?<![\w$.])(?:readFileSync|readFile)\s*\(/gu;

const escapedName = (name) => name.replace(/\$/gu, "\\$");

/** A string literal's text, cut at its first interpolation, which is then `partial`. */
const unquoted = (held) => {
  const one = /^(["'`])([\s\S]*)\1$/u.exec(held.trim());
  if (!one) return null;
  const partial = one[1] === "`" && one[2].includes("${");
  return { text: partial ? one[2].split("${")[0] : one[2], partial };
};

/** Where the statement opening at `from` ends: a `;` or a line break outside every bracket, a break
 *  before a line continuing the expression apart. */
const statementEnd = (code, from) => {
  let depth = 0;
  for (let at = from; at < code.length; at += 1) {
    if ("([{".includes(code[at])) depth += 1;
    else if (")]}".includes(code[at])) {
      if (depth === 0) return at;
      depth -= 1;
    } else if (depth === 0 && (code[at] === ";" || (code[at] === "\n" && !/^\s*[.?:+|&,]/u.test(code.slice(at + 1))))) return at;
  }
  return code.length;
};

/** The source text a name was last declared with before `at`. */
const declaredAs = (ctx, name, at) => {
  let found = null;
  for (const one of ctx.code.matchAll(new RegExp(String.raw`\b(?:const|let|var)\s+${escapedName(name)}\s*=\s*`, "gu"))) {
    if (one.index >= at) break;
    const from = one.index + one[0].length;
    found = ctx.text.slice(from, statementEnd(ctx.code, from)).trim();
  }
  return found;
};

const CALL = /^(new\s+URL|(?:path\.)?(?:join|resolve|dirname)|fileURLToPath)\s*\(/u;

/** The repository path an expression resolves to, as far as text can say: `{ path, partial }`, or
 *  null where some part of it is out of reach. */
const resolvePath = (expr, ctx, depth = 0) => {
  if (depth > 6) return null;
  const held = expr.trim().replace(/\.pathname$/u, "");
  const quoted = unquoted(held);
  if (quoted) return quoted.text.startsWith(".") ? null : { path: normalize(quoted.text), partial: quoted.partial };
  if (/^(?:import\.meta\.url|fileURLToPath\(\s*import\.meta\.url\s*\))$/u.test(held)) return { path: ctx.rel, partial: false };
  const call = CALL.exec(held);
  if (call) {
    const code = blanked(held);
    const { args, close } = argumentsAt(code, call[0].length - 1);
    if (/\S/u.test(code.slice(close + 1))) return null;
    const parts = args.map(({ from, to }) => held.slice(from, to).trim());
    return resolveCall(call[1].replace(/^path\./u, "").replace(/\s+/u, " "), parts, ctx, depth);
  }
  if (!ONE_NAME.test(held)) return null;
  const declared = declaredAs(ctx, held, ctx.at);
  return declared === null ? null : resolvePath(declared, ctx, depth + 1);
};

const resolveCall = (callee, parts, ctx, depth) => {
  if (callee === "fileURLToPath") return parts.length === 1 ? resolvePath(parts[0], ctx, depth + 1) : null;
  if (callee === "dirname") {
    const inner = parts.length === 1 ? resolvePath(parts[0], ctx, depth + 1) : null;
    return inner && !inner.partial ? { path: dirname(inner.path), partial: false } : null;
  }
  if (callee === "new URL") {
    const relative = parts.length === 2 && /^import\.meta\.url$/u.test(parts[1]) ? unquoted(parts[0]) : null;
    return relative ? { path: normalize(join(dirname(ctx.rel), relative.text)), partial: relative.partial } : null;
  }
  const head = parts.length > 0 ? resolvePath(parts[0], ctx, depth + 1) : null;
  if (!head || head.partial) return null;
  let path = head.path;
  for (const part of parts.slice(1)) {
    const next = unquoted(part) ?? (ONE_NAME.test(part) ? resolvePath(part, ctx, depth + 1) : null);
    if (!next) return { path, partial: true };
    path = join(path, next.text ?? next.path);
    if (next.partial) return { path, partial: true };
  }
  return { path: normalize(path), partial: false };
};

const pinned = (found) => Boolean(found) && !found.path.startsWith("..")
  && PINNED.test(found.partial && /^plugin\/(?:src|hooks)$/u.test(found.path) ? `${found.path}/` : found.path);

/** The name a read's statement binds — `const name = …read…` — and how far that binding answers. */
const boundAt = (code, at) => {
  const opens = code.slice(0, at).match(new RegExp(String.raw`\b(?:const|let|var)\s+(${NAME})\s*=[^;]*$`, "u"));
  if (!opens) return null;
  const from = at - opens[0].length;
  return { name: opens[1], from, until: closesAfter(code, from) };
};

/** The expression standing right before `at`: a regex literal, or a chain of names, calls and indexes. */
const operandBefore = (text, code, at, regexes) => {
  const regex = regexes.find((one) => one.to < at && /^[a-z]*$/u.test(text.slice(one.to + 1, at)));
  if (regex) return { from: regex.from - 1, to: at };
  let edge = at;
  while (edge > 0) {
    if (")]".includes(code[edge - 1])) {
      const close = code[edge - 1];
      const open = close === ")" ? "(" : "[";
      let depth = 0;
      do {
        edge -= 1;
        depth += code[edge] === close ? 1 : (code[edge] === open ? -1 : 0);
      } while (edge > 0 && depth !== 0);
    } else if (/[\w$.]/u.test(code[edge - 1])) edge -= 1;
    else break;
  }
  return { from: edge, to: at };
};

/* The calls that match text: an assert taking the text first, and a method of the text or, for
   `test` alone, of the pattern. */
const MATCHERS = new RegExp(String.raw`\bassert\.(?:match|doesNotMatch)\s*\(|\.(includes|match|matchAll|search|indexOf|lastIndexOf|startsWith|endsWith|test)\s*\(`, "gu");

/** Each match whose text a read of a pinned source produced, with the pattern's own text. */
const matchesOn = (text, code, holders, inline) => {
  const regexes = spansIn(text).filter((one) => one.kind === "regex");
  const carries = (span) => {
    if (!span) return false;
    const lead = span.from + code.slice(span.from, span.to).search(/\S/u);
    return holders.some((one) => one.from < lead && lead < one.until
      && new RegExp(String.raw`^${escapedName(one.name)}(?![\w$])`, "u").test(code.slice(lead, span.to)))
      || inline.some((one) => span.from <= one.from && one.to <= span.to);
  };
  const said = ({ from, to }) => text.slice(from, to).trim();
  const out = [];
  for (const one of code.matchAll(MATCHERS)) {
    const { args } = argumentsAt(code, one.index + one[0].length - 1);
    if (!one[1]) {
      if (args[1] && carries(args[0])) out.push({ at: one.index, pattern: said(args[1]) });
      continue;
    }
    const object = operandBefore(text, code, one.index, regexes);
    if (one[1] === "test" && carries(args[0])) out.push({ at: object.from, pattern: said(object) });
    else if (one[1] !== "test" && args[0] && carries(object)) out.push({ at: object.from, pattern: said(args[0]) });
  }
  return out;
};

/** Every match of a pinned source's text in one test file outside the rule checkers, a pattern held
 *  in a constant being judged by what the constant says. */
export const pinsIn = (text, rel) => {
  if (rel.startsWith(EXEMPT)) return [];
  const code = blanked(text);
  const holders = [];
  const inline = [];
  for (const one of code.matchAll(READ)) {
    const open = one.index + one[0].length - 1;
    const { args, close } = argumentsAt(code, open);
    const first = args[0] ? text.slice(args[0].from, args[0].to) : null;
    if (!first || !pinned(resolvePath(first, { rel, text, code, at: one.index }))) continue;
    const bound = boundAt(code, one.index);
    if (bound) holders.push(bound);
    else inline.push({ from: one.index, to: close + 1 });
  }
  if (holders.length === 0 && inline.length === 0) return [];
  const ctx = { text, code };
  return matchesOn(text, code, holders, inline)
    .filter(({ pattern }) => !RULE.test(ONE_NAME.test(pattern) ? declaredAs(ctx, pattern, code.length) ?? pattern : pattern))
    .map(({ at, pattern }) => ({ where: rel, line: lineAt(code, at), pattern: pattern.replace(/\s+/gu, " ").slice(0, 80) }));
};

export const pinProblems = (found) => found.map(({ where, line, pattern }) =>
  `${where}:${line} matches the text of a module under plugin/src or plugin/hooks with ${pattern}, which a `
  + "rename that changes no behaviour breaks and a regression the text still spells passes. Prove the "
  + "behaviour through the module's public entry point instead; a rule over every module's text belongs "
  + `under ${EXEMPT}.`);
