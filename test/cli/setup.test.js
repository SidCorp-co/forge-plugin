import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const packageRoot = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const setup = path.join(packageRoot, "bin", "code-quality-setup.mjs");

/** Dependencies pre-declared, so no run in here reaches the network. */
function project(files = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "code quality setup "));
  const modules = path.join(root, "node_modules");
  mkdirSync(modules);
  symlinkSync(path.join(packageRoot, "node_modules", "eslint"), path.join(modules, "eslint"), "dir");
  symlinkSync(packageRoot, path.join(modules, "eslint-plugin-code-quality"), "dir");
  writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      name: "consumer",
      type: "module",
      private: true,
      devDependencies: { eslint: "*", "eslint-plugin-code-quality": "*" },
    }),
  );
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(root, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  return root;
}

const run = (cwd, ...args) =>
  spawnSync(process.execPath, [setup, ...args], { cwd, encoding: "utf8" });

const read = (root, file) => readFileSync(path.join(root, file), "utf8");

test("writes a config from the severities it was given, and a lint script", () => {
  const root = project({ "src/clean.js": "export const ok = true;\n" });
  const result = run(root, "--comment-density=warn", "--no-pass-through-wrapper=off");
  assert.equal(result.status, 0, result.stderr);

  const config = read(root, "eslint.config.mjs");
  assert.match(config, /import \{ configure \} from "eslint-plugin-code-quality";/);
  assert.match(config, /"comment-density": "warn",/);
  assert.match(config, /"no-pass-through-wrapper": "off",/);
  // No parser import in a project holding no tsconfig.
  assert.doesNotMatch(config, /typescript-eslint/);
  assert.equal(JSON.parse(read(root, "package.json")).scripts["lint:code-quality"], "code-quality-gate");
  // Nothing to settle, so no settings file: the hook is on and the gate needs no keys.
  assert.equal(existsSync(path.join(root, "code-quality.json")), false);
  assert.match(result.stdout, /code-quality-gate · \d+ files/);
});

test("a second run rewrites the call it wrote, and leaves the rest of the file alone", () => {
  const root = project({ "src/clean.js": "export const ok = true;\n" });
  run(root, "--comment-density=warn");
  writeFileSync(
    path.join(root, "eslint.config.mjs"),
    `${read(root, "eslint.config.mjs").replace("];", '  { rules: { eqeqeq: "error" } },\n];')}`,
  );

  const again = run(root, "--comment-density=error", "--max-lines=off");
  assert.equal(again.status, 0, again.stderr);
  const config = read(root, "eslint.config.mjs");
  assert.match(config, /"comment-density": "error",/);
  assert.match(config, /"max-lines": "off",/);
  assert.doesNotMatch(config, /"comment-density": "warn"/);
  // The project's own entry survives, and the file still parses.
  assert.match(config, /\{ rules: \{ eqeqeq: "error" \} \},/);
  assert.equal(spawnSync(process.execPath, ["--check", path.join(root, "eslint.config.mjs")]).status, 0);
});

test("a config assembling the plugin some other way is reported rather than guessed at", () => {
  const source = 'export default [{ rules: { eqeqeq: "error" } }];\n';
  const root = project({ "eslint.config.mjs": source, "src/clean.js": "export const ok = true;\n" });
  const result = run(root, "--comment-density=warn");
  assert.match(result.stdout, /holds no configure\(\) call — merge these answers into it by hand/);
  assert.match(result.stdout, /"comment-density": "warn",/);
  assert.equal(read(root, "eslint.config.mjs"), source);
});

test("a configure() call richer than the answers is protected, not overwritten", () => {
  // The answers render one severity per rule; anything else in the call would be deleted by a
  // wholesale replacement, so the run reports it instead.
  const source =
    'import { configure } from "eslint-plugin-code-quality";\n' +
    'export default [...configure({ "max-lines": ["error", { max: 300 }], ignores: ["dist/**"] })];\n';
  const root = project({ "eslint.config.mjs": source, "src/clean.js": "export const ok = true;\n" });
  const result = run(root, "--comment-density=warn");
  assert.match(result.stdout, /saying more than these answers do/);
  assert.equal(read(root, "eslint.config.mjs"), source);
});

test("the hook opt-out and the widened gate are written, and cleared by the next answer", () => {
  const root = project({ "src/clean.js": "export const ok = true;\n" });
  run(root, "--hook=off", "--all-rules");
  assert.deepEqual(JSON.parse(read(root, "code-quality.json")), { hook: false, allRules: true });

  // Every run asks for both, so the answers replace them rather than merging.
  run(root, "--hook=on");
  assert.deepEqual(JSON.parse(read(root, "code-quality.json")), {});
});

test("a token layer wires both halves: the rules and the gate's four checks", () => {
  const root = project({
    "app/globals.css": ":root { --color-bg: #ffffff; }\n",
    "src/clean.js": "export const ok = true;\n",
  });
  const result = run(root, "--tokens=app/globals.css");
  assert.equal(result.status, 0, result.stderr);
  assert.match(read(root, "eslint.config.mjs"), /tokens: \{ tokenSource: "app\/globals\.css" \}/);
  assert.deepEqual(JSON.parse(read(root, "code-quality.json")), {
    tokenFile: "app/globals.css",
    stylesheets: {},
    sizes: {},
    typeRamp: {},
    contrast: {},
  });
  assert.match(result.stdout, /design tokens · 1 stylesheet/);
});

test("a typescript project gets a parser, and a dry run writes nothing", () => {
  const root = project({ "tsconfig.json": "{}\n", "src/clean.ts": "export const ok = true;\n" });
  const dry = run(root, "--comment-density=warn", "--dry-run");
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /@typescript-eslint\/parser/);
  assert.match(dry.stdout, /would write eslint\.config\.mjs/);
  assert.equal(existsSync(path.join(root, "eslint.config.mjs")), false);
});

test("a project holding its own config keeps its own parser choice", () => {
  // TypeScript 7 breaks @typescript-eslint/parser at module load, so a project that worked around
  // it must not have one installed underneath by a run that is not writing the config anyway.
  const root = project({
    "tsconfig.json": "{}\n",
    "eslint.config.mjs": 'export default [{ rules: { eqeqeq: "error" } }];\n',
    "src/clean.ts": "export const ok = true;\n",
  });
  const result = run(root, "--comment-density=warn", "--dry-run");
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /@typescript-eslint\/parser/);
});

test("a severity that is not one refuses the whole run", () => {
  const root = project();
  const typo = run(root, "--comment-density=strict");
  assert.equal(typo.status, 2);
  assert.match(typo.stderr, /--comment-density= takes error, warn or off, not "strict"/);

  const misspelled = run(root, "--comment-densty=warn");
  assert.equal(misspelled.status, 2);
  assert.match(misspelled.stderr, /no rule named comment-densty/);

  const missing = run(root, "--tokens=app/nowhere.css");
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /--tokens=app\/nowhere\.css does not exist/);
});
