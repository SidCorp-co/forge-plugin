import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { findUnknownTokens } from "../../src/design/unknown-tokens.js";
import { tempRoom } from "../fixtures/room.js";

// `--color-warn` is the defect this exists for: two screens shipped
// `border-warn bg-warn-soft`, Tailwind emitted neither rule, and the banner had
// no border and no background for as long as anyone had been reading the class.
const CSS = `@theme {
  --color-bg: #ffffff;
  --color-warning: #d97706;
  --color-border: #e6e6eb;
  --text-sm: 13px;
  --radius-md: 6px;
  --tab-indicator-height: 2px;
}
.dark {
  --color-bg: #0a0a0b;
  --color-only-dark: #141416;
}
`;

const themes = [
  { name: "light", blocks: ["@theme"] },
  { name: "dark", blocks: ["@theme", ".dark"] },
];

function project(files, css = CSS) {
  const root = tempRoom("unknown tokens ");
  mkdirSync(path.join(root, "app"), { recursive: true });
  writeFileSync(path.join(root, "app", "globals.css"), css);
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(path.join(root, "app", name), content);
  }
  return { root, tokenFile: path.join(root, "app", "globals.css") };
}

const find = (files, options = {}) => {
  const { root, tokenFile } = project(files);
  return findUnknownTokens({ tokenFile, themes, roots: [root], ...options });
};

test("a utility naming a token nothing declares is reported with the name it asked for", () => {
  const found = find({
    "banner.jsx": 'export const cls = "rounded-md border border-warn bg-warn-soft p-4";\n',
  });

  assert.deepEqual(
    found.map((entry) => `${entry.candidate} ${entry.token} ${entry.missing.join()}`),
    ["border-warn --color-warn light,dark", "bg-warn-soft --color-warn-soft light,dark"],
  );
  assert.equal(found[0].line, 1);
  assert.match(found[0].file, /banner\.jsx$/);
});

test("a declared token, a keyword, a number and an opacity are all left alone", () => {
  const found = find({
    "card.jsx":
      'export const cls = "bg-bg/60 text-sm rounded-md border-2 border-border ' +
      'border-collapse text-center bg-transparent outline-none outline-offset-2 -mt-2";\n',
  });

  assert.deepEqual(found, []);
});

test("a name only one theme declares is missing from the others, and `dark:` asks only its own", () => {
  const found = find({
    "shell.jsx": 'export const cls = "bg-only-dark";\nexport const scoped = "dark:bg-only-dark";\n',
  });

  assert.deepEqual(
    found.map((entry) => `${entry.candidate} ${entry.missing.join()}`),
    ["bg-only-dark light"],
  );
});

test("a var() reference to a token no theme declares is the same finding as a class", () => {
  const found = find({
    "tile.jsx": 'export const style = { color: "var(--color-brand)" };\n',
  });

  assert.deepEqual(
    found.map((entry) => `${entry.candidate} ${entry.token}`),
    ["var(--color-brand) --color-brand"],
  );
});

test("a custom property the markup declares itself is not the token layer's to declare", () => {
  const found = find({
    "avatar.jsx":
      'export const size = "[--avatar-size:32px] w-[var(--avatar-size)]";\n' +
      'export const pad = { "--color-local": "#fff" };\n' +
      'export const use = "text-[var(--color-local)]";\n',
  });

  assert.deepEqual(found, []);
});

test("references outside the checked namespaces are somebody else's variables", () => {
  const found = find({ "table.jsx": 'export const cls = "h-[var(--table-row-h)]";\n' });

  assert.deepEqual(found, []);
});

test("a bare var() where the property could take a length compiles to the wrong one", () => {
  const found = find({
    "tab.jsx":
      'export const bad = "border-b-[var(--tab-indicator-height)]";\n' +
      'export const hinted = "border-b-[length:var(--tab-indicator-height)]";\n' +
      'export const colour = "border-[var(--color-border)]";\n',
  });

  assert.deepEqual(
    found.map((entry) => `${entry.kind} ${entry.candidate} ${entry.token}`),
    ["ambiguous arbitrary value border-b-[var(--tab-indicator-height)] --tab-indicator-height"],
  );
});

