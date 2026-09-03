/* One home for where a payload comes from: a terminal sends no EOF. docs/FORGE-CLI.md. */
import { readFileSync } from "node:fs";

import { fail } from "./settings.mjs";

const NAMED = "Write it to a file and name it, or pipe it in.";

const stdinText = () => {
  if (process.stdin.isTTY) fail(`\`-\` reads the payload from stdin, and stdin is a terminal. ${NAMED}`);
  const text = readFileSync(0, "utf8");
  if (!text.trim()) fail(`\`-\` read nothing from stdin. ${NAMED}`);
  return text;
};

export const bodyFrom = (path) =>
  (path === "-" ? stdinText() : readFileSync(path.startsWith("@") ? path.slice(1) : path, "utf8"));
