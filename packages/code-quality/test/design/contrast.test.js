import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { findContrastFailures } from "../../src/design/contrast.js";
import { contrastRatio, readColorTokens } from "../../src/design/tokens.js";

// The comment and the `:where()` are the trap: both name `.dark` above the block
// that declares it, and both are what a substring search finds first.
const CSS = `/* The app toggles .dark on <html> rather than following the OS. */
@custom-variant dark (&:where(.dark, .dark *));
@theme {
  --color-bg: #ffffff;
  --color-fg: #111111;
  --color-fg-dim: #999999;
  --color-border: #e6e6eb;
  --color-fancy: oklch(0.7 0.1 20);
}
.dark {
  --color-bg: #000000;
  --color-fg: #eeeeee;
}
`;

function project(files = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "contrast "));
  for (const [relative, content] of Object.entries({ "app/globals.css": CSS, ...files })) {
    const target = path.join(root, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  return { root, tokenFile: path.join(root, "app/globals.css") };
}

const reasons = (entries) => entries.map((entry) => `${entry.fg} on ${entry.bg}: ${entry.reason}`);

test("WCAG ratios are computed from the token file, not transcribed", () => {
  assert.equal(contrastRatio("#ffffff", "#000000"), 21);
  assert.equal(contrastRatio("#fff", "#fff"), 1);
  assert.equal(contrastRatio("#767676", "#ffffff").toFixed(2), "4.54");

  const { tokenFile } = project();
  const tokens = readColorTokens(tokenFile, { block: "@theme" });
  assert.equal(tokens.get("--color-bg"), "#ffffff");
  assert.equal(readColorTokens(tokenFile).get("--color-bg"), "#000000");
  assert.equal(readColorTokens(tokenFile, { block: ".dark" }).get("--color-fg"), "#eeeeee");
});

test("a block is found by its header, and a name nothing declares fails loudly", () => {
  const { tokenFile } = project();

  // `.dark` occurs in a comment and in a `:where()` before the block it names.
  // A substring search reaches `@theme` and reports the light theme as the dark one.
  assert.equal(readColorTokens(tokenFile, { block: ".dark" }).get("--color-bg"), "#000000");
  assert.equal(readColorTokens(tokenFile, { block: "@theme" }).get("--color-bg"), "#ffffff");

  // A block only a comment mentions is not a block, and measuring another one in
  // its place would report green over a theme that was never read.
  const { tokenFile: commented } = project({
    "app/commented.css": "/* .midnight is planned, not written */\n@theme {\n  --color-bg: #ffffff;\n}\n",
  });
  const file = path.join(path.dirname(commented), "commented.css");
  assert.throws(
    () => readColorTokens(file, { block: ".midnight" }),
    (error) => error.message === `No \`.midnight\` block in ${file}`,
  );
  assert.throws(
    () => findContrastFailures({ tokenFile: file, block: ".midnight", scanMarkup: false }),
    /No `\.midnight` block/,
  );

  // A declaration commented out is not a declaration either.
  const { tokenFile: disabled } = project({
    "app/disabled.css": "@theme {\n  --color-bg: #ffffff;\n  /* --color-bg: #000000; */\n}\n",
  });
  const off = readColorTokens(path.join(path.dirname(disabled), "disabled.css"), { block: "@theme" });
  assert.equal(off.get("--color-bg"), "#ffffff");
});

test("one run measures every declared theme and names the one a failure came from", () => {
  const { root, tokenFile } = project({
    // The muted foreground reads 4.54:1 on white and 4.36:1 on the dark surface it
    // is never rebound for: a failure only a run that measures dark can see.
    "app/globals.css": CSS.replace("--color-fg-dim: #999999;", "--color-fg-dim: #767676;").replace(
      "--color-bg: #000000;",
      "--color-bg: #0a0a0b;",
    ),
    "app/card.tsx": 'export const cls = "bg-bg text-fg-dim rounded-lg";',
  });
  const themes = [
    { name: "light", blocks: ["@theme"] },
    { name: "dark", blocks: ["@theme", ".dark"] },
  ];
  const result = findContrastFailures({ tokenFile, themes, roots: [root] });

  // The dark block rebinds --color-bg alone, so the pair only exists at all
  // because the theme layers `.dark` over `@theme` rather than replacing it.
  assert.deepEqual(
    result.failures.map((entry) => `${entry.theme}: ${entry.fg} on ${entry.bg} ${entry.reason}`),
    ["dark: --color-fg-dim on --color-bg 4.36:1, needs 4.5:1"],
  );
  assert.deepEqual(
    result.themes.map((theme) => [theme.name, theme.tokens.get("--color-bg"), theme.failures.length]),
    [
      ["light", "#ffffff", 0],
      ["dark", "#0a0a0b", 1],
    ],
  );

  // One `allow` list covers every theme: a waiver is a decision about a pair.
  const waived = findContrastFailures({
    tokenFile,
    themes,
    roots: [root],
    allow: [{ fg: "--color-fg-dim", bg: "--color-bg", why: "design: the muted ramp" }],
  });
  assert.deepEqual(waived.failures, []);
  assert.deepEqual(
    waived.waivers.map((entry) => entry.theme),
    ["dark"],
  );

  assert.throws(
    () => findContrastFailures({ tokenFile, themes: [{ blocks: ["@theme"] }] }),
    /needs a \{ name \}/,
  );
  assert.throws(
    () => findContrastFailures({ tokenFile, themes: [{ name: "light" }] }),
    /needs \{ blocks \} or \{ sources \}/,
  );
});

test("a semantic layer over a raw palette resolves to the colour it ends at", () => {
  const { root } = project({
    "app/palette.css":
      ":root {\n" +
      "  --ink-900: #181b22;\n" +
      "  --paper-0: #ffffff;\n" +
      "  --fg-default: var(--ink-900);\n" +
      "}\n",
    "app/semantic.css":
      "@theme inline {\n" +
      "  --color-fg: var(--fg-default);\n" +
      "  --color-bg: var(--paper-0);\n" +
      "  --color-loop: var(--color-loop);\n" +
      "  --color-nowhere: var(--never-declared);\n" +
      "}\n",
  });
  const sources = [
    { file: path.join(root, "app/palette.css"), block: ":root" },
    { file: path.join(root, "app/semantic.css"), block: "@theme inline" },
  ];
  const check = (declaredPairs) =>
    findContrastFailures({ sources, scanMarkup: false, declaredPairs });

  // Two hops across two files: --color-fg → --fg-default → --ink-900 → a colour.
  const resolved = check([{ fg: "--color-fg", bg: "--color-bg", why: "body text" }]);
  assert.deepEqual(resolved.failures, []);
  assert.equal(resolved.themes[0].tokens.get("--color-fg"), "#181b22");

  // A cycle and a dead end resolve to themselves rather than hanging or throwing.
  const { failures } = check([{ fg: "--color-loop", bg: "--color-nowhere", why: "broken" }]);
  assert.deepEqual(reasons(failures), [
    "--color-loop on --color-nowhere: unsupported token value — contrast needs a hex colour",
  ]);
});

test("a token carrying alpha is unresolvable, not silently opaque", () => {
  assert.equal(contrastRatio("#000000ff", "#ffffff"), 21);

  const { tokenFile } = project({
    "app/alpha.css": "@theme {\n  --color-bg: #ffffff;\n  --color-veil: #11182710;\n}\n",
  });
  const { failures } = findContrastFailures({
    tokenFile: path.join(path.dirname(tokenFile), "alpha.css"),
    block: "@theme",
    scanMarkup: false,
    declaredPairs: [{ fg: "--color-veil", bg: "--color-bg", why: "a scrim label" }],
  });
  assert.deepEqual(reasons(failures), [
    "--color-veil on --color-bg: translucent token — contrast needs the colour it composites over",
  ]);
});

test("a declared pair is measured against its threshold", () => {
  const { tokenFile } = project();
  const check = (declaredPairs, thresholds) =>
    findContrastFailures({
      tokenFile,
      block: "@theme",
      scanMarkup: false,
      declaredPairs,
      thresholds,
    });

  assert.deepEqual(check([{ fg: "--color-fg", bg: "--color-bg", why: "body text" }]).failures, []);

  const [failure] = check([
    { fg: "--color-fg-dim", bg: "--color-bg", why: "meta text" },
  ]).failures;
  assert.equal(failure.ratio.toFixed(2), "2.85");
  assert.equal(failure.need, 4.5);
  assert.equal(failure.reason, "2.85:1, needs 4.5:1");
  assert.equal(failure.source, "declared");

  const named = check([{ fg: "--color-fg-dim", bg: "--color-bg", need: "nonText", why: "a ring" }]);
  assert.equal(named.failures[0].need, 3);

  const numeric = check([{ fg: "--color-fg-dim", bg: "--color-bg", need: 2.5, why: "a ring" }]);
  assert.deepEqual(numeric.failures, []);

  const raised = check([{ fg: "--color-fg-dim", bg: "--color-bg", need: "largeText", why: "x" }], {
    largeText: 2,
  });
  assert.deepEqual(raised.failures, []);
});

test("a token the file never declares, or one contrast cannot resolve, fails loudly", () => {
  const { tokenFile } = project();
  const { failures } = findContrastFailures({
    tokenFile,
    block: "@theme",
    scanMarkup: false,
    declaredPairs: [
      { fg: "--color-ghost", bg: "--color-bg", why: "a token that moved" },
      { fg: "--color-fancy", bg: "--color-bg", why: "a token in oklch" },
    ],
  });
  assert.deepEqual(reasons(failures), [
    `--color-ghost on --color-bg: unknown token — not declared in ${tokenFile}`,
    "--color-fancy on --color-bg: unsupported token value — contrast needs a hex colour",
  ]);
});

test("an allowed pair is reported as a waiver, and its reason is required", () => {
  const { tokenFile } = project();
  const pair = { fg: "--color-fg-dim", bg: "--color-bg" };
  const { failures, waivers } = findContrastFailures({
    tokenFile,
    block: "@theme",
    scanMarkup: false,
    declaredPairs: [{ ...pair, why: "meta text" }],
    allow: [{ ...pair, why: "design: raising it re-draws every muted label" }],
  });
  assert.deepEqual(failures, []);
  assert.equal(waivers.length, 1);
  assert.equal(waivers[0].ratio.toFixed(2), "2.85");
  assert.equal(waivers[0].why, "meta text");
  assert.equal(waivers[0].waivedBecause, "design: raising it re-draws every muted label");

  assert.throws(
    () =>
      findContrastFailures({
        tokenFile,
        scanMarkup: false,
        declaredPairs: [{ ...pair, why: "meta text" }],
        allow: [pair],
      }),
    /needs a reason/,
  );
});

test("markup pairs a background with a foreground; a composited utility is skipped", () => {
  const { root, tokenFile } = project({
    "app/card.tsx": 'export const cls = "bg-bg text-fg-dim rounded-lg";',
    "app/faded.tsx": 'export const cls = "bg-bg/60 text-fg-dim";',
    "app/arbitrary.tsx": 'export const cls = "bg-[#123456] text-fg-dim";',
  });

  const { failures } = findContrastFailures({
    tokenFile,
    block: "@theme",
    roots: [root],
    declaredPairs: [],
  });
  assert.deepEqual(reasons(failures), ["--color-fg-dim on --color-bg: 2.85:1, needs 4.5:1"]);
  assert.ok(failures[0].why.startsWith("paired in "));
  assert.ok(failures[0].source.endsWith("app/card.tsx"));

  const declaredOnly = findContrastFailures({
    tokenFile,
    block: "@theme",
    roots: [root],
    scanMarkup: false,
  });
  assert.deepEqual(declaredOnly.failures, []);
});

test("the token file has no default", () => {
  assert.throws(() => findContrastFailures(), /needs \{ tokenFile \}/);
  assert.throws(() => findContrastFailures({ tokenFile: "" }), /needs \{ tokenFile \}/);
});
