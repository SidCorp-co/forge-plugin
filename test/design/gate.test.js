import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const packageRoot = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const gate = path.join(packageRoot, "bin", "code-quality-gate.mjs");

const CSS = `@theme {
  --color-bg: #ffffff;
  --color-fg-dim: #999999;
}
`;

function consumer(settings, files = {}, configPath = "code-quality.json") {
  const root = mkdtempSync(path.join(tmpdir(), "gate tokens "));
  const modules = path.join(root, "node_modules");
  mkdirSync(path.join(root, "app"), { recursive: true });
  mkdirSync(path.dirname(path.join(root, configPath)), { recursive: true });
  mkdirSync(modules, { recursive: true });
  symlinkSync(path.join(packageRoot, "node_modules", "eslint"), path.join(modules, "eslint"), "dir");
  symlinkSync(packageRoot, path.join(modules, "eslint-plugin-code-quality"), "dir");
  writeFileSync(path.join(root, "package.json"), '{"type":"module","private":true}\n');
  writeFileSync(
    path.join(root, "eslint.config.js"),
    'import cq from "eslint-plugin-code-quality";\nexport default [...cq.configs.recommended];\n',
  );
  writeFileSync(path.join(root, configPath), JSON.stringify(settings));
  const contents = {
    "app/globals.css": CSS,
    "app/card.css": ".card { color: #e6e6eb; }\n",
    "app/card.js": 'export const cls = "bg-bg text-fg-dim";\n',
    ...files,
  };
  for (const [relative, content] of Object.entries(contents)) {
    writeFileSync(path.join(root, relative), content);
  }
  return root;
}

const run = (cwd, configPath = "code-quality.json") =>
  spawnSync(process.execPath, [gate, ".", `--config=${configPath}`, "--no-inline-warning"], {
    cwd,
    encoding: "utf8",
  });

test("the gate checks stylesheets and contrast when it is pointed at a config", () => {
  const root = consumer({
    tokenFile: "app/globals.css",
    stylesheets: { roots: ["app"] },
    contrast: { block: "@theme", roots: ["app"] },
  });

  const result = run(root);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /Raw colours in stylesheets:/);
  assert.match(result.stderr, /app[/\\]card\.css:1\n\s+hex literal "#e6e6eb"/);
  assert.doesNotMatch(result.stderr, /globals\.css/, "the token file must exempt itself");
  assert.match(result.stderr, /--color-fg-dim #999999 on --color-bg #ffffff\n\s+2\.85:1, needs 4\.5:1/);
});

test("an allowed pair prints on every run instead of disappearing", () => {
  const root = consumer(
    {
      tokenFile: "app/globals.css",
      contrast: {
        block: "@theme",
        roots: ["app"],
        allow: [{ fg: "--color-fg-dim", bg: "--color-bg", why: "design: the muted ramp" }],
      },
    },
    { "app/card.css": ".card { color: var(--color-fg-dim); }\n" },
  );

  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Contrast failures allowed by config:/);
  assert.match(result.stdout, /design: the muted ramp/);
});

