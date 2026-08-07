---
name: setup-code-quality
description: Set up eslint-plugin-code-quality, its god-file limits, and its Claude Code edit hook in the current Node project. Use when the hook reports a missing plugin or configuration, when a project has no ESLint at all, or when the user asks to install or configure code-quality linting.
version: 0.4.0
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

   `configs.recommended` is an array: the comment rules, the god-file limits, and a test-file override that drops the per-function limit. Use `configs.comments` or `configs.godFiles` to adopt one half only, and `commentsConfig({ maxRatio, maxConsecutiveCommentLines, severity, narration })` or `godFilesConfig({ maxFileCodeLines, maxFunctionCodeLines, testGlobs, severity })` when the project needs different limits.

   In a codebase that has never run these checks, run the recommended config once to see the volume. If it is large, install `configs.adopting` instead — the same rules at `warn`, which neither fails the gate nor blocks the edit hook — and tell the user which rules to promote to `error` first. Never propose per-file exemption lists as the way in.
4. If the project builds its config in another supported flat-config form, preserve that form and append the equivalent recommended config.
5. Add a CI gate script: `"lint:code-quality": "code-quality-gate"`. It fails only on this plugin's rules reported as errors, plus directories over the file-count limit.
6. Run the project's lint command and report the findings. Do not fix them during setup: the task was to install the checks, and a first run on an existing codebase is usually large enough to need its own pass. Point at `/code-quality:audit-code-quality` for that.
7. Report the files changed and the exact validation command and result.

The edit hook invokes only the project's local ESLint executable. It never uses `npx`, downloads packages, or supplies a replacement config.
