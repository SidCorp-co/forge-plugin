/* What one node process of a test step asked this repository for, loaded with `--import` into every
   process the step runs, and nothing at all where the gate named no directory. Patching the `fs`
   object does not reach `import { readFileSync } from "node:fs"`, which is how this repository
   imports it everywhere, so the builtins resolve to a module this generates. */

import { absolute, inside as insideOf, over as overOf, placed, placedUnder, prefixOf, reading }
  from "./placing.mjs";

export const READS_DIR = "GATE_READS";
export const READS_ROOT = "GATE_READS_ROOT";
export const READS_TICKET = "GATE_READS_TICKET";

// The preload `auditEnv` puts on a step's command line, in the spelling this file is imported under.
const PRELOAD = `--import=${import.meta.url}`;

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

/* Each of these names its subject in argument one, so what it read is the walk below that path and
   never the names in it: COPIES take the bytes, WATCHES depend on them, GLOBS answer with names
   chosen by them. What argument one leaves unestablished blinds at the call instead (ISS-1760). */
const COPIES = new Set(["cp", "cpSync"]);

const WATCHES = new Set(["watch", "watchFile"]);

const GLOBS = new Set(["glob", "globSync"]);

const SPAWNS = new Set(["spawn", "spawnSync", "execFile", "execFileSync", "fork"]);

const SHELLS = new Set(["exec", "execSync"]);

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

export const CLASSIFIED = [ASKS, LISTS, COPIES, WATCHES, GLOBS, BUILDS, SPAWNS, SHELLS, NEITHER];

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
  if (COPIES.has(key)) return `copied(${from}.${key}, ${JSON.stringify(key)})`;
  if (WATCHES.has(key)) return `watched(${from}.${key}, ${JSON.stringify(key)})`;
  if (GLOBS.has(key)) return `globbed(${from}.${key}, ${JSON.stringify(key)})`;
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
    `const copied = (fn, name) => function (one, ...rest) { audit.copied(one, rest[1], name); return fn.apply(this, [one, ...rest]); };`,
    `const watched = (fn, name) => function (one, ...rest) { audit.watched(one, name); return fn.apply(this, [one, ...rest]); };`,
    `const globbed = (fn, name) => function (one, ...rest) { audit.globbed(one, rest[0], name); return fn.apply(this, [one, ...rest]); };`,
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
  const { lstatSync, mkdirSync, writeFileSync } = process.getBuiltinModule("node:fs");
  const { join } = process.getBuiltinModule("node:path");
  const { fileURLToPath, pathToFileURL } = process.getBuiltinModule("node:url");

  const paths = new Set();
  const dirs = new Set();
  const trees = new Set();
  const whole = new Set();
  const spawned = [];
  const blind = new Set();
  let issued = 0;

  const inside = (one) => insideOf(root, one);
  /* Where a name came to rest, against the root's own placed form: judged lexically, a link a step
     makes inside its own claim spells any path into it. `at` is null where it can be placed nowhere,
     which blinds; `rel` where it rests outside this tree; the answer itself where it is no path. */
  const mine = placed(root) ?? root;
  const placing = (one, how = placed) => {
    const abs = absolute(one);
    if (abs === null) return null;
    const at = how(abs);
    if (at !== null) return { at, rel: insideOf(mine, at) };
    blind.add("a read whose links ran out of hops, so where it landed is unknown");
    return { at: null, rel: null };
  };
  const landed = (one) => placing(one)?.rel ?? null;
  const standsOver = (held) => held.at !== null && overOf(mine, held.at);

  const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;

  /* The audit's own three, carried into every child this tickets beside the ticket that already
     goes. A caller that curated a child's environment chose what that child reads its configuration
     from, and this is the gate's instrument rather than that subject: without it a test running the
     CLI under a `PATH`, a `HOME` and an `XDG_CONFIG_HOME` starts a child that records nothing, which
     blinds the file that spawned it and spends that file on every gate at every content (ISS-2119).
     The preload is appended rather than put in the caller's place, and left alone where the string
     is already there. A second spelling of the same module URL would be inert anyway, the loader
     evaluating one URL once, so what this holds is the one record and never the variable's shape. */
  const instrumented = (env) => {
    const named = env.NODE_OPTIONS ?? "";
    return { ...env, [READS_DIR]: out, [READS_ROOT]: root,
      NODE_OPTIONS: named.includes(PRELOAD) ? named : `${named} ${PRELOAD}`.trim() };
  };

  const audit = {
    asked(one) {
      const rel = landed(one);
      if (rel) paths.add(rel);
    },
    // A walk of everything below is a different claim from the names in one directory.
    listed(one, how) {
      const rel = landed(one);
      if (rel) (how && how.recursive ? trees : dirs).add(rel);
    },
    blind(why) {
      blind.add(why);
    },
    /* One told to follow its links reads a target no claim here models, and blinds. Left to itself
       `cp` keeps a link handed to it, so only one above the last component moved where it looked. */
    copied(one, how, name) {
      if (how !== null && typeof how === "object" && how.dereference) {
        blind.add(`${name}: a copy that follows its links`);
        return;
      }
      const held = placing(one, placedUnder);
      if (held === null) return;
      if (held.rel) whole.add(held.rel);
      else if (standsOver(held)) blind.add(`${name}: a copy of a tree this one stands under`);
    },
    /* Placement says where the watch went, a link at any component included; what it cannot say is
       that the watch answers for that target afterwards, so a directory's claim is the walk below. */
    watched(one, name) {
      const held = placing(one);
      if (held === null) return;
      if (!held.rel) {
        if (standsOver(held)) blind.add(`${name}: a watch on a tree this one stands under`);
        return;
      }
      let found;
      try {
        found = lstatSync(held.at, { throwIfNoEntry: false });
      } catch {
        found = undefined;
      }
      if (found?.isFile()) paths.add(held.rel);
      else whole.add(held.rel);
    },
    // The claim is the walk below the prefix, each entry's kind telling; one resting outside blinds.
    globbed(one, how, name) {
      const options = how !== null && typeof how === "object" && !Array.isArray(how) ? how : {};
      const from = absolute(options.cwd) ?? process.cwd();
      for (const pattern of Array.isArray(one) ? one : [one]) {
        const held = placing(absolute(prefixOf(pattern), from));
        if (held === null || held.at === null) continue;
        if (held.rel) whole.add(held.rel);
        else blind.add(`${name}: a listing by a pattern rooted outside this tree`);
      }
    },
    shelled(args) {
      const { before, options } = optionsIn(args);
      const shell = String(options.shell ?? "sh");
      spawned.push({ ticket: null, shell, file: String(before[0]), args: [],
        cwd: options.cwd ?? process.cwd(), ...reading(root, options, shell, ["-c", String(before[0])]) });
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
        ...reading(root, options, before[0], handed), plain: !options.shell && !options.argv0,
      });
      const env = instrumented({ ...(options.env ?? process.env), [READS_TICKET]: mine });
      return [...before, { ...options, env }, ...after];
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
        dirs: [...dirs].sort(), trees: [...trees].sort(), whole: [...whole].sort(),
        spawned, blind: [...blind], done: true,
      })}\n`);
    } catch {
      /* Nothing to report it to; the missing record is what spends the test file. */
    }
  });
};

const out = process.env[READS_DIR];
const root = process.env[READS_ROOT];
if (out && root) start(out, root);
