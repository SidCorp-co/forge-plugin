import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { RuleTester } from "eslint";
import test from "node:test";
import noRawElements, { DEFAULT_PRIMITIVES, primitiveExports } from "../../src/design/no-raw-elements.js";

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

// Outside any design-system directory, so the rule judges it the way it judges a screen.
const screen = "app/settings/page.tsx";

test("the elements a primitive owns, and the ones no primitive does", () => {
  tester.run("no-raw-elements", noRawElements, {
    valid: [
      { code: "const a = <Select value={v} />;", filename: screen },
      { code: "const a = <div><span>x</span></div>;", filename: screen },
      // Neither type is a control a primitive can own.
      { code: 'const a = <input type="hidden" name="id" />;', filename: screen },
      { code: 'const a = <input type="file" />;', filename: screen },
      // The primitive has to render the element it owns, and the file exporting it is where.
      {
        code: "export function Button() {\n  return <button className='x' />;\n}",
        filename: "components/ui/button.tsx",
      },
      // One file may define several: sid-youtube's Select, Input and Textarea share one.
      {
        code: [
          "export const Input = () => <input />;",
          "export const Select = () => <select />;",
          "export const Textarea = () => <textarea />;",
        ].join("\n"),
        filename: "src/ui/forms/input.tsx",
      },
    ],
    invalid: [
      {
        code: "const a = <select value={v} />;",
        filename: screen,
        errors: [{ messageId: "rawElement" }],
      },
      {
        code: "const a = <button onClick={f}>Save</button>;",
        filename: screen,
        errors: 1,
      },
      {
        code: 'const a = <input type="text" />;',
        filename: screen,
        errors: 1,
      },
      { code: "const a = <textarea />;", filename: screen, errors: 1 },
      { code: "const a = <h1>Providers</h1>;", filename: screen, errors: 1 },
      { code: "const a = <h2>Configured</h2>;", filename: screen, errors: 1 },
      { code: "const a = <h4>Models</h4>;", filename: screen, errors: 1 },
    ],
  });
});

test("a heading on the ramp is a section that owns its heading, not a card", () => {
  tester.run("no-raw-elements", noRawElements, {
    valid: [
      {
        code: 'const a = <h2 className="fg-h3 mb-1">Optional metadata</h2>;',
        filename: screen,
        options: [{ rampClasses: ["fg-"] }],
      },
    ],
    invalid: [
      {
        code: "const a = <h2>Configured providers</h2>;",
        filename: screen,
        options: [{ rampClasses: ["fg-"] }],
        errors: 1,
      },
      // The escape is the ramp step, so a class that is not one does not open it.
      {
        code: 'const a = <h2 className="text-2xl font-bold">Configured</h2>;',
        filename: screen,
        options: [{ rampClasses: ["fg-"] }],
        errors: 1,
      },
      // h5 and h6 are outside the default map either way.
      { code: "const a = <h5>Deep</h5>;", filename: screen, options: [{ rampClasses: ["fg-"] }], errors: 0 },
    ].filter((entry) => entry.errors > 0),
  });
});

test("a waiver needs a reason, and covers the element under it", () => {
  tester.run("no-raw-elements", noRawElements, {
    valid: [
      {
        code: [
          "const a = (",
          "  <li>",
          "    {/* primitive: none — the whole row is the control, and Button cannot carry a row's layout */}",
          "    <button onClick={f}><span>Title</span></button>",
          "  </li>",
          ");",
        ].join("\n"),
        filename: screen,
      },
    ],
    invalid: [
      // A bare marker waives nothing: the reason is the point.
      {
        code: "// primitive: none\nconst a = <button />;",
        filename: screen,
        errors: 1,
      },
      // One waiver, two raw elements: the second is still a finding.
      {
        code: [
          "const a = (",
          "  <div>",
          "    {/* primitive: none — a selectable tile, which Button does not model */}",
          "    <button aria-pressed={p} />",
          "    <button onClick={f}>Save</button>",
          "  </div>",
          ");",
        ].join("\n"),
        filename: screen,
        errors: 1,
      },
    ],
  });
});

test("inside the system, a second raw element is a variant that was never added", () => {
  tester.run("no-raw-elements", noRawElements, {
    valid: [
      // Switched off, the whole system is skipped again — adoption over screens first.
      {
        code: "export function IconButton() {\n  return <button />;\n}",
        filename: "components/ui/foundation/icon-button.tsx",
        options: [{ systemVariants: false }],
      },
    ],
    invalid: [
      {
        code: "export function IconButton() {\n  return <button aria-label='x' />;\n}",
        filename: "components/ui/foundation/icon-button.tsx",
        errors: [
          {
            message:
              "Raw <button> inside the design system, in a file that does not define Button. " +
              "Add the variant to Button and compose it here, rather than a second <button> " +
              "carrying its own copy of the focus ring and the disabled semantics. " +
              'Compose Button.',
          },
        ],
      },
      // A pattern is as much of the system as a primitive, and gets the same message.
      {
        code: "export function TopBar() {\n  return <button />;\n}",
        filename: "src/ui/patterns/top-bar.tsx",
        errors: [{ messageId: "systemVariant" }],
      },
      // The waiver works here too, and its reason is what says which control this is.
      {
        code: "export function Radio() {\n  return <button role='radio' />;\n}",
        filename: "components/ui/radio.tsx",
        errors: [{ messageId: "systemVariant" }],
      },
    ],
  });
});

