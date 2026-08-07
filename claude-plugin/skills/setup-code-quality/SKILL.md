---
name: setup-code-quality
description: Set up eslint-plugin-code-quality, its god-file limits, and its Claude Code edit hook in the current Node project. Use when the hook reports a missing plugin or configuration, when a project has no ESLint at all, or when the user asks to install or configure code-quality linting.
version: 0.4.0
---

# Set up code-quality linting

Configure the current project; do not modify files outside it.

1. Inspect the package manager lockfile and existing ESLint flat configuration.
2. Install `eslint` and `eslint-plugin-code-quality` as development dependencies with the project's package manager. Do not use a global install.

   This plugin may not be published. `404 Not Found ... is not in the npm registry` means it is installed from a local checkout in this environment, not that the name is wrong — find the checkout and depend on the path. Never publish it, and never rename the dependency to something that does resolve.

   ```sh
   ls -d ../*/package.json | xargs grep -l '"name": "eslint-plugin-code-quality"'
   ```

   npm and yarn symlink a `file:` dependency, so `npm i -D eslint file:../eslint-plugin-code-quality` tracks the checkout. **pnpm copies a `file:` dependency into its store**, which strands the project on a snapshot that no later edit reaches; use pnpm's `link:` protocol instead, and add the workspace-root flag when the project is a pnpm workspace:

   ```sh
   pnpm add -Dw eslint link:../eslint-plugin-code-quality
   ```

   Install `eslint` from the registry in the same command — only the plugin needs the path.
3. A TypeScript project needs a parser, and which one is not a free choice. Read the project's TypeScript version first:

   ```sh
   node -p "require('typescript/package.json').version"
   npm view @typescript-eslint/parser@latest peerDependencies.typescript
   ```

   Inside that range, use `@typescript-eslint/parser`. Outside it — TypeScript 7 is outside it today — the parser throws at module load with `typescript-eslint does not support TS 7.0`, and no published version fixes it. Do not downgrade the project's TypeScript to satisfy a linter.

   Reach for `@babel/eslint-parser` instead. It reads TypeScript as syntax and never loads `typescript`, which is all these rules need: they count comments, lines, and function boundaries, never types.

   ```sh
   pnpm add -Dw @babel/core @babel/eslint-parser @babel/preset-typescript @babel/plugin-syntax-jsx
   ```

   ```js
   import babelParser from "@babel/eslint-parser";

   // JSX for .tsx alone: enabled for .ts it reads `<T,>(v: T) => v` as an unclosed element.
   const typescript = (jsx) => ({
     requireConfigFile: false,
     babelOptions: {
       presets: ["@babel/preset-typescript"],
       plugins: jsx ? ["@babel/plugin-syntax-jsx"] : [],
     },
   });

   { files: ["**/*.{ts,mts,cts}"], languageOptions: { parser: babelParser, parserOptions: typescript(false) } },
   { files: ["**/*.{tsx,jsx}"], languageOptions: { parser: babelParser, parserOptions: typescript(true) } },
   ```

   Add `["@babel/plugin-proposal-decorators", { version: "legacy" }]` to `plugins` when the project sets `experimentalDecorators`; Babel 8 rejects the older `{ legacy: true }` spelling, and `allExtensions`/`isTSX` no longer exist. Verify by parse count, not by exit code: `npx eslint . --format json` and confirm zero `Parsing error` messages before reporting the setup done.
4. Add the plugin's recommended flat config without removing existing configuration:

   ```js
   import codeQuality from "eslint-plugin-code-quality";

   export default [
     // existing entries
     ...codeQuality.configs.recommended,
   ];
   ```

   `configs.recommended` is an array: the comment rules, the god-file limits, and a test-file override that drops the per-function limit. Use `configs.comments` or `configs.godFiles` to adopt one half only, and `commentsConfig({ maxRatio, maxConsecutiveCommentLines, severity, narration })` or `godFilesConfig({ maxFileCodeLines, maxFunctionCodeLines, testGlobs, severity })` when the project needs different limits.

   In a codebase that has never run these checks, run the recommended config once to see the volume. If it is large, install `configs.adopting` instead — the same rules at `warn`, which neither fails the gate nor blocks the edit hook — and tell the user which rules to promote to `error` first. Never propose per-file exemption lists as the way in.
5. If the project builds its config in another supported flat-config form, preserve that form and append the equivalent recommended config.
6. Add a CI gate script: `"lint:code-quality": "code-quality-gate"`. One run covers the whole repository — it finds the packages below the working directory when none is configured there — and fails on this plugin's rules reported as errors, directories over the file-count limit, and form controls that cannot announce an error.
7. Run the project's lint command and report the findings. Do not fix them during setup: the task was to install the checks, and a first run on an existing codebase is usually large enough to need its own pass. Point at `/code-quality:audit-code-quality` for that.
8. Report the files changed and the exact validation command and result.

The edit hook invokes only the project's local ESLint executable. It never uses `npx`, downloads packages, or supplies a replacement config.
