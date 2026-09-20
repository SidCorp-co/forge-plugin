/* A checker whose population is derived from one file's text looks exactly like a clean repository
   when the derivation stops matching, so what the walk reaches is asserted before anything is
   asserted about the tree. The mutation cases below are the ones that would go green if the checker
   were deleted: each is a graph this CLI could have and the rule refuses (ISS-1775). */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import {
  HEAVY,
  graphOf,
  heavyLoads,
  hookLoads,
  hookRoots,
  importsIn,
  problems,
  reachedFrom,
  takesFrom,
  verbModules,
} from "../../../src/checks/surface/eager-load.mjs";

const ROOT = new URL("../../../..", import.meta.url).pathname;
const ENTRY = "plugin/src/cli.mjs";
const TABLE = "plugin/src/commands.mjs";

const walked = (dir) => readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((one) =>
  (one.isDirectory()
    ? walked(join(dir, one.name))
    : (/\.(mjs|js)$/u.test(one.name) ? [relative(ROOT, join(ROOT, dir, one.name))] : [])));

const FILES = ["plugin/src", "plugin/hooks", "tools"].flatMap((one) => walked(one));
const read = (one) => readFileSync(join(ROOT, one), "utf8");
const EDGES = graphOf(ROOT, FILES);
const VERBS = verbModules(read(TABLE));

test("the walk reaches the tree and the table names the verbs it dispatches", () => {
  assert.ok(FILES.length > 250, `${FILES.length} file(s) walked; the selector matches too little`);
  assert.ok(EDGES.get(ENTRY).includes(TABLE), "the entry's own edge to the table is unread");
  assert.ok(VERBS.size > 12, `${VERBS.size} verb module(s) derived from the table; the loader shape moved`);
  assert.equal(VERBS.get("plugin/src/codex/codex.mjs"), "codex");
});

test("the entry loads no verb's handler, and the leaf the campaign measures is not on its path", () => {
  const found = problems(EDGES, ENTRY, VERBS, read);
  assert.deepEqual(found, [], found.join("\n"));
  const by = reachedFrom(EDGES, ENTRY);
  const chain = (one) => {
    const held = [];
    for (let at = one; at; at = by.get(at)) held.unshift(at);
    return held.join(" <- ");
  };
  const leaf = "plugin/src/stats/median.mjs";
  assert.ok(!by.has(leaf), `the entry reaches ${leaf}: ${chain(leaf)}`);
});

const GRAPH = new Map([
  ["plugin/src/cli.mjs", ["plugin/src/commands.mjs"]],
  ["plugin/src/commands.mjs", ["plugin/src/beside.mjs"]],
  ["plugin/src/beside.mjs", ["plugin/src/codex/codex.mjs"]],
  ["plugin/src/codex/codex.mjs", []],
]);
const TEXTS = {
  "plugin/src/cli.mjs": 'import { commands } from "./commands.mjs";\n',
  "plugin/src/commands.mjs": '  codex: loads("./codex/codex.mjs", "codex"),\n'
    + 'import { beside } from "./beside.mjs";\n',
  "plugin/src/beside.mjs": 'import { codex } from "./codex/codex.mjs";\n',
};
const said = (texts = TEXTS, graph = GRAPH) =>
  problems(graph, "plugin/src/cli.mjs", verbModules(texts["plugin/src/commands.mjs"]),
    (one) => texts[one] ?? "");

test("a handler imported anywhere the entry reaches is one finding, naming the module and the edge", () => {
  const found = said();
  assert.equal(found.length, 1, `one finding, not ${found.length}`);
  assert.match(found[0], /loads the `codex` handler/u);
  assert.match(found[0], /plugin\/src\/beside\.mjs imports it from plugin\/src\/codex\/codex\.mjs/u,
    "the finding names the edge somebody wrote, not the whole chain");
});