test("the gate measures every theme the config declares and names the failing one", () => {
  const root = consumer(
    {
      tokenFile: "app/globals.css",
      contrast: {
        roots: ["app"],
        themes: [
          { name: "light", blocks: ["@theme"] },
          { name: "dark", blocks: ["@theme", ".dark"] },
        ],
      },
    },
    {
      // Planted in the dark block alone: 4.54:1 on white, 4.36:1 on the dark surface.
      "app/globals.css":
        "/* .dark is a class, not the OS setting */\n" +
        "@theme {\n  --color-bg: #ffffff;\n  --color-fg-dim: #767676;\n}\n" +
        ".dark {\n  --color-bg: #0a0a0b;\n}\n",
    },
  );

  const result = run(root);
  assert.equal(result.status, 1, `${result.stdout}${result.stderr}`);
  assert.match(result.stdout, /design tokens · .*themes light, dark/);
  assert.match(result.stderr, /\[dark\] --color-fg-dim #767676 on --color-bg #0a0a0b\n\s+4\.36:1/);
  // The same pair passes in light, so a report naming no theme would be unactionable.
  assert.doesNotMatch(result.stderr, /\[light\]/);
});

test("the gate fails a dark block that restates a colour it never rebound", () => {
  const root = consumer(
    {
      tokenFile: "app/globals.css",
      contrast: {
        roots: ["app"],
        themes: [
          { name: "light", blocks: ["@theme"] },
          { name: "dark", blocks: ["@theme", ".dark"] },
        ],
      },
    },
    {
      // --color-brand is named in .dark and is the light value; --color-bg is rebound.
      "app/globals.css":
        "@theme {\n  --color-bg: #ffffff;\n  --color-fg-dim: #767676;\n  --color-brand: #eb6927;\n}\n" +
        ".dark {\n  --color-bg: #0a0a0b;\n  --color-brand: #eb6927;\n}\n",
    },
  );

  const result = run(root);
  assert.equal(result.status, 1, `${result.stdout}${result.stderr}`);
  const [, report] = /Theme declarations that change nothing:\n\n([\s\S]*?)\n\n/.exec(result.stderr);
  assert.equal(report, "  [dark] --color-brand #eb6927 in .dark");
});

test("a config below the run directory still sweeps the whole run directory", () => {
  const root = consumer(
    { tokenFile: "../app/globals.css", stylesheets: {}, contrast: { block: "@theme" } },
    {},
    path.join("config", "code-quality.json"),
  );

  const result = run(root, path.join("config", "code-quality.json"));
  assert.equal(result.status, 1, `${result.stdout}${result.stderr}`);
  assert.match(result.stderr, /app[/\\]card\.css:1\n\s+hex literal "#e6e6eb"/);
  assert.match(result.stderr, /--color-fg-dim #999999 on --color-bg #ffffff\n\s+2\.85:1/);
  // The token file is named from above the config, so a tail match never sees it.
  assert.doesNotMatch(result.stderr, /globals\.css:/, "the token file must exempt itself");
});

test("a stylesheet exemption of its own does not unexempt the token file", () => {
  const root = consumer(
    { tokenFile: "app/globals.css", stylesheets: { exemptFiles: ["app/print.css"] } },
    { "app/print.css": ".p { color: #123456; }\n", "app/card.css": ".card { color: red; }\n" },
  );

  const result = run(root);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /app[/\\]card\.css:1\n\s+named CSS colour "red"/);
  assert.doesNotMatch(result.stderr, /print\.css/);
  assert.doesNotMatch(result.stderr, /globals\.css/);
});

test("the gate checks stylesheet font sizes and the ramp's completeness", () => {
  const root = consumer(
    {
      tokenFile: "app/globals.css",
      sizes: {},
      typeRamp: { block: "@theme" },
    },
    {
      "app/globals.css": "@theme {\n  --text-sm: 13px;\n  --text-sm--line-height: 1.5;\n  --text-lg: 17px;\n}\n",
      "app/card.css": ".card { font-size: 14px; }\n",
    },
  );

  const result = run(root);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /Arbitrary sizes in stylesheets:/);
  assert.match(result.stderr, /app[/\\]card\.css:1\n\s+14px — Use a step from the type ramp\./);
  assert.match(result.stderr, /Type ramp steps missing a companion:/);
  assert.match(result.stderr, /--text-lg\n\s+no --text-lg--line-height/);
  // The step that has one is not reported, and the token file exempts itself.
  assert.doesNotMatch(result.stderr, /--text-sm\n/);
  assert.doesNotMatch(result.stderr, /globals\.css:/);
});

