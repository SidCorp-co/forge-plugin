import { RuleTester } from "eslint";
import test from "node:test";
import rule from "../../src/design/no-arbitrary-sizes.js";

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

const REMEDY = {
  text: "Use a step from the type ramp.",
  radius: "Use a radius step.",
  leading: "Use a line-height step.",
  height: "Use a height token.",
  padding: "Use a control padding token.",
};

test("ramp values pass, arbitrary ones do not", () => {
  tester.run("no-arbitrary-sizes", rule, {
    valid: [
      '<div className="text-sm rounded-lg leading-normal h-10" />',
      '<div className="w-[240px] min-w-[560px]" />',
      '<div className="gap-[3px] top-[7px]" />',
    ],
    invalid: [
      {
        code: '<span className="text-[11px]" />',
        errors: [
          {
            messageId: "arbitrarySize",
            data: { value: "text-[11px]", family: "font size", remedy: REMEDY.text },
          },
        ],
      },
      {
        code: '<div className="rounded-[9px]" />',
        errors: [
          {
            messageId: "arbitrarySize",
            data: { value: "rounded-[9px]", family: "radius", remedy: REMEDY.radius },
          },
        ],
      },
      { code: '<div className="rounded-tl-[9px]" />', errors: 1 },
      {
        code: '<p className="leading-[1.45]" />',
        errors: [
          {
            messageId: "arbitrarySize",
            data: { value: "leading-[1.45]", family: "line height", remedy: REMEDY.leading },
          },
        ],
      },
      { code: '<div className="h-[150px]" />', errors: 1 },
      { code: '<div className="min-h-[280px]" />', errors: 1 },
      { code: '<div className="size-[18px]" />', errors: 1 },
      { code: 'const cls = "md:text-[13px]";', errors: 1 },
      { code: "const cls = `flex ${gap} rounded-[3px]`;", errors: 1 },
    ],
  });
});

test("a value reaching a token through var() or calc() is the point of the scale", () => {
  tester.run("no-arbitrary-sizes", rule, {
    valid: [
      '<div className="h-[var(--control-height-lg)]" />',
      '<div className="text-[calc(var(--avatar-size)*0.45)]" />',
      '<button className="px-[var(--button-padding-x-md)]" />',
      '<div className="rounded-[calc(var(--radius-lg)-1px)]" />',
    ],
    invalid: [],
  });
});

test("padding is judged on interactive elements only", () => {
  tester.run("no-arbitrary-sizes", rule, {
    valid: [
      '<div className="p-[3px]" />',
      '<section className="px-[7px]"><span className="py-[2px]" /></section>',
      'const cls = "p-[3px]";',
      { code: '<button className="p-[3px]" />', options: [{ onInteractive: [] }] },
    ],
    invalid: [
      {
        code: '<button className="px-[7px]" />',
        errors: [
          {
            messageId: "arbitrarySize",
            data: { value: "px-[7px]", family: "padding", remedy: REMEDY.padding },
          },
        ],
      },
      { code: '<Link className="p-[3px]" />', errors: 1 },
      { code: '<div onClick={go} className="p-[3px]" />', errors: 1 },
      { code: '<div role="tab" className="pt-[5px]" />', errors: 1 },
      { code: '<div className="cursor-pointer pb-[5px]" />', errors: 1 },
      {
        code: '<Chip className="p-[3px]" />',
        options: [{ interactive: { elements: ["Chip"] } }],
        errors: 1,
      },
      {
        code: '<div data-control className="p-[3px]" />',
        options: [{ interactive: { attributes: ["data-control"] } }],
        errors: 1,
      },
    ],
  });
});

test("families, units, allowed values and exempt files are the project's to set", () => {
  tester.run("no-arbitrary-sizes", rule, {
    valid: [
      { code: '<span className="text-[11px]" />', options: [{ everywhere: [] }] },
      {
        code: '<div className="h-[720px]" />',
        filename: "src/mobile/phone-frame.tsx",
        options: [
          {
            allow: [
              {
                file: "src/mobile/phone-frame.tsx",
                value: "h-[720px]",
                why: "illustration: the mock phone's screen is drawn geometry",
              },
            ],
          },
        ],
      },
      {
        code: '<span className="text-[11px]" />',
        filename: "src/legacy/table.tsx",
        options: [{ exemptFiles: ["src/legacy/**"] }],
      },
      { code: '<div className="w-[3ch]" />', options: [{ units: ["px"] }] },
    ],
    invalid: [
      {
        code: '<div className="h-[720px]" />',
        filename: "src/other.tsx",
        options: [
          {
            allow: [
              { file: "src/mobile/phone-frame.tsx", value: "h-[720px]", why: "illustration" },
            ],
          },
        ],
        errors: 1,
      },
      {
        code: '<div className="gap-[3px]" />',
        options: [
          {
            everywhere: [{ name: "gap", prefixes: ["gap"], hint: "Use a spacing step." }],
            tokenSource: "app/globals.css",
          },
        ],
        errors: [
          {
            messageId: "arbitrarySize",
            data: {
              value: "gap-[3px]",
              family: "gap",
              remedy: "Use a spacing step. The scale lives in app/globals.css.",
            },
          },
        ],
      },
      {
        code: '<div className="h-[7vmin]" />',
        options: [{ units: ["vmin"] }],
        errors: 1,
      },
    ],
  });
});

test("a font size written as a declaration is caught too, not just as a utility", () => {
  tester.run("no-arbitrary-sizes", rule, {
    valid: [
      'const style = { fontSize: "var(--text-sm)" };',
      'const style = { fontSize: "calc(var(--text-sm) * 1.2)" };',
      'const style = { fontSize: "inherit" };',
      "const style = { fontSize: ramp.sm };",
      // Height has no `properties`, so a declaration of one is layout as before.
      "const style = { height: 720 };",
      {
        code: "const style = { fontSize: 13 };",
        options: [{ allow: [{ value: "13", why: "a canvas label, drawn not laid out" }] }],
      },
    ],
    invalid: [
      {
        code: "const style = { fontSize: 13 };",
        errors: [{ message: `"13" is an arbitrary font size value. ${REMEDY.text}` }],
      },
      {
        code: 'const style = { "font-size": "0.875rem" };',
        errors: [{ message: `"0.875rem" is an arbitrary font size value. ${REMEDY.text}` }],
      },
      {
        code: '<text fontSize="11" />',
        errors: [{ message: `"11" is an arbitrary font size value. ${REMEDY.text}` }],
      },
    ],
  });
});