test("a handler import is read behind a helper-only one that reached the module first", () => {
  const graph = new Map([...GRAPH,
    ["plugin/src/commands.mjs", ["plugin/src/helper.mjs", "plugin/src/beside.mjs"]],
    ["plugin/src/helper.mjs", ["plugin/src/codex/codex.mjs"]]]);
  const texts = { ...TEXTS,
    "plugin/src/commands.mjs": `${TEXTS["plugin/src/commands.mjs"]}import { held } from "./helper.mjs";\n`,
    "plugin/src/helper.mjs": 'import { repoRoot } from "./codex/codex.mjs";\n' };
  assert.equal(said(texts, graph).length, 1,
    "the edge that took the handler is behind the one a walk arrived by, and is read all the same");
});

test("what the same module is imported for decides it, and a namespace takes everything", () => {
  assert.deepEqual(said({ ...TEXTS, "plugin/src/beside.mjs": 'import { repoRoot } from "./codex/codex.mjs";\n' }),
    [], "a binding that is not the handler is another rule's subject");
  assert.equal(said({ ...TEXTS, "plugin/src/beside.mjs": 'import * as held from "./codex/codex.mjs";\n' }).length,
    1, "a namespace binding takes the handler with everything else");
  assert.deepEqual(said(TEXTS, new Map([...GRAPH, ["plugin/src/commands.mjs", []]])),
    [], "and a module the entry never reaches is nothing to this rule");
});

test("a relative specifier is read whichever shape it is written in, and a lazy one is not", () => {
  assert.deepEqual(importsIn('import { a } from "./one.mjs";\n'), ["./one.mjs"]);
  assert.deepEqual(importsIn('import {\n  a,\n  b,\n} from "../two.mjs";\n'), ["../two.mjs"],
    "an import broken over lines is one the loader still resolves");
  assert.deepEqual(importsIn('export { a } from "./three.mjs";\n'), ["./three.mjs"],
    "a re-export resolves the module it re-exports");
  assert.deepEqual(importsIn('import "./four.mjs";\n'), ["./four.mjs"],
    "and one imported for its effect alone");
  assert.deepEqual(importsIn('const held = await import("./five.mjs");\n'), [],
    "a dynamic import is what this rule asks for, so it is no edge of the graph");
  assert.deepEqual(importsIn('import { a } from "node:fs";\n'), [], "and nothing outside this tree");
});

test("a binding is read as a word, so a name inside another name is not it", () => {
  assert.equal(takesFrom('import { codexOwed } from "./codex/codex.mjs";\n', "/codex.mjs", "codex"), false);
  assert.equal(takesFrom('import { held, codex } from "./codex/codex.mjs";\n', "/codex.mjs", "codex"), true);
  assert.equal(takesFrom('import { codex as held } from "./codex/codex.mjs";\n', "/codex.mjs", "codex"), true,
    "renamed on the way in is still the handler on this side of it");
  assert.equal(takesFrom('import { codex } from "./other.mjs";\n', "/codex.mjs", "codex"), false);
});

/* The hook half. The real-tree case is the one that goes red when a hook's path gains a subsystem it
   never touches, which is what it was watched doing before the three edges of ISS-1904 were cut; the
   synthetic ones are the graphs this plugin could have, since a tree with nothing wrong in it cannot
   tell a rule that refuses from a rule that is not looking. */
const REGISTRATION = () => read("plugin/hooks/hooks.json");

test("every hook the registration names is a root, and the walk reaches all of them", () => {
  const { roots, unresolved } = hookRoots(REGISTRATION(), FILES);
  assert.deepEqual(unresolved, [], "a registered name no file answers leaves that hook's path unread");
  assert.ok(roots.length > 12, `${roots.length} root(s) off hooks.json; the registration's shape moved`);
  assert.ok(roots.includes("plugin/hooks/gates/turn/stop-check.mjs"), "a gate in a folder of its own resolves");
  assert.ok(roots.includes("plugin/hooks/link-cli.mjs"), "the session-start script is registered too");
  for (const one of roots) assert.ok(EDGES.has(one), `${one} is registered and is not in the walk`);
  assert.ok(roots.some((one) => (EDGES.get(one) ?? []).includes("plugin/hooks/_hook.mjs")),
    "the harness is on a root's own edges, so what it imports is read by this rule");
});

