#!/usr/bin/env node

// Every mechanical step of adopting this plugin in one project: the dependency, the flat
// config, the settings file, the lint script. The severities are arguments because they are
// the only part a person has to decide; nothing here is guessed from the code.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RULE_IDS } from "../src/index.js";

const RULES = RULE_IDS.map((id) => id.replace("code-quality/", ""));
const SEVERITIES = new Set(["error", "warn", "off"]);
const SETTINGS = "code-quality.json";
const CONFIGS = ["eslint.config.mjs", "eslint.config.js", "eslint.config.cjs", "eslint.config.ts"];
const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const USAGE = `Usage: code-quality-setup [options]

  --<rule>=error|warn|off   one per rule, default error (design rules: off)
  --tokens=FILE             the CSS file colours and sizes belong in
  --hook=on|off             lint each file Claude Code edits (default on)
  --all-rules               gate on the project's own error rules too
  --dry-run                 print every file and command, write nothing
  --help                    show this message

Rules: ${RULES.join(", ")}
`;

const args = process.argv.slice(2);
if (args.includes("--help")) {
  process.stdout.write(USAGE);
  process.exit(0);
}

const dryRun = args.includes("--dry-run");
const steps = [];

function fail(message) {
  process.stderr.write(`code-quality-setup: ${message}\n`);
  process.exit(2);
}

function flag(name) {
  const found = args.find((argument) => argument.startsWith(`--${name}=`));
  return found === undefined ? undefined : found.slice(name.length + 3);
}

/** The severities, validated together so a typo never silently leaves a rule at error. */
function severities() {
  const chosen = {};
  for (const rule of RULES) {
    const value = flag(rule);
    if (value === undefined) continue;
    if (!SEVERITIES.has(value)) fail(`--${rule}= takes error, warn or off, not "${value}"`);
    chosen[rule] = value;
  }
  const unknown = args
    .filter((argument) => argument.startsWith("--") && argument.includes("="))
    .map((argument) => argument.slice(2, argument.indexOf("=")))
    .filter((name) => !RULES.includes(name) && !["tokens", "hook"].includes(name));
  if (unknown.length > 0) fail(`no rule named ${unknown.join(", ")}`);
  return chosen;
}

/** The lockfile decides, because a second package manager in one project splits the tree. */
function packageManager() {
  if (existsSync("pnpm-lock.yaml")) {
    // pnpm has no global link, and `file:` copies into the store — a snapshot no later
    // edit of the checkout ever reaches.
    const workspace = existsSync("pnpm-workspace.yaml");
    return { add: ["pnpm", "add", "-D", ...(workspace ? ["-w"] : [])], spec: "link:" };
  }
  if (existsSync("yarn.lock")) return { add: ["yarn", "add", "-D"], spec: "file:" };
  if (existsSync("bun.lockb")) return { add: ["bun", "add", "-d"], spec: "file:" };
  return { add: ["npm", "install", "--save-dev"], spec: "file:" };
}

function run(command) {
  steps.push(`$ ${command.join(" ")}`);
  if (dryRun) return;
  const result = spawnSync(command[0], command.slice(1), { encoding: "utf8", stdio: "inherit" });
  if (result.status !== 0) fail(`\`${command.join(" ")}\` failed`);
}

function write(file, contents) {
  steps.push(`wrote ${file}`);
  if (!dryRun) writeFileSync(file, contents);
}

/** TypeScript needs a parser; these rules read syntax and never types, so any parser will do. */
function dependencies(manager) {
  const wanted = ["eslint"];
  if (existsSync("tsconfig.json") || existsSync("tsconfig.base.json")) {
    wanted.push("@typescript-eslint/parser");
  }
  const declared = JSON.parse(readFileSync("package.json", "utf8"));
  const installed = { ...declared.dependencies, ...declared.devDependencies };
  const missing = wanted.filter((name) => installed[name] === undefined);
  const relative = path.relative(process.cwd(), packageRoot).split(path.sep).join("/");
  if (installed["eslint-plugin-code-quality"] === undefined) {
    missing.push(`${manager.spec}${relative}`);
  }
  return missing;
}

function renderCall(chosen, tokens, indent) {
  const lines = Object.entries(chosen).map(
    ([rule, severity]) => `${indent}  "${rule}": "${severity}",`,
  );
  if (tokens !== undefined) lines.push(`${indent}  tokens: { tokenSource: "${tokens}" },`);
  if (lines.length === 0) return "configure()";
  return `configure({\n${lines.join("\n")}\n${indent}})`;
}

