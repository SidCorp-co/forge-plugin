import { configure } from "eslint-plugin-code-quality";

export default [
  // Each carries its own config: check-vendor.mjs and `npm run check:package` cover these two.
  { ignores: ["plugin/hooks/vendor/**", "packages/**"] },
  ...configure({
    "no-historical-narration": "error",
    "comment-density": "error",
    "max-consecutive-comment-lines": "error",
    "no-pass-through-wrapper": "error",
    "max-lines": "error",
    "max-lines-per-function": "error",
  }),
  {
    files: ["**/*.mjs", "**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        AbortController: "readonly",
        AbortSignal: "readonly",
        Buffer: "readonly",
        clearTimeout: "readonly",
        console: "readonly",
        fetch: "readonly",
        globalThis: "readonly",
        performance: "readonly",
        process: "readonly",
        setTimeout: "readonly",
        structuredClone: "readonly",
        TextDecoder: "readonly",
        TextEncoder: "readonly",
        URL: "readonly",
      },
    },
    rules: {
      "no-unused-vars": "error",
      "no-undef": "error",
      "no-redeclare": "error",
      "no-unreachable": "error",
      "prefer-const": "error",
      eqeqeq: "error",
      quotes: ["error", "double", { allowTemplateLiterals: true, avoidEscape: true }],
    },
  },
];
