#!/usr/bin/env node

// A developer/CI gate, intentionally separate from any production build: it
// reports only the rules this plugin enables and ignores every other finding.
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { ESLint } from "eslint";
import {
  CROWDED_DIRECTORY_DIRECTIVE,
  DEFAULT_IGNORED_DIRECTORIES,
  DEFAULT_MAX_FILES_PER_DIRECTORY,
  directivesFor,
  enabledRuleIds,
  findCrowdedDirectories,
  findInlineWarningGaps,
  FIX_POLICY,
  SOURCE_EXTENSIONS,
} from "../src/index.js";

const USAGE = `Usage: code-quality-gate [paths...] [options]

  --max-files-per-dir=N   directory width limit (default ${DEFAULT_MAX_FILES_PER_DIRECTORY})
  --ignore-dir=a,b        directory names to skip, added to the defaults
  --ext=.vue,.svelte      extra source extensions to count
  --no-folder-check       skip the directory width check
  --no-inline-warning     skip the form-control inline error check
  --inline-warning-all    judge feature screens too, not the design system alone
  --help                  show this message

Fails on this plugin's rules reported as errors, and on directories over the
width limit. Warnings and every other rule are left to \`eslint\`.
`;

const args = process.argv.slice(2);
if (args.includes("--help")) {
  process.stdout.write(USAGE);
  process.exit(0);
}

const roots = args.filter((argument) => !argument.startsWith("-"));
if (roots.length === 0) roots.push(".");

function listFlag(name) {
  const flag = args.find((argument) => argument.startsWith(`${name}=`));
  return flag ? flag.slice(name.length + 1).split(",").filter(Boolean) : [];
}

const [limit] = listFlag("--max-files-per-dir");
const maxFilesPerDirectory = limit === undefined ? DEFAULT_MAX_FILES_PER_DIRECTORY : Number(limit);
if (!Number.isInteger(maxFilesPerDirectory) || maxFilesPerDirectory < 1) {
  process.stderr.write("code-quality-gate: --max-files-per-dir= needs a positive integer\n");
  process.exit(2);
}

const ignoredDirectories = new Set([...DEFAULT_IGNORED_DIRECTORIES, ...listFlag("--ignore-dir")]);
const extensions = new Set([
  ...SOURCE_EXTENSIONS,
  ...listFlag("--ext").map((value) => (value.startsWith(".") ? value : `.${value}`).toLowerCase()),
]);

const BLOCKING_RULES = enabledRuleIds();

const CONFIG_NAMES = ["js", "mjs", "cjs", "ts", "mts", "cts"].map((ext) => `eslint.config.${ext}`);
const hasConfig = (dir) => CONFIG_NAMES.some((name) => existsSync(path.join(dir, name)));

/**
 * The directories to lint from. A repository that keeps its packages side by side has no
 * config at its root, and ESLint throws there rather than looking down, so the gate finds
 * the packages itself instead of failing on the most natural place to run it.
 */
function workspaces() {
  const here = process.cwd();
  if (hasConfig(here)) return [here];

  const found = [];
  const queue = [here];
  while (queue.length > 0 && found.length < 50) {
    const directory = queue.shift();
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      if (DEFAULT_IGNORED_DIRECTORIES.has(entry.name) || entry.name === "worktrees") continue;
      const child = path.join(directory, entry.name);
      if (hasConfig(child)) found.push(child);
      else queue.push(child);
    }
  }
  return found;
}

const targets = workspaces();
if (targets.length === 0) {
  process.stderr.write("code-quality-gate: no ESLint config here or in any package below it\n");
  process.exit(2);
}

const eslint = new ESLint({ cwd: targets[0] });
const results = (
  await Promise.all(
    targets.map((cwd) => new ESLint({ cwd }).lintFiles(cwd === process.cwd() ? roots : [cwd])),
  )
).flat();
const blockingResults = results
  .map((result) => {
    // Severity is the project's own decision to gate or merely observe, so a
    // rule this plugin enables at `warn` stays out of the exit code.
    const messages = result.messages.filter(
      (message) => message.severity === 2 && BLOCKING_RULES.has(message.ruleId),
    );
    return {
      ...result,
      messages,
      errorCount: messages.length,
      fatalErrorCount: 0,
      warningCount: 0,
      fixableErrorCount: 0,
      fixableWarningCount: 0,
    };
  })
  .filter((result) => result.messages.length > 0);

if (blockingResults.length > 0) {
  const formatter = await eslint.loadFormatter("stylish");
  process.stderr.write(formatter.format(blockingResults));
  const directives = directivesFor(
    blockingResults.flatMap((result) => result.messages.map((message) => message.ruleId)),
  );
  if (directives.length > 0) process.stderr.write(`${directives.join("\n")}\n`);
  process.exitCode = 1;
}

if (!args.includes("--no-folder-check")) {
  const crowded = findCrowdedDirectories({
    roots,
    max: maxFilesPerDirectory,
    ignoredDirectories,
    extensions,
  });
  if (crowded.length > 0) {
    // One directive under the whole list: repeating it per directory would be
    // the longest part of a report that already names the same fix each time.
    const report = crowded
      .map(
        ({ directory, count }) =>
          `${path.relative(process.cwd(), directory) || "."}\n  ${count} source files, limit ` +
          `${maxFilesPerDirectory}`,
      )
      .join("\n");
    process.stderr.write(
      `\nDirectories over the file limit:\n\n${report}\n\n${CROWDED_DIRECTORY_DIRECTIVE}\n`,
    );
    process.exitCode = 1;
  }
}

if (!args.includes("--no-inline-warning")) {
  const { waivers, violations } = findInlineWarningGaps({
    roots,
    all: args.includes("--inline-warning-all"),
  });
  const lines = [
    ...waivers.map((w) => `  waived  ${w.file}:${w.line}  ${w.component}\n      ${w.reason}`),
    ...violations.map((v) => `  ${v.file}:${v.line}  ${v.component}\n      ${v.reason}`),
  ];
  if (lines.length > 0) {
    process.stderr.write(`\nForm controls that cannot announce an error:\n\n${lines.join("\n")}\n`);
  }
  if (violations.length > 0) process.exitCode = 1;
}

if (process.exitCode === 1) process.stderr.write(`\n${FIX_POLICY}\n`);
