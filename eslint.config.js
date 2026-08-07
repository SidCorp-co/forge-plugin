export default [
  {
    ignores: ["coverage/**"],
  },
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