test("an exempt file is not scanned, and a token file is required", () => {
  const { root, tokenFile } = project({ "old.jsx": 'export const cls = "bg-warn";\n' });

  assert.deepEqual(
    findUnknownTokens({ tokenFile, themes, roots: [root], exemptFiles: ["app/old.jsx"] }),
    [],
  );
  assert.throws(() => findUnknownTokens({ roots: [root] }), /needs \{ tokenFile \}/);
});

// A token layer that starts `@import "some-css-framework"` declares everything the
// import brings. Reading the file alone reported the whole default theme missing,
// so every `font-bold` and `animate-spin` in the repo was a finding.
test("an imported stylesheet's tokens are declared", () => {
  const root = tempRoom("imported-");
  const pkg = path.join(root, "node_modules", "css-framework");
  mkdirSync(pkg, { recursive: true });
  writeFileSync(
    path.join(pkg, "package.json"),
    JSON.stringify({ name: "css-framework", exports: { ".": { style: "./index.css" } } }),
  );
  writeFileSync(path.join(pkg, "index.css"), "@theme default { --font-weight-bold: 700; }\n");
  mkdirSync(path.join(root, "app"), { recursive: true });
  const tokenFile = path.join(root, "app", "tokens.css");
  writeFileSync(tokenFile, `@import "css-framework";\n@theme { --color-bg: #ffffff; }\n`);
  writeFileSync(
    path.join(root, "app", "page.tsx"),
    `export const a = <p className="font-bold bg-bg" />;\nexport const b = <p className="font-heavy" />;\n`,
  );

  const found = findUnknownTokens({ tokenFile, roots: [path.join(root, "app")] });
  assert.deepEqual(
    found.map((one) => one.token),
    ["--font-heavy"],
  );
});

// A gradient's direction is part of the utility. Tailwind 4 names it `bg-linear-to-*`
// and still ships 3's `bg-gradient-to-*`; both emit a real rule, and neither asks the
// theme for a colour called `to-br`.
test("a gradient direction is a keyword, not a colour", () => {
  assert.deepEqual(
    find({ "page.tsx": `export const a = <p className="bg-gradient-to-br bg-linear-to-r" />;` }),
    [],
  );
});

// A branch inside `${…}` is where a conditional class lives, and the quote closing it
// is not part of the class: reading it as one asks the palette for `--color-warn'`,
// which no stylesheet can declare and no reader can act on.
test("a quote around an interpolated branch is not part of the token it names", () => {
  const found = find({
    "toggle.tsx": "export const a = <p className={`rounded-md ${on ? 'bg-warning text-warn' : ''}`} />;",
  });

  assert.deepEqual(
    found.map((one) => `${one.candidate} ${one.token}`),
    ["text-warn --color-warn"],
  );
});

// A Content-Security-Policy directive is space-separated like a class attribute and
// its first word carries a Tailwind namespace, so `font-src 'self'` asked the palette
// for a font called `src` on every project that sets a CSP header in its config.
test("a quoted word says the literal is not a class list", () => {
  assert.deepEqual(
    find({
      "next.config.mjs":
        "export const csp = [\"font-src 'self' data:\", \"style-src 'self'\"].join('; ');\n",
    }),
    [],
  );
});

// `content-['*']` is the one class that carries a quote, and it carries it inside the
// brackets that make it an arbitrary value.
test("a quote inside brackets leaves the literal a class list", () => {
  assert.deepEqual(
    find({ "star.tsx": `export const a = <p className="content-['*'] text-warn" />;` }).map(
      (one) => one.token,
    ),
    ["--color-warn"],
  );
});
