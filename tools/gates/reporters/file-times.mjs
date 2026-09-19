/* What each test file cost: node's seconds on the file's own completion event (process start through its `after` hooks),
   longest first, to the path in GATE_FILE_TIMES, so a review reads the suite's growth off it and not off one tail (ISS-736). */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

const isFile = (data) => data.nesting === 0 && typeof data.file === "string" && resolve(data.name) === data.file;

const line = ([file, ms]) => `${(ms / 1000).toFixed(1)}s ${relative(process.cwd(), file)}`;

export default async function* fileTimes(source) {
  const costs = new Map();
  for await (const { type, data } of source) {
    if (type !== "test:complete" || !isFile(data)) continue;
    costs.set(data.file, Math.max(costs.get(data.file) ?? 0, data.details?.duration_ms ?? 0));
  }
  const at = process.env.GATE_FILE_TIMES;
  if (!at || costs.size === 0) return;
  try {
    mkdirSync(dirname(at), { recursive: true });
    writeFileSync(at, `${[...costs].sort((one, other) => other[1] - one[1]).map(line).join("\n")}\n`);
  } catch (error) {
    yield `# the per-file seconds could not be recorded at ${at}: ${error.message}\n`;
  }
}
