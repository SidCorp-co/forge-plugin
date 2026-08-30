import codeQuality from "./src/index.js";

export default [
  {
    ignores: ["coverage/**"],
  },

  // The plugin holds itself to the rules it ships.
  ...codeQuality.configs.recommended,

  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { console: "readonly", process: "readonly", Buffer: "readonly" },
    },
    rules: {
      "no-unused-vars": "error",
      "no-undef": "error",
      "no-redeclare": "error",
      "no-unreachable": "error",
      "prefer-const": "error",
      "eqeqeq": "error",
    },
  },
];
