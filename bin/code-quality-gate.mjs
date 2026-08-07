#!/usr/bin/env node

// A developer/CI gate, intentionally separate from any production build: it
// reports only the blocking rules and ignores every other finding.
import { ESLint } from "eslint";
import {
  DEFAULT_MAX_FILES_PER_DIRECTORY,
  findCrowdedDirectories,
  formatCrowdedDirectories,
} from "../src/folder-size.js";

const BLOCKING_RULES = new Set([
  "max-lines",
  "max-lines-per-function",
  "code-quality/no-historical-narration",
  "code-quality/comment-density",
  "code-quality/max-consecutive-comment-lines",
]);

const args = process.argv.slice(2);
const targets = args.filter((argument) => !argument.startsWith("-"));
const roots = targets.length > 0 ? targets : ["."];

function flagValue(name) {
  const inline = args.find((argument) => argument.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

const maxFilesPerDirectory = Number(
  flagValue("--max-files-per-dir") ?? DEFAULT_MAX_FILES_PER_DIRECTORY,
);
if (!Number.isInteger(maxFilesPerDirectory) || maxFilesPerDirectory < 1) {
  process.stderr.write("code-quality-gate: --max-files-per-dir needs a positive integer\n");
  process.exit(2);
}

const eslint = new ESLint();
const results = await eslint.lintFiles(roots);
const blockingResults = results
  .map((result) => {
    const messages = result.messages.filter((message) => BLOCKING_RULES.has(message.ruleId));
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
  process.exitCode = 1;
}

if (!args.includes("--no-folder-check")) {
  const crowded = findCrowdedDirectories({ roots, max: maxFilesPerDirectory });
  if (crowded.length > 0) {
    process.stderr.write(
      `\nDirectories over the file limit:\n\n${formatCrowdedDirectories(crowded, {
        max: maxFilesPerDirectory,
      })}\n\n`,
    );
    process.exitCode = 1;
  }
}
