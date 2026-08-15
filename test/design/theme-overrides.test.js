import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { findRedundantOverrides } from "../../src/design/theme-overrides.js";

// `--color-brand` is the defect this exists for: the dark block names it, so the
// block reads as though the colour was considered, and it is the light value.
const CSS = `@theme {
  --color-bg: #ffffff;
  --color-fg: #111111;
  --color-brand: #eb6927;
  --color-link: var(--color-brand);
}
.dark {
  --color-bg: #000000;
  --color-brand: #eb6927;
  --color-link: #eb6927;
}
`;

function tokenFile(css = CSS, name = "globals.css") {
  const root = mkdtempSync(path.join(tmpdir(), "theme overrides "));
  mkdirSync(root, { recursive: true });
  const file = path.join(root, name);
  writeFileSync(file, css);
  return file;
}

const themes = [
  { name: "light", blocks: ["@theme"] },
  { name: "dark", blocks: ["@theme", ".dark"] },
];

test("a theme block that restates the value under it is a declaration doing nothing", () => {
  const found = findRedundantOverrides({ tokenFile: tokenFile(), themes });

  assert.deepEqual(
    found.map((entry) => `${entry.theme} ${entry.token} ${entry.value} ${entry.block}`),
    ["dark --color-brand #eb6927 .dark", "dark --color-link #eb6927 .dark"],
  );
  // The rebinding that was made is not a finding, and neither is the base block.
  assert.ok(!found.some((entry) => entry.token === "--color-bg"));
});

test("an alias landing on the value already in force is the same no-op as a literal", () => {
  const file = tokenFile(`@theme {
  --color-brand: #eb6927;
  --color-link: #eb6927;
}
.dark {
  --color-link: var(--color-brand);
}
`);

  assert.deepEqual(
    findRedundantOverrides({ tokenFile: file, themes }).map((entry) => entry.token),
    ["--color-link"],
  );
});

test("a rebinding the override layer really makes is left alone", () => {
  const file = tokenFile(`@theme {
  --color-brand: #eb6927;
  --color-link: var(--color-brand);
}
.dark {
  --color-brand: #f07434;
  --color-link: var(--color-brand);
}
`);

  assert.deepEqual(findRedundantOverrides({ tokenFile: file, themes }), []);
});

test("a token the base layer never declared is new, not redundant", () => {
  const file = tokenFile(`@theme {
  --color-bg: #ffffff;
}
.dark {
  --color-bg: #000000;
  --color-scrim: #000000;
}
`);

  assert.deepEqual(findRedundantOverrides({ tokenFile: file, themes }), []);
});

test("a single-layer theme has nothing under it to repeat", () => {
  assert.deepEqual(
    findRedundantOverrides({
      tokenFile: tokenFile(),
      themes: [{ name: "light", blocks: ["@theme"] }],
    }),
    [],
  );
});

test("no token file is a config error, not a clean run over nothing", () => {
  assert.throws(() => findRedundantOverrides({ themes }), /needs \{ tokenFile \}/);
  assert.throws(() => findRedundantOverrides(), /needs \{ tokenFile \}/);
});
