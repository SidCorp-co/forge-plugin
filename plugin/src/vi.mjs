/* The tracker is Vietnamese and `vi-natural` writes all of it; a source given here is English.
   `review` cannot be the gate — it has no fixed point. docs/FORGE-CLI.md. */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { fail, translateTo } from "./resolve/settings.mjs";

export const BUNDLED = join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "vi-natural");
/* Every prose field an agent can write, not only the three the wrapped verbs started with. */
const PROSE_FIELDS = ["title", "description", "body", "plan", "acceptanceCriteria"];

const viNatural = (argv, stdin) => {
  const run = spawnSync(BUNDLED, [...argv, "--register", "san-pham", "--no-glossary"], {
    encoding: "utf8",
    input: stdin,
  });
  if (run.error || run.status !== 0) {
    fail(
      "vi-natural could not write the Vietnamese, so nothing was posted:\n" +
        (run.error?.message ?? (run.stderr || run.stdout || "").trim().slice(0, 600)),
    );
  }
  return run;
};

/* `doc` keeps fences, spans and link targets, so a body may carry shas and paths safely. */
const translatedBody = (text) => {
  const directory = mkdtempSync(join(tmpdir(), "forge-vi-"));
  try {
    const source = join(directory, "body.md");
    const target = join(directory, "body.vi.md");
    writeFileSync(source, text);
    const run = viNatural(["doc", "-o", target, source]);
    const left = /(\d+) left in English/u.exec(run.stdout ?? "");
    if (left && left[1] !== "0") {
      fail(`vi-natural left ${left[1]} block(s) in English and refused them. Nothing was posted.`);
    }
    return readFileSync(target, "utf8");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

const translatedTitle = (text) => {
  const written = viNatural(["translate", "--kind", "doc", text]).stdout.trim();
  if (!written) fail("vi-natural returned an empty title. Nothing was posted.");
  return written;
};

export const translated = (payload) => {
  const language = translateTo();
  if (!payload || !language) return payload;
  if (language !== "vi") {
    fail(
      `The prose language is \`${language}\` and vi is the only one this CLI writes.\n` +
        "Nothing was posted. Set translate to vi or off in .forge.json.",
    );
  }
  const done = { ...payload };
  for (const field of PROSE_FIELDS) {
    if (typeof done[field] !== "string" || !done[field].trim()) continue;
    done[field] = field === "title" ? translatedTitle(done[field]) : translatedBody(done[field]);
    console.error(`--- ${field} as posted ---\n${done[field]}\n`);
  }
  return done;
};
