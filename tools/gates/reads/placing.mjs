/* Where a name the audit was handed stands against the one tree it keeps a ledger for, and what a
   child it was handed could have read of it. The builtins come off `getBuiltinModule` because this is
   what the shim asks; `contextOf` digests this file, so a claim widened here unseats every set. */
import { worded } from "./shell.mjs";

const { lstatSync, readlinkSync, realpathSync } = process.getBuiltinModule("node:fs");
const { basename, dirname, isAbsolute, join, relative, resolve } = process.getBuiltinModule("node:path");
const { fileURLToPath } = process.getBuiltinModule("node:url");

const LOADER = /^(?:LD_|DYLD_)/u;

export const absolute = (one, from = process.cwd()) => {
  let named = one;
  if (named instanceof URL) named = fileURLToPath(named);
  if (Buffer.isBuffer(named)) named = named.toString("utf8");
  if (typeof named !== "string" || named.length === 0) return null;
  try {
    return isAbsolute(named) ? named : resolve(from, named);
  } catch {
    return null;
  }
};

// What the ledger already declares itself blind to; counting it would spend every test on a fetch.
export const inside = (root, one) => {
  const abs = absolute(one);
  if (abs === null) return null;
  const rel = relative(root, abs);
  if (rel.startsWith("..") || isAbsolute(rel)) return null;
  if (rel.startsWith("node_modules/") || rel === ".git" || rel.startsWith(".git/")) return null;
  // The root itself is a name a listing of the whole tree is keyed on, and `relative` gives it none.
  return rel === "" ? "." : rel;
};

/* Where a path lands once its links are followed, the part not there hung back on; null is out of
   hops, and null where the probe is refused, a throw being the audit deciding what it measures. */
export const placed = (one) => {
  const rest = [];
  let at = one;
  for (let hop = 0; hop < 32; hop += 1) {
    let link = null;
    try {
      return resolve(realpathSync(at), ...rest);
    } catch {
      try {
        link = lstatSync(at, { throwIfNoEntry: false })?.isSymbolicLink() ? readlinkSync(at) : null;
      } catch {
        return null;
      }
    }
    if (link !== null) {
      at = resolve(dirname(at), link);
      continue;
    }
    const up = dirname(at);
    if (up === at) return resolve(one);
    rest.unshift(basename(at));
    at = up;
  }
  return null;
};

const holds = (root, one) => {
  const at = placed(one);
  return inside(root, one) !== null || at === null || inside(root, at) !== null;
};

/* Whether a subject `inside` discarded reaches this tree anyway: an ancestor reads it through itself,
   a name landing inside once its links are followed reads what it landed on, and one that cannot be
   placed might be either — `inside` judges the lexical name and never the alias (ISS-1760). */
export const over = (root, one) => {
  const abs = absolute(one);
  if (abs === null) return true;
  const at = placed(abs);
  if (at === null) return true;
  const rel = relative(at, root);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel)) || inside(root, at) !== null;
};

const roots = new Map();

/* Where a link lands when it lands in this tree, against the root's own resolved form so a checkout
   behind one is still its own tree: what reads through the link reads that, not its text (ISS-1760). */
export const linkInto = (root, one) => {
  if (!roots.has(root)) roots.set(root, placed(root) ?? root);
  const at = placed(one);
  return at === null ? null : inside(roots.get(root), at);
};

// A glob answers below its leading segments that stand for themselves; a character read as magic that was not widens it.
const MAGIC = /[*?[\]{}()!+@]/u;

export const prefixOf = (pattern) => {
  const held = [];
  for (const one of String(pattern).split("/").slice(0, -1)) {
    if (MAGIC.test(one)) break;
    held.push(one);
  }
  return held.length === 0 ? "." : held.join("/") || "/";
};

const answering = (root, env, file, args) => {
  const entries = String(env.PATH ?? "").split(":");
  if (entries.some((one) => !one.startsWith("/") || holds(root, one))) return true;
  const named = String(file);
  if (!/sh$/u.test(basename(named)) || String(args[0]) !== "-c") return false;
  return [named, ...(worded(String(args[1] ?? "")) ?? [])]
    .filter((one) => one.length > 0 && !one.includes("/"))
    .some((one) => entries.some((dir) => holds(root, join(dir, one))));
};

// What could stand behind a builtin's name or the program: a function, a startup file, a library the loader maps in.
const renaming = (env) => {
  for (const key in env) {
    if (key.startsWith("BASH_FUNC_") || key === "BASH_ENV" || key === "ENV"
      || LOADER.test(key) || String(env[key] ?? "").startsWith("() {")) return true;
  }
  return false;
};

// `argv0` is what makes a shell a login shell, which reads a startup file before the line.
export const reading = (root, options, file, args) => {
  const env = options.env ?? process.env;
  const named = String(file);
  return {
    plain: !options.argv0,
    mine: named.includes("/") && holds(root, resolve(options.cwd ?? process.cwd(), named)),
    pathIn: answering(root, env, file, args),
    funcIn: renaming(env),
  };
};
