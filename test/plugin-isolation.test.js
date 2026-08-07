import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { FIX_POLICY, RULE_DIRECTIVES, SOURCE_EXTENSIONS } from "../src/index.js";

const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const hookSource = readFileSync(
  path.join(packageRoot, "claude-plugin", "scripts", "lint-edited-file.mjs"),
  "utf8",
);

// The hook ships without src/, so its copy of the extension list can only be
// checked by reading it: an import here would also execute the script.
test("the hook's extension list matches the package's", () => {
  const declaration = hookSource.match(/const supportedExtensions = new Set\(\[([^\]]*)\]\)/);
  assert.ok(declaration, "supportedExtensions is no longer a literal Set the test can read");
  const extensions = [...declaration[1].matchAll(/"([^"]+)"/g)].map(([, value]) => value);
  assert.deepEqual(extensions.sort(), [...SOURCE_EXTENSIONS].sort());
});

test("the hook's directives match the package's", () => {
  for (const directive of [FIX_POLICY, ...Object.values(RULE_DIRECTIVES)]) {
    assert.ok(
      hookSource.includes(JSON.stringify(directive).slice(1, -1)),
      `the hook no longer prints this verbatim: ${directive}`,
    );
  }
});

test("the hook imports nothing from outside its own plugin directory", () => {
  const imports = [...hookSource.matchAll(/from\s+"([^"]+)"/g)].map(([, specifier]) => specifier);
  const external = imports.filter((specifier) => !specifier.startsWith("node:"));
  assert.deepEqual(external, [], "the hook must stay self-contained in the plugin cache");
});
