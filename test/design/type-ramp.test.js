import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { findArbitrarySizesInFiles } from "../../src/design/no-arbitrary-sizes.js";
import { findRampGaps } from "../../src/design/type-ramp.js";

function project(files) {
  const root = mkdtempSync(path.join(tmpdir(), "type ramp "));
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(root, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  return root;
}

test("a ramp step without its line height is a gap, and a companion is not one", () => {
  const root = project({
    "app/globals.css":
      "@theme {\n" +
      "  --text-sm: 13px;\n" +
      "  --text-sm--line-height: 1.5;\n" +
      "  --text-lg: 17px;\n" +
      "  --text-4xl: 36px;\n" +
      "  --ink-600: #5a616e;\n" +
      "  --text-muted: var(--ink-600);\n" +
      "  --space-2: 8px;\n" +
      "}\n",
  });
  const tokenFile = path.join(root, "app/globals.css");

  // `--text-muted` shares the namespace but resolves to a colour, so it is no step:
  // a line height for it could never be declared.
  assert.deepEqual(findRampGaps({ tokenFile, block: "@theme" }), [
    { token: "--text-lg", missing: "--text-lg--line-height" },
    { token: "--text-4xl", missing: "--text-4xl--line-height" },
  ]);

  // The prefix and the companion set are the project's to name.
  assert.deepEqual(findRampGaps({ tokenFile, block: "@theme", prefix: "--space-" }), [
    { token: "--space-2", missing: "--space-2--line-height" },
  ]);
  assert.deepEqual(findRampGaps({ tokenFile, block: "@theme", requires: [] }), []);
  assert.throws(() => findRampGaps({}), /needs \{ tokenFile \}/);
});

test("a raw font size in a stylesheet is caught, and a token declaration is not", () => {
  const root = project({
    "app/globals.css": "@theme {\n  --text-sm: 13px;\n  --font-size-legacy: 14px;\n}\n",
    "app/card.css":
      ".card { font-size: 14px; }\n" +
      ".ok { font-size: var(--text-sm); }\n" +
      ".calc { font-size: calc(var(--text-sm) * 1.2); }\n" +
      ".keyword { font-size: inherit; }\n",
    "app/print.css": ".p { font-size: 10pt; }\n",
  });

  const violations = findArbitrarySizesInFiles({ roots: [root] });
  assert.deepEqual(
    violations.map((entry) => `${path.basename(entry.file)}:${entry.line} ${entry.value}`),
    ["card.css:1 14px", "print.css:1 10pt"],
  );
  assert.equal(violations[0].family, "font size");
  assert.equal(violations[0].hint, "Use a step from the type ramp.");

  assert.deepEqual(findArbitrarySizesInFiles({ roots: [root], exemptFiles: ["app/print.css"] }), [
    violations[0],
  ]);
  assert.deepEqual(
    findArbitrarySizesInFiles({
      roots: [root],
      allow: [
        { value: "14px", why: "a print stylesheet with no ramp" },
        { value: "10pt", why: "the same" },
      ],
    }),
    [],
  );
});