test("an exempt path is matched by tail or by glob, as in the token rules", () => {
  tester.run("no-raw-elements", noRawElements, {
    valid: [
      { code: "const a = <button />;", filename: screen, options: [{ exemptFiles: ["app/settings/page.tsx"] }] },
      { code: "const a = <button />;", filename: screen, options: [{ exemptFiles: ["app/**"] }] },
    ],
    invalid: [
      {
        code: "const a = <button />;",
        filename: screen,
        options: [{ exemptFiles: ["app/other/page.tsx"] }],
        errors: 1,
      },
    ],
  });
});

test("a message names where the primitive is imported from", () => {
  tester.run("no-raw-elements", noRawElements, {
    valid: [],
    invalid: [
      {
        code: "const a = <select />;",
        filename: screen,
        options: [{ importPath: "@/components/ui" }],
        errors: [
          {
            message:
              "Raw <select> duplicates Select from @/components/ui, which owns the field metrics " +
              'and a chevron, the OS one being unrestylable. Compose Select.',
          },
        ],
      },
    ],
  });
});

test("only what the design system exports is a finding", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "primitives-"));
  writeFileSync(
    path.join(dir, "index.ts"),
    [
      'export { Button, type ButtonProps } from "./button";',
      'export { Select as Dropdown } from "./select";',
      "export function PageHeader() {}",
    ].join("\n"),
  );

  const exported = primitiveExports(dir);
  assert.deepEqual([...exported].sort(), ["Button", "ButtonProps", "Dropdown", "PageHeader"]);
  assert.equal(primitiveExports(path.join(dir, "missing.ts")), null);

  // A star barrel names nothing itself, and treating that as "exports nothing" would pass
  // every raw element in the project in silence.
  const starred = mkdtempSync(path.join(tmpdir(), "primitives-star-"));
  mkdirSync(path.join(starred, "controls"));
  writeFileSync(path.join(starred, "index.ts"), 'export * from "./controls/button";\n');
  writeFileSync(
    path.join(starred, "controls", "button.tsx"),
    "export function Button() {}\nexport const InputField = () => null;\n",
  );
  assert.deepEqual([...primitiveExports(starred)].sort(), ["Button", "InputField"]);

  tester.run("no-raw-elements", noRawElements, {
    valid: [
      // The system exports no Select and no CardTitle, so neither has anything to point at.
      { code: "const a = <select />;", filename: screen, options: [{ source: dir }] },
      { code: "const a = <h2>x</h2>;", filename: screen, options: [{ source: dir }] },
    ],
    invalid: [
      { code: "const a = <button />;", filename: screen, options: [{ source: dir }], errors: 1 },
      { code: "const a = <h1>x</h1>;", filename: screen, options: [{ source: dir }], errors: 1 },
    ],
  });
});

// sid-growth wrote 202 lines around this: the barrel stopped exporting a primitive its config
// still named, and the rule answered by judging no <select> anywhere and saying nothing.
test("a configured primitive the barrel does not export is reported, not skipped", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "primitives-gap-"));
  writeFileSync(path.join(dir, "index.ts"), "export function Button() {}\n");
  const primitives = { select: { primitive: "Select", owns: "the field metrics" } };

  tester.run("no-raw-elements", noRawElements, {
    valid: [
      // The default map is a guess about a project, so a primitive it lacks is not a defect.
      { code: "const a = <select />;", filename: screen, options: [{ source: dir }] },
      {
        code: "// primitive: none — the OS picker is the control here\nconst a = <select />;",
        filename: screen,
        options: [{ source: dir, primitives }],
      },
    ],
    invalid: [
      {
        code: "const a = <select />;",
        filename: screen,
        options: [{ source: dir, primitives }],
        errors: [{ messageId: "missingPrimitive" }],
      },
    ],
  });
});

test("the map is the mechanism: an element absent from it is never judged", () => {
  assert.deepEqual(Object.keys(DEFAULT_PRIMITIVES).sort(), [
    "button",
    "h1",
    "h2",
    "h3",
    "h4",
    "input",
    "select",
    "textarea",
  ]);

  tester.run("no-raw-elements", noRawElements, {
    valid: [{ code: "const a = <button />;", filename: screen, options: [{ primitives: {} }] }],
    invalid: [
      {
        code: "const a = <table />;",
        filename: screen,
        options: [{ primitives: { table: { primitive: "DataTable", owns: "its empty and error rows" } } }],
        errors: [
          {
            message:
              "Raw <table> duplicates DataTable, which owns its empty and error rows. " +
              'Compose DataTable.',
          },
        ],
      },
    ],
  });
});
