/* What one node process of a test step asked this repository for, loaded with `--import` into every
   process the step runs, and nothing at all where the gate named no directory. Patching the `fs`
   object does not reach `import { readFileSync } from "node:fs"`, which is how this repository
   imports it everywhere, so the builtins resolve to a module this generates. */

import { worded } from "./shell.mjs";

export const READS_DIR = "GATE_READS";
export const READS_ROOT = "GATE_READS_ROOT";
export const READS_TICKET = "GATE_READS_TICKET";

export const SHIMMED = new Set([
  "fs", "node:fs", "fs/promises", "node:fs/promises", "child_process", "node:child_process",
]);

const PREFIX = "gate-reads:";

/* Every export is classified and one classified nowhere blinds the file that called it, a name a
   later node adds being a read nobody sees otherwise: ASKS a path named in the call, asked for
   whatever the answer; LISTS the names in a directory, or all below it where the call says so; BUILDS
   a path taken on construction; NEITHER nothing a pass keys on, a descriptor having been asked for
   when it was opened and a write being no read. A wrapper carries what the export it replaces held —
   `realpathSync.native`, the promisify on `exists`, itself on `fs/promises.opendir` — once. */
const ASKS = new Set(["access", "accessSync", "copyFile", "copyFileSync", "createReadStream", "exists",
  "existsSync", "lstat", "lstatSync", "open", "openAsBlob", "openSync", "readFile", "readFileSync",
  "readlink", "readlinkSync", "realpath", "realpathSync", "stat", "statSync", "statfs", "statfsSync"]);

const LISTS = new Set(["opendir", "opendirSync", "readdir", "readdirSync"]);

// What these read was named by no argument of theirs, so nothing here can key a digest on it.
const BLIND = new Map([["glob", "a listing by pattern"], ["globSync", "a listing by pattern"],
  ["cp", "a tree copied whole"], ["cpSync", "a tree copied whole"],
  ["watch", "a watch on what changes"], ["watchFile", "a watch on what changes"]]);

const SPAWNS = new Set(["spawn", "spawnSync", "execFile", "execFileSync", "fork"]);

const SHELLS = new Set(["exec", "execSync"]);

// What the dynamic loader maps in before a program's own code runs.
const LOADER = /^(?:LD_|DYLD_)/u;

const BUILDS = new Set(["FileReadStream", "ReadStream"]);

const NEITHER = new Set([
  "Dir", "Dirent", "F_OK", "FileWriteStream", "R_OK", "Stats",
  "W_OK", "WriteStream", "X_OK", "_toUnixTimestamp", "ChildProcess", "_forkChild", "constants",
  "promises", "appendFile", "appendFileSync", "chmod", "chmodSync", "chown", "chownSync", "close",
  "closeSync", "createWriteStream", "fchmod", "fchmodSync", "fchown", "fchownSync", "fdatasync",
  "fdatasyncSync", "fstat", "fstatSync", "fsync", "fsyncSync", "ftruncate", "ftruncateSync",
  "futimes", "futimesSync", "lchmod", "lchmodSync", "lchown", "lchownSync", "link", "linkSync",
  "lutimes", "lutimesSync", "mkdir", "mkdirSync", "mkdtemp", "mkdtempSync", "read", "readSync",
  "readv", "readvSync", "rename", "renameSync", "rm", "rmSync", "rmdir", "rmdirSync", "symlink",
  "symlinkSync", "truncate", "truncateSync", "unlink", "unlinkSync", "unwatchFile", "utimes",
  "utimesSync", "write", "writeFile", "writeFileSync", "writeSync", "writev", "writevSync",
]);

export const CLASSIFIED = [ASKS, LISTS, new Set(BLIND.keys()), BUILDS, SPAWNS, SHELLS, NEITHER];

// The options argument of every spawning signature, and a fresh one where the call passed none.
export const optionsIn = (args) => {
  const after = [];
  const rest = [...args];
  while (rest.length > 1 && typeof rest.at(-1) === "function") after.unshift(rest.pop());
  const last = rest.at(-1);
  const has = rest.length > 1 && last !== null && typeof last === "object" && !Array.isArray(last);
  return { before: has ? rest.slice(0, -1) : rest, options: has ? last : {}, after };
};

const NAMED = /^[A-Za-z_$][\w$]*$/u;

const blinding = (key, from, why) => `blinded(${from}.${key}, ${JSON.stringify(`${key}: ${why}`)})`;

const wrapping = (key, from) => {
  if (ASKS.has(key)) return `asked(${from}.${key})`;
  if (LISTS.has(key)) return `listed(${from}.${key})`;
  if (BUILDS.has(key)) return `built(${from}.${key})`;
  if (BLIND.has(key)) return blinding(key, from, BLIND.get(key));
  if (SPAWNS.has(key)) return `spawns(${from}.${key})`;
  if (SHELLS.has(key)) return `shelled(${from}.${key})`;
  if (NEITHER.has(key)) return null;
  return typeof from === "string" ? blinding(key, from, "classified in no set of the audit's") : null;
};

