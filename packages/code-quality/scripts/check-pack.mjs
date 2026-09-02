import { execFileSync } from "node:child_process";
import { URL } from "node:url";

// The skills under claude-plugin/skills are COPIES of plugin/skills, and a copy
// that drifted is the exact thing that shipped 0.6.0 while the source sat at
// 0.7.0. Refuse to pack until the copy matches.
execFileSync("node", [new URL("../../../tools/sync-skills.mjs", import.meta.url).pathname, "--check"], {
  stdio: "inherit",
});

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
  "claude-plugin/skills/setup-code-quality/references/discovery.md",
  "claude-plugin/skills/setup-code-quality/references/edge-cases.md",
  "claude-plugin/skills/audit-code-quality/SKILL.md",
  "claude-plugin/skills/audit-code-quality/references/directives.md",
  "claude-plugin/skills/audit-code-quality/references/resolving-the-binary.md",
];
const missing = required.filter((file) => !files.has(file));
if (missing.length > 0) throw new Error(`Package is missing: ${missing.join(", ")}`);
for (const file of files) {
  if (file.startsWith("test/") || file.startsWith("scripts/")) {
    throw new Error(`Development-only file included: ${file}`);
  }
}
console.log(`Pack check passed: ${pack.name}@${pack.version}, ${pack.files.length} files, ${pack.size} bytes.`);
