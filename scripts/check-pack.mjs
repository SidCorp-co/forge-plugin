import { execFileSync } from "node:child_process";
import { URL } from "node:url";

const output = execFileSync("npm", ["pack", "--dry-run", "--json"], {
  cwd: new URL("..", import.meta.url),
  encoding: "utf8",
});
const [pack] = JSON.parse(output);
const files = new Set(pack.files.map(({ path }) => path));
const required = [
  "package.json",
  "README.md",
  "LICENSE",
  "CHANGELOG.md",
  "src/index.js",
  "bin/code-quality-gate.mjs",
  "bin/code-quality-setup.mjs",
  "src/line-metrics.js",
  "src/folder-size.js",
  "src/no-historical-narration.js",
  "src/comment-density.js",
  "src/max-consecutive-comment-lines.js",
  "src/design/tokens.js",
  "src/design/no-raw-colors.js",
  "src/design/no-arbitrary-sizes.js",
  "src/design/contrast.js",
  ".claude-plugin/marketplace.json",
  "claude-plugin/.claude-plugin/plugin.json",
  "claude-plugin/hooks/hooks.json",
  "claude-plugin/scripts/lint-edited-file.mjs",
  "claude-plugin/skills/setup-code-quality/SKILL.md",
  "claude-plugin/skills/audit-code-quality/SKILL.md",
];
const missing = required.filter((file) => !files.has(file));
if (missing.length > 0) throw new Error(`Package is missing: ${missing.join(", ")}`);
for (const file of files) {
  if (file.startsWith("test/") || file.startsWith("scripts/")) {
    throw new Error(`Development-only file included: ${file}`);
  }
}
console.log(`Pack check passed: ${pack.name}@${pack.version}, ${pack.files.length} files, ${pack.size} bytes.`);
