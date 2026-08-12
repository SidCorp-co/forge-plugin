import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const packageRoot = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const gate = path.join(packageRoot, "bin", "code-quality-gate.mjs");
const CONFIG = 'import cq from "eslint-plugin-code-quality";\nexport default [...cq.configs.recommended];\n';
const NARRATES = "// Previously this returned zero.\nexport const a = 1;\n";

function consumer(root) {
  const modules = path.join(root, "node_modules");
  mkdirSync(modules, { recursive: true });
  symlinkSync(path.join(packageRoot, "node_modules", "eslint"), path.join(modules, "eslint"), "dir");
  symlinkSync(packageRoot, path.join(modules, "eslint-plugin-code-quality"), "dir");
  writeFileSync(path.join(root, "package.json"), '{"type":"module","private":true}\n');
  writeFileSync(path.join(root, "eslint.config.js"), CONFIG);
  return root;
}

const run = (cwd, args = ["."]) => spawnSync(process.execPath, [gate, ...args], { cwd, encoding: "utf8" });

test("config above the working directory is found, as ESLint itself would", () => {
  const root = consumer(mkdtempSync(path.join(tmpdir(), "gate up ")));
  const nested = path.join(root, "src", "deep");
  mkdirSync(nested, { recursive: true });
  writeFileSync(path.join(nested, "narrate.js"), NARRATES);

  const result = run(nested);
  assert.doesNotMatch(result.stderr, /no ESLint config/, "looked down without looking up first");
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /no-historical-narration/);
});

test("packages below a bare root are each linted with their own config", () => {
  const root = mkdtempSync(path.join(tmpdir(), "gate down "));
  for (const name of ["api", "web"]) {
    const pkg = path.join(root, name);
    mkdirSync(path.join(pkg, "src"), { recursive: true });
    consumer(pkg);
    writeFileSync(path.join(pkg, "src", "narrate.js"), NARRATES);
  }

  const result = run(root, []);
  assert.equal(result.status, 1, result.stderr);
  for (const name of ["api", "web"]) {
    assert.match(result.stderr, new RegExp(`${name}[/\\\\]src[/\\\\]narrate\\.js`), `missed ${name}`);
  }
});

test("a project with no config anywhere says so in one line", () => {
  const root = mkdtempSync(path.join(tmpdir(), "gate none "));
  mkdirSync(path.join(root, "src"), { recursive: true });
  writeFileSync(path.join(root, "src", "a.js"), "export const a = 1;\n");

  const result = run(root, []);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /^code-quality-gate: no ESLint config here or in any package below it\n$/);
});

test("every run prints a swept-file count, clean or not", () => {
  const root = consumer(mkdtempSync(path.join(tmpdir(), "gate banner ")));
  mkdirSync(path.join(root, "src"), { recursive: true });
  writeFileSync(path.join(root, "src", "clean.js"), "export const a = 1;\n");

  const clean = run(root);
  assert.equal(clean.status, 0, clean.stderr);
  assert.match(clean.stdout, /^code-quality-gate · \d+ files · 1 package\n/);

  writeFileSync(path.join(root, "src", "narrate.js"), NARRATES);
  const failing = run(root);
  assert.equal(failing.status, 1);
  assert.match(failing.stdout, /^code-quality-gate · \d+ files · 1 package\n/);
});