test("a check that reaches no file is a broken config, not a clean run", () => {
  const root = consumer({ tokenFile: "app/globals.css", stylesheets: { roots: ["nowhere"] } });
  const missed = run(root);
  assert.equal(missed.status, 2, missed.stdout);
  assert.match(missed.stderr, /stylesheets matched no files under nowhere/);

  // A run that does reach files says how many, so a caller can floor the number.
  const working = consumer({ tokenFile: "app/globals.css", stylesheets: {}, typeRamp: {} });
  assert.match(run(working).stdout, /design tokens · 2 stylesheets · 1 type ramp/);
});

test("a config the gate cannot use exits 2 rather than passing quietly", () => {
  const broken = consumer({ contrast: { roots: ["app"] } });
  const missing = run(broken);
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /contrast check: .*needs \{ tokenFile \}/);

  const unparseable = consumer({});
  writeFileSync(path.join(unparseable, "code-quality.json"), "{ not json");
  const malformed = run(unparseable);
  assert.equal(malformed.status, 2);
  assert.match(malformed.stderr, /cannot read code-quality\.json/);
});

const runBare = (cwd, ...extra) =>
  spawnSync(process.execPath, [gate, ".", "--no-inline-warning", ...extra], {
    cwd,
    encoding: "utf8",
  });

test("a configured project needs no flags", () => {
  const root = consumer({ tokenFile: "app/globals.css", stylesheets: { roots: ["app"] } });
  const found = runBare(root);
  assert.equal(found.status, 1, found.stdout);
  assert.match(found.stderr, /app[/\\]card\.css:1\n\s+hex literal "#e6e6eb"/);
  assert.match(found.stdout, /design tokens · 2 stylesheets/);

  // The same config, refused: a project mid-adoption still needs one run without it.
  const skipped = runBare(root, "--no-config");
  assert.equal(skipped.status, 0, skipped.stderr);
  assert.doesNotMatch(skipped.stdout, /design tokens/);
});

test("a settings file configuring no token check announces none", () => {
  // The line is the evidence that a configured check reached files, so printing it for a
  // project that configured none would be the one thing it exists to rule out.
  const root = consumer({ allRules: true, tokenFile: "app/globals.css" });
  const result = runBare(root);
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /design tokens/);
});

test("allRules widens the gate to the rules the project itself sets to error", () => {
  const settings = { allRules: true, tokenFile: "app/globals.css" };
  const files = {
    "eslint.config.js":
      'import cq from "eslint-plugin-code-quality";\n' +
      "export default [...cq.configs.recommended, { rules: { eqeqeq: \"error\" } }];\n",
    "app/loose.js": "export const same = (a, b) => a == b;\n",
  };

  const widened = runBare(consumer(settings, files));
  assert.equal(widened.status, 1, widened.stdout);
  assert.match(widened.stderr, /Expected '===' and instead saw '=='.*eqeqeq/);

  // Without the key the same finding is eslint's to report and not the gate's.
  const filtered = runBare(consumer({ tokenFile: "app/globals.css" }, files));
  assert.equal(filtered.status, 0, filtered.stderr);
  assert.doesNotMatch(filtered.stderr, /eqeqeq/);
});

test("the settings file answers the flags, and a flag still wins for one run", () => {
  const root = consumer({ maxFilesPerDirectory: 1, ext: [".vue"] });
  for (const name of ["a", "b"]) writeFileSync(path.join(root, "app", `${name}.vue`), "<template/>\n");

  // Counted because the config named the extension, over the limit the config set.
  const configured = runBare(root);
  assert.equal(configured.status, 1, configured.stdout);
  assert.match(configured.stderr, /app\n\s+\d+ source files, limit 1/);

  // The flag overrides the key for this run only.
  assert.equal(runBare(root, "--max-files-per-dir=99").status, 0);
  assert.equal(runBare(root, "--no-folder-check").status, 0);

  // And the key can switch the check off without a flag.
  const off = consumer({ maxFilesPerDirectory: 1, folderCheck: false });
  assert.equal(runBare(off).status, 0, off.stderr);
});
