import { RuleTester } from "eslint";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import rule, { findRawColorsInFiles } from "../../src/design/no-raw-colors.js";
import { tempRoom } from "../fixtures/room.js";

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

function project(files) {
  const root = tempRoom("raw colors ");
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(root, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  return root;
}

test("tokens pass, raw colour values do not", () => {
  tester.run("no-raw-colors", rule, {
    valid: [
      'const cls = "bg-surface text-fg-muted";',
      'const style = { color: "var(--color-fg)" };',
      'const style = { backgroundColor: "transparent", borderColor: "currentColor" };',
      "const css = `.a { color: var(--color-fg); }`;",
      'const anchor = "#section-two";',
      'const label = "the red button";',
    ],
    invalid: [
      {
        code: 'const cls = "text-[#fff]";',
        errors: [{ messageId: "rawColor", data: { kind: "hex literal", value: "#fff", remedy: "Add the colour to the token layer and reference the token with var(--…)." } }],
      },
      {
        code: 'const cls = "bg-[rgb(0,0,0)]";',
        errors: [{ messageId: "rawColor" }],
      },
      {
        code: 'const cls = "border-[oklch(0.7 0.1 20)]";',
        errors: [{ messageId: "rawColor" }],
      },
      {
        code: "const css = `.a { color: #e6e6eb; }`;",
        errors: [{ messageId: "rawColor" }],
      },
      {
        code: 'const style = { boxShadow: "0 1px 2px rgba(0,0,0,.2)" };',
        errors: [{ messageId: "rawColor" }],
      },
    ],
  });
});

test("a colour name counts beside a declaration, in an attribute, or in a bracket", () => {
  tester.run("no-raw-colors", rule, {
    valid: [
      'const chart = { series: "navy", label: "red" };',
      'const style = { color: "inherit" };',
      '<div className="text-navy" />',
    ],
    invalid: [
      {
        code: 'const style = { color: "red" };',
        errors: [{ messageId: "rawColor", data: { kind: "named CSS colour", value: "red", remedy: "Add the colour to the token layer and reference the token with var(--…)." } }],
      },
      {
        code: '<circle fill="rebeccapurple" />',
        errors: [{ messageId: "rawColor" }],
      },
      {
        code: 'const cls = "text-[hotpink]";',
        errors: [{ messageId: "rawColor" }],
      },
      {
        code: "const css = `.a { background-color: mistyrose; }`;",
        errors: [{ messageId: "rawColor" }],
      },
      {
        code: 'const style = { "border-color": "darkslategrey" };',
        errors: [{ messageId: "rawColor" }],
      },
    ],
  });
});

test("a colour function reaching the token layer through var() passes", () => {
  tester.run("no-raw-colors", rule, {
    valid: [
      "const css = `.a { color: rgb(var(--color-brand-rgb) / 0.5); }`;",
      "const css = `.a { color: hsl(var(--h) var(--s) var(--l)); }`;",
      "const css = `.a { background: rgba(var(--shadow-rgb), 0.2); }`;",
    ],
    invalid: [
      // Alpha is the only argument a literal may sit in: the channels still fork.
      {
        code: "const css = `.a { color: rgb(0 0 0 / var(--alpha)); }`;",
        errors: [{ message: /colour function "rgb\(0 0 0 \/ var\(--alpha\)\)"/ }],
      },
    ],
  });
});

test("a `#` naming a selector or a URL fragment is not a colour", () => {
  tester.run("no-raw-colors", rule, {
    valid: [
      'document.querySelector("#face");',
      'element.closest("#dedbee");',
      'const url = "/docs#abcdef";',
      '<a href="#beaded">jump</a>',
      '<svg><circle fill="url(#faded)" /></svg>',
    ],
    invalid: [
      // The same shape in a position that does take a colour still reports.
      { code: 'const brand = "#face";', errors: [{ messageId: "rawColor" }] },
    ],
  });
});

test("an allowed value covers every kind of finding, not hex alone", () => {
  tester.run("no-raw-colors", rule, {
    valid: [
      {
        code: 'const style = { color: "red" };',
        options: [{ allow: [{ value: "red", why: "a browser default this mirrors" }] }],
      },
      {
        code: 'const style = { boxShadow: "0 1px 2px rgba(0, 0, 0, .2)" };',
        options: [{ allow: [{ value: "rgba(0,0,0,.2)", why: "the elevation ramp is not tokenised" }] }],
      },
      {
        code: 'const cls = "text-[hotpink]";',
        options: [{ allow: [{ value: "hotpink", why: "a seasonal promo" }] }],
      },
    ],
    invalid: [],
  });
});

test("the token file, an exempt path, and an allowed literal are left alone", () => {
  tester.run("no-raw-colors", rule, {
    valid: [
      {
        code: 'const tokens = { fg: "#0b1220" };',
        filename: "src/app/tokens.ts",
        options: [{ exemptFiles: ["src/app/tokens.ts"] }],
      },
      {
        code: 'const tokens = { fg: "#0b1220" };',
        filename: "/repo/frontend/app/globals.css.ts",
        options: [{ exemptFiles: ["frontend/**/*.css.ts"] }],
      },
      {
        code: 'const mask = "#000000";',
        filename: "src/mask.ts",
        options: [{ allow: [{ file: "src/mask.ts", value: "#000000", why: "an SVG mask stop" }] }],
      },
    ],
    invalid: [
      {
        code: 'const mask = "#000000";',
        filename: "src/other.ts",
        options: [{ allow: [{ file: "src/mask.ts", value: "#000000", why: "an SVG mask stop" }] }],
        errors: [{ messageId: "rawColor" }],
      },
      {
        code: 'const cls = "text-[#fff]";',
        options: [{ tokenSource: "app/globals.css" }],
        errors: [
          {
            messageId: "rawColor",
            data: {
              kind: "hex literal",
              value: "#fff",
              remedy: "Add the colour to app/globals.css and reference the token with var(--…).",
            },
          },
        ],
      },
      {
        code: 'const style = { color: "cerulean" };',
        options: [{ namedColors: ["cerulean"] }],
        errors: [{ messageId: "rawColor" }],
      },
      // A project whose `tokenSource` is its size scale must not be sent there for a colour.
      {
        code: 'const style = { color: "#fff" };',
        options: [
          {
            colorReference: "lib/tokens.ts",
            colorSource: "packages/design-tokens/src/tokens.css",
            tokenSource: "lib/scale.ts",
          },
        ],
        errors: [
          {
            messageId: "rawColor",
            data: {
              kind: "hex literal",
              value: "#fff",
              remedy:
                "Add the colour to packages/design-tokens/src/tokens.css and read it through lib/tokens.ts.",
            },
          },
        ],
      },
      // Where one file holds both, naming it once still answers the colour rule.
      {
        code: 'const style = { color: "#fff" };',
        options: [{ tokenSource: "app/globals.css" }],
        errors: [
          {
            messageId: "rawColor",
            data: {
              kind: "hex literal",
              value: "#fff",
              remedy: "Add the colour to app/globals.css and reference the token with var(--…).",
            },
          },
        ],
      },
    ],
  });
});

test("stylesheets are scanned as text, since ESLint parses no CSS", () => {
  const root = project({
    "app/globals.css": ":root { --color-fg: #0b1220; }",
    "app/card.css": ".card { color: #e6e6eb; border-color: hotpink; }",
    "app/ok.css": ".ok { color: var(--color-fg); background: transparent; }",
    "app/card.tsx": 'export const cls = "text-[#fff]";',
  });

  const violations = findRawColorsInFiles({
    roots: [root],
    exemptFiles: ["app/globals.css"],
  });
  assert.deepEqual(
    violations.map((entry) => entry.value),
    ["#e6e6eb", "hotpink"],
  );
  assert.equal(violations[0].line, 1);
  assert.ok(violations[0].file.endsWith("app/card.css"));

  const allowed = findRawColorsInFiles({
    roots: [root],
    exemptFiles: ["app/globals.css"],
    allow: [
      { value: "#e6e6eb", why: "a print stylesheet with no token layer" },
      { value: "hotpink", why: "the same" },
    ],
  });
  assert.deepEqual(allowed, []);
});