test("every declared heavy target is a module in this tree, and every allowance names a root", () => {
  const { roots } = hookRoots(REGISTRATION(), FILES);
  for (const one of HEAVY) {
    assert.ok(FILES.some((file) => file === one.target || file.startsWith(one.target)),
      `${one.target} is declared heavy and names nothing in the tree, so it refuses nothing`);
    for (const [root, why] of Object.entries(one.allowed)) {
      assert.ok(roots.includes(root), `${one.target} is allowed for ${root}, which no registration names`);
      assert.ok(why.length > 20, `${root} is allowed ${one.target} with no reason on the record`);
    }
  }
});

test("no registered hook loads a verb's handler or a module declared heavy", () => {
  const found = hookLoads({ edges: EDGES, registration: REGISTRATION(), files: FILES, verbs: VERBS, read });
  assert.deepEqual(found, [], found.join("\n"));
});

const GATE = "plugin/hooks/gates/one.mjs";
const HARNESS = "plugin/hooks/_hook.mjs";
const LOG = "plugin/src/hooks/log/hook-log.mjs";
const HOOK_GRAPH = new Map([
  [GATE, [HARNESS]],
  [HARNESS, [LOG]],
  [LOG, []],
]);
const DECLARED = [{ target: LOG, what: "the log's verb", instead: "the writer is its own module", allowed: {} }];

test("a heavy target on a hook's path is one finding naming the root, the chain and the line to remove", () => {
  const found = heavyLoads(HOOK_GRAPH, [GATE], DECLARED);
  assert.equal(found.length, 1, `one finding, not ${found.length}`);
  assert.match(found[0], /^plugin\/hooks\/gates\/one\.mjs loads the log's verb/u);
  assert.match(found[0], new RegExp(`${GATE} -> ${HARNESS} -> ${LOG}`.replaceAll("/", String.raw`\/`), "u"),
    "the chain, because a module reached is a line somebody wrote and the reader has to be told which");
  assert.match(found[0], /the line to remove is the one in plugin\/hooks\/_hook\.mjs that imports/u,
    "the edge somebody wrote, not the root that pays for it");
});

test("a target is allowed for the hook it is declared for, and for no other", () => {
  const allowed = [{ ...DECLARED[0], allowed: { [GATE]: "this gate's whole subject is the log it prints" } }];
  assert.deepEqual(heavyLoads(HOOK_GRAPH, [GATE], allowed), [], "the hook the target was declared for");
  const other = "plugin/hooks/gates/two.mjs";
  assert.equal(heavyLoads(new Map([...HOOK_GRAPH, [other, [HARNESS]]]), [other], allowed).length, 1,
    "and the same target still refused for the hook nobody declared");
});

test("a target declared as a directory catches every module under it", () => {
  const graph = new Map([[GATE, ["plugin/src/spec/tree.mjs"]], ["plugin/src/spec/tree.mjs", []]]);
  const held = [{ target: "plugin/src/spec/", what: "the requirements tree", instead: "read it beside itself", allowed: {} }];
  assert.equal(heavyLoads(graph, [GATE], held).length, 1, "the prefix is the subsystem, not one of its files");
});

test("a registered gate name no file answers is a finding, and the roots that did resolve are still read", () => {
  const registration = JSON.stringify({ hooks: { PreToolUse: [{ hooks: [
    { command: 'node "${CLAUDE_PLUGIN_ROOT}"/hooks/gate.mjs pre one absent' },
  ] }] } });
  const files = [GATE, HARNESS, LOG];
  const { roots, unresolved } = hookRoots(registration, files);
  assert.deepEqual(roots, [GATE], "the gate that resolved is a root all the same");
  assert.deepEqual(unresolved, ["absent", "gate"], "and the clock word is no gate name, so `pre` is not among them");
  const found = hookLoads({ edges: HOOK_GRAPH, registration, files, verbs: new Map(), read, heavy: DECLARED });
  assert.equal(found.length, 3, `the two names and the edge, not ${found.length}`);
  assert.match(found[0], /registers `absent` and no file/u);
});