// Generated and not written: a name this repository does not use today is a hole tomorrow.
export const shimSource = (name, real) => {
  const keys = Object.keys(real).filter((one) => NAMED.test(one));
  const out = [
    `const real = process.getBuiltinModule(${JSON.stringify(name)});`,
    `const audit = globalThis[Symbol.for("forge.gate.reads")];`,
    `const SKIP = new Set(["length", "name", "prototype", "caller", "arguments"]);`,
    `const carry = (made, from, wrap) => { for (const key of Reflect.ownKeys(from)) { if (SKIP.has(key)) continue;`
      + ` const held = from[key]; made[key] = typeof held === "function" ? wrap(held) : held; } return made; };`,
    `const wrapper = (make) => { const done = new WeakMap(); const wrap = (fn) => { if (done.has(fn)) return done.get(fn);`
      + ` const made = make(fn); done.set(fn, made); return carry(made, fn, wrap); }; return wrap; };`,
    `const asked = wrapper((fn) => function (one, ...rest) { audit.asked(one); return fn.apply(this, [one, ...rest]); });`,
    `const listed = wrapper((fn) => function (one, ...rest) { audit.listed(one, rest[0]); return fn.apply(this, [one, ...rest]); });`,
    `const built = (klass) => new Proxy(klass, {`
      + ` construct(one, args, at) { audit.asked(args[0]); return Reflect.construct(one, args, at); },`
      + ` apply(one, self, args) { audit.asked(args[0]); return Reflect.apply(one, self, args); } });`,
    `const spawns = (fn) => function (...args) { return fn.apply(this, audit.ticketed(args)); };`,
    `const shelled = (fn) => function (...args) { audit.shelled(args); return fn.apply(this, args); };`,
    `const blinded = (fn, why) => function (...args) { audit.blind(why); return fn.apply(this, args); };`,
  ];
  const nested = name === "node:fs" && real.promises ? Object.keys(real.promises).filter((one) => NAMED.test(one)) : [];
  if (nested.length > 0) {
    out.push(`const promises = { ...real.promises };`);
    for (const key of nested) {
      const how = wrapping(key, "real.promises");
      if (how) out.push(`promises.${key} = ${how};`);
    }
  }
  for (const key of keys) {
    if (key === "promises" && nested.length > 0) out.push(`export { promises };`);
    else out.push(`export const ${key} = ${wrapping(key, "real") ?? `real.${key}`};`);
  }
  out.push(`const held = { ...real };`);
  for (const key of keys) out.push(`held.${key} = ${key};`);
  out.push(`export default held;`);
  return out.join("\n");
};

const HERE = Symbol.for("forge.gate.reads");

