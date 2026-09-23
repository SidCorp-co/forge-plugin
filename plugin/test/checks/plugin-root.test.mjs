/* The constant is read against the directory it has to name, and the checker against the source
   tree it guards, so a wrong depth fails here rather than as a scatter of suite failures (ISS-52). */
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { ROOT_MODULE, countedUp, problems } from "../../src/checks/plugin-root.mjs";
import { PLUGIN_ROOT } from "../../src/tools/plugin-copy.mjs";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..");

const walk = (dir, at) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((one) => {
    if (one.isDirectory()) return walk(join(dir, one.name), `${at}/${one.name}`);
    return one.name.endsWith(".mjs") ? [{ rel: `${at}/${one.name}`, text: readFileSync(join(dir, one.name), "utf8") }] : [];
  });

const said = (text, rel = "plugin/src/some/where.mjs") => countedUp({ rel, text });

test("the plugin root is the directory holding the plugin manifest, and it is this checkout's plugin", () => {
  assert.ok(existsSync(join(PLUGIN_ROOT, ".claude-plugin", "plugin.json")), `${PLUGIN_ROOT} holds no .claude-plugin/plugin.json`);
  assert.equal(PLUGIN_ROOT, join(ROOT, "plugin"));
  assert.ok(existsSync(join(ROOT, ROOT_MODULE)), `${ROOT_MODULE} is the file the checker exempts, and it exists`);
});

test("no module under plugin/src counts `..` off its own location", () => {
  const files = walk(join(ROOT, "plugin", "src"), "plugin/src");
  assert.ok(files.length > 200, `the walk found ${files.length} files, and plugin/src has hundreds`);
  assert.ok(files.some((one) => one.rel === ROOT_MODULE), "the walk reaches the root module");
  assert.deepEqual(problems(files), []);
});

test("a `..` off the module's own URL is refused with the line and the constant to import", () => {
  const text = 'import { dirname, resolve } from "node:path";\n'
    + 'const HERE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");\n';
  assert.deepEqual(said(text), ["plugin/src/some/where.mjs:2 counts `..` off its own location to reach a"
    + " file of the plugin — import PLUGIN_ROOT from plugin/src/tools/plugin-copy.mjs and join from it, so"
    + " moving this module moves nothing it reaches"]);
  assert.equal(said('const OWN = new URL("../../.claude-plugin/plugin.json", import.meta.url);\n').length, 1);
});

test("a `..` joined onto a name bound off the module's own URL is refused on the line that joins", () => {
  const text = "const HERE = dirname(fileURLToPath(import.meta.url));\n"
    + 'const VENDORED = join(HERE, "..", "..", "hooks", "vendor");\n';
  assert.deepEqual(said(text).map((one) => one.split(" ")[0]), ["plugin/src/some/where.mjs:2"]);
});

test("a relative import specifier and a `..` onto a path no binding of the module's URL reaches pass", () => {
  const text = 'import { a } from "../a.mjs";\n'
    + '} from "../../b.mjs";\n'
    + "const HERE = dirname(fileURLToPath(import.meta.url));\n"
    + 'const routes = join(HERE, "routes.json");\n'
    + 'const parent = join(store, "..");\n'
    + 'const THERE = join(where, "..");\n';
  assert.deepEqual(said(text), []);
});

test("the root module is the one place the count is spelt", () => {
  const text = 'export const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");\n';
  assert.deepEqual(said(text, ROOT_MODULE), []);
  assert.equal(said(text).length, 1, "the same line anywhere else is refused");
});