function configFile(chosen, tokens) {
  const parser = existsSync("tsconfig.json") || existsSync("tsconfig.base.json");
  return `${parser ? 'import tsParser from "@typescript-eslint/parser";\n' : ""}\
import { configure } from "eslint-plugin-code-quality";

export default [
${parser ? '  { files: ["**/*.{ts,tsx,mts,cts}"], languageOptions: { parser: tsParser } },\n' : ""}\
  ...${renderCall(chosen, tokens, "  ")},
];
`;
}

/**
 * The answers replace the call they were last written into and nothing else, so a project that
 * has since added parsers, ignores or rules of its own keeps all of them. A config assembling
 * this plugin some other way is reported rather than guessed at: only the call is ours.
 */
function rewriteCall(file, chosen, tokens) {
  const source = readFileSync(file, "utf8");
  const start = source.indexOf("configure(");
  if (start === -1) return false;
  // The line's own indent, not the column of the call — `...configure(` sits past its own.
  const [indent] = source.slice(source.lastIndexOf("\n", start) + 1, start).match(/^\s*/);
  let depth = 0;
  for (let index = source.indexOf("(", start); index < source.length; index += 1) {
    if (source[index] === "(") depth += 1;
    else if (source[index] === ")") depth -= 1;
    if (depth > 0) continue;
    const rewritten =
      source.slice(0, start) + renderCall(chosen, tokens, indent) + source.slice(index + 1);
    if (dryRun) {
      steps.push(`would rewrite the configure() call in ${file}`);
      return true;
    }
    writeFileSync(file, rewritten);
    // A brace scan cannot know a paren inside a string from one closing the call, so the
    // parse is the check, and the file it was read from is the way back.
    if (spawnSync(process.execPath, ["--check", file]).status !== 0) {
      writeFileSync(file, source);
      return false;
    }
    steps.push(`rewrote the configure() call in ${file}`);
    return true;
  }
  return false;
}

/**
 * The gate's half of the answers, and the hook's one opt-out. The answers are authoritative —
 * every run asks for all of them — so `hook` and `allRules` are set from this run rather than
 * merged, while anything else the project tuned in here is left as it is.
 */
function settingsFile(tokens, hook, allRules) {
  const existing = existsSync(SETTINGS) ? JSON.parse(readFileSync(SETTINGS, "utf8")) : {};
  const settings = { ...existing };
  if (hook) delete settings.hook;
  else settings.hook = false;
  if (allRules) settings.allRules = true;
  else delete settings.allRules;
  if (tokens !== undefined) {
    settings.tokenFile = tokens;
    for (const section of ["stylesheets", "sizes", "typeRamp", "contrast"]) {
      settings[section] ??= {};
    }
  }
  return settings;
}

function addLintScript() {
  const manifest = JSON.parse(readFileSync("package.json", "utf8"));
  const scripts = manifest.scripts ?? {};
  if (Object.values(scripts).some((script) => script.includes("code-quality-gate"))) {
    steps.push("package.json already runs the gate");
    return;
  }
  manifest.scripts = { ...scripts, "lint:code-quality": "code-quality-gate" };
  write("package.json", `${JSON.stringify(manifest, null, 2)}\n`);
}

if (!existsSync("package.json")) fail("no package.json here");
const chosen = severities();
const tokens = flag("tokens");
if (tokens !== undefined && !existsSync(tokens)) fail(`--tokens=${tokens} does not exist`);
const hook = (flag("hook") ?? "on") === "on";

const manager = packageManager();
const missing = dependencies(manager);
if (missing.length > 0) run([...manager.add, ...missing]);

const existingConfig = CONFIGS.find((file) => existsSync(file));
if (existingConfig === undefined) write("eslint.config.mjs", configFile(chosen, tokens));
else if (!rewriteCall(existingConfig, chosen, tokens)) {
  steps.push(`${existingConfig} holds no configure() call — merge these answers into it by hand:`);
  for (const line of `...${renderCall(chosen, tokens, "")},`.split("\n")) steps.push(`    ${line}`);
}

// A project with nothing to settle needs no file, but one that had keys and no longer does needs
// them gone: an answer of "on" cannot leave last run's opt-out behind.
const settings = settingsFile(tokens, hook, args.includes("--all-rules"));
if (existsSync(SETTINGS) || Object.keys(settings).length > 0) {
  write(SETTINGS, `${JSON.stringify(settings, null, 2)}\n`);
}
addLintScript();

process.stdout.write(`${steps.map((step) => `  ${step}`).join("\n")}\n`);
if (dryRun) process.exit(0);

// A config that reaches nothing also exits 0, so the sweep's own counts are the report.
const gate = spawnSync(process.execPath, [path.join(packageRoot, "bin", "code-quality-gate.mjs")], {
  encoding: "utf8",
});
process.stdout.write(gate.stdout);
process.stderr.write(gate.stderr);
process.exitCode = gate.status === 0 ? 0 : 1;