// Once per process: a second audit would take the global the first writes its record through.
const start = (out, root) => {
  if (globalThis[HERE]) return;
  const { registerHooks } = process.getBuiltinModule("node:module");
  const { lstatSync, mkdirSync, readlinkSync, realpathSync, writeFileSync } = process.getBuiltinModule("node:fs");
  const { basename, dirname, isAbsolute, join, relative, resolve } = process.getBuiltinModule("node:path");
  const { fileURLToPath, pathToFileURL } = process.getBuiltinModule("node:url");

  const paths = new Set();
  const dirs = new Set();
  const trees = new Set();
  const spawned = [];
  const blind = new Set();
  let issued = 0;

  // What the ledger already declares itself blind to; counting it would spend every test on a fetch.
  const inside = (one) => {
    let named = one;
    if (named instanceof URL) named = fileURLToPath(named);
    if (Buffer.isBuffer(named)) named = named.toString("utf8");
    if (typeof named !== "string" || named.length === 0) return null;
    let abs;
    try {
      abs = isAbsolute(named) ? named : resolve(process.cwd(), named);
    } catch {
      return null;
    }
    const rel = relative(root, abs);
    if (rel.startsWith("..") || isAbsolute(rel)) return null;
    if (rel.startsWith("node_modules/") || rel === ".git" || rel.startsWith(".git/")) return null;
    // The root itself is a name a listing of the whole tree is keyed on, and `relative` gives it none.
    return rel === "" ? "." : rel;
  };

  const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;

  /* Where a path lands once its links are followed: the deepest part that is there, resolved, with
     what is not hung back on. Null is out of hops rather than out of this tree. */
  const placed = (one) => {
    const rest = [];
    let at = one;
    for (let hop = 0; hop < 32; hop += 1) {
      let link = null;
      try {
        return resolve(realpathSync(at), ...rest);
      } catch {
        link = lstatSync(at, { throwIfNoEntry: false })?.isSymbolicLink() ? readlinkSync(at) : null;
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

  // A path this tree names is its own wherever it points, and one this cannot place is not outside.
  const holds = (one) => {
    const at = placed(one);
    return inside(one) !== null || at === null || inside(at) !== null;
  };

  // Every directory a name with no slash is looked for in, one this cannot place standing as itself.
  const along = (env) => String(env.PATH ?? "").split(":")
    .map((one) => (one.startsWith("/") ? placed(one) : null));

  /* Whether the search path could answer out of this tree: a directory of it in here, or a name
     looked up along it that one of them holds — the program's own among them, and the line's. */
  const answering = (env, file, args) => {
    const dirs = along(env);
    if (dirs.some((one) => one === null || inside(one) !== null)) return true;
    const named = String(file);
    if (!/sh$/u.test(basename(named)) || String(args[0]) !== "-c") return false;
    return [named, ...(worded(String(args[1] ?? "")) ?? [])]
      .filter((one) => one.length > 0 && !one.includes("/"))
      .some((one) => dirs.some((dir) => holds(join(dir, one))));
  };

  /* What could stand behind a builtin's name or behind the program itself: an exported function, a
     startup file, a library the loader maps in. Over every enumerable name, node's own reading. */
  const renaming = (env) => {
    for (const key in env) {
      if (key.startsWith("BASH_FUNC_") || key === "BASH_ENV" || key === "ENV"
        || LOADER.test(key) || String(env[key] ?? "").startsWith("() {")) return true;
    }
    return false;
  };

  // `argv0` is what makes a shell a login shell, which reads a startup file before the line.
  const reading = (options, file, args) => {
    const env = options.env ?? process.env;
    const named = String(file);
    return {
      plain: !options.argv0,
      mine: named.includes("/") && holds(resolve(options.cwd ?? process.cwd(), named)),
      pathIn: answering(env, file, args),
      funcIn: renaming(env),
    };
  };

  const audit = {
    asked(one) {
      const rel = inside(one);
      if (rel) paths.add(rel);
    },
    // A walk of everything below is a different claim from the names in one directory.
    listed(one, how) {
      const rel = inside(one);
      if (rel) (how && how.recursive ? trees : dirs).add(rel);
    },
    blind(why) {
      blind.add(why);
    },
    shelled(args) {
      const { before, options } = optionsIn(args);
      const shell = String(options.shell ?? "sh");
      spawned.push({ ticket: null, shell, file: String(before[0]), args: [],
        cwd: options.cwd ?? process.cwd(), ...reading(options, shell, ["-c", String(before[0])]) });
    },
    /* A ticket and not the child's pid, `execFileSync` answering with its output and never a pid;
       and where it stood and what it was handed, which is what rules on a child that left no record. */
    ticketed(args) {
      const { before, options, after } = optionsIn(args);
      issued += 1;
      const mine = `${process.pid}-${issued}`;
      const handed = (Array.isArray(before[1]) ? before[1] : []).map(String);
      spawned.push({
        ticket: mine, file: String(before[0]), cwd: options.cwd ?? process.cwd(), args: handed,
        ...reading(options, before[0], handed), plain: !options.shell && !options.argv0,
      });
      return [...before, { ...options, env: { ...(options.env ?? process.env), [READS_TICKET]: mine } }, ...after];
    },
  };
  globalThis[HERE] = audit;

  /* This repository's own code and no one else's: `graceful-fs`, which npm loads, defines a property
     on the fs module object and a namespace has none to give. What a dependency reads for repository
     code is unseen here, beside node_modules, which the ledger already declares itself blind to. */
  const ours = (parent) => {
    const at = parent ?? entry;
    if (typeof at !== "string" || !at.startsWith("file:")) return false;
    const rel = inside(fileURLToPath(at));
    return rel !== null;
  };

  registerHooks({
    /* The candidate goes in before the resolution is attempted: an import that failed is recorded
       nowhere else, and a test passing on its fallback would answer for the file appearing. */
    resolve(specifier, context, next) {
      if (SHIMMED.has(specifier) && ours(context.parentURL)) {
        return { url: `${PREFIX}${specifier.replace("node:", "")}`, format: "module", shortCircuit: true };
      }
      const from = context.parentURL ?? entry;
      if (specifier.startsWith(".") && ours(from)) audit.asked(new URL(specifier, from));
      return next(specifier, context);
    },
    load(url, context, next) {
      if (url.startsWith(PREFIX)) {
        const name = `node:${url.slice(PREFIX.length)}`;
        return { format: "module", source: shimSource(name, process.getBuiltinModule(name)), shortCircuit: true };
      }
      if (url.startsWith("file:")) audit.asked(new URL(url));
      return next(url, context);
    },
  });

  if (process.argv[1]) audit.asked(process.argv[1]);

  // At exit: a process killed first leaves no record, and the ticket its parent holds answers for nothing.
  process.on("exit", () => {
    const mine = process.env[READS_TICKET] || null;
    try {
      mkdirSync(out, { recursive: true });
      writeFileSync(join(out, `${mine ?? `own-${process.pid}`}.json`), `${JSON.stringify({
        ticket: mine, argv: process.argv.slice(1), paths: [...paths].sort(),
        dirs: [...dirs].sort(), trees: [...trees].sort(), spawned, blind: [...blind], done: true,
      })}\n`);
    } catch {
      /* Nothing to report it to; the missing record is what spends the test file. */
    }
  });
};

const out = process.env[READS_DIR];
const root = process.env[READS_ROOT];
if (out && root) start(out, root);
