---
name: setup-code-quality
description: Set up eslint-plugin-code-quality, its god-file limits, and its Claude Code edit hook in the current Node project. Use when the hook reports missing ESLint, plugin, or configuration, or when the user asks to install or configure code-quality linting.
version: 0.2.0
---

# Set up code-quality linting

Configure the current project; do not modify files outside it.

1. Inspect the package manager lockfile and existing ESLint flat configuration.
2. Install `eslint` and `eslint-plugin-code-quality` as development dependencies with the project's package manager. Do not use a global install.
3. Add the plugin's recommended flat config without removing existing configuration:

   ```js
   import codeQuality from "eslint-plugin-code-quality";

   export default [
     // existing entries
     ...codeQuality.configs.recommended,
   ];
   ```

   `configs.recommended` is an array: the comment rules, the god-file limits, and a test-file override that drops the per-function limit. Use `configs.comments` or `configs.godFiles` to adopt one half only, and `godFilesConfig({ maxFileCodeLines, maxFunctionCodeLines, testGlobs, severity })` when the project needs different limits.
4. If the project builds its config in another supported flat-config form, preserve that form and append the equivalent recommended config.
5. Add a blocking gate script if the project wants one in CI: `"lint:god-files": "code-quality-gate"`. The gate lints the project and fails only on `max-lines`, `max-lines-per-function`, and the `code-quality/*` rules.
6. Run the project's lint command and report the findings. Do not bulk-fix them during setup: comment findings are review material, not autofixable, and existing oversized files usually need a narrow, explicit override list rather than a rule disabled for a whole directory.
7. Report the files changed and the exact validation command and result.

The edit hook invokes only the project's local ESLint executable. It never uses `npx`, downloads packages, or supplies a replacement config.
