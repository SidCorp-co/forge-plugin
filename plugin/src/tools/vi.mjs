/* The tracker is Vietnamese and `vi-natural` writes all of it; a source given here is English.
   `review` cannot be the gate — it has no fixed point. docs/cli/vietnamese.md. */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { fail, translateTo } from "../resolve/settings.mjs";
import { protectMachine } from "../flow/machine.mjs";

export const BUNDLED = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "bin", "vi-natural");
/* Every prose field an agent can write, and a release note is an object whose other two halves are
   an enum and the payload, so what is named is the half rather than the field. docs/cli/vietnamese.md. */
const PROSE_FIELDS = ["title", "description", "body", "plan", "acceptanceCriteria", "releaseNotes.userFacing"];
const REGISTER = ["--register", "san-pham", "--no-glossary"];

const quoted = (word) => (/^[\w.,:/=@-]+$/u.test(word) ? word : `'${word.replaceAll("'", "'\\''")}'`);

/* Every refusal here ends with the command that writes the text: a run needs the verb producing the
   Vietnamese, not the login line `vi-natural` prints. `shown` carries the caller's own file names,
   the pair handed to `doc` being gone by the time the line is read. docs/cli/vietnamese.md. */
export const commandLine = (shown) => [BUNDLED, ...shown, ...REGISTER].map(quoted).join(" ");

const refuseWith = (shown, said) =>
  fail(`${said}\n\nThis is the command that writes it. Run it, then post what it leaves:\n  ${commandLine(shown)}`);

const viNatural = (argv, shown = argv) => {
  const run = spawnSync(BUNDLED, [...argv, ...REGISTER], { encoding: "utf8" });
  if (run.error || run.status !== 0) {
    refuseWith(
      shown,
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
    const shown = ["doc", "-o", "<vietnamese>.md", "<english>.md"];
    const run = viNatural(["doc", "-o", target, source], shown);
    const left = /(\d+) left in English/u.exec(run.stdout ?? "");
    if (left && left[1] !== "0") {
      refuseWith(shown, `vi-natural left ${left[1]} block(s) in English and refused them. Nothing was posted.`);
    }
    return readFileSync(target, "utf8");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

const translatedTitle = (text) => {
  const argv = ["translate", "--kind", "doc", text];
  const written = viNatural(argv).stdout.trim();
  if (!written) refuseWith(argv, "vi-natural returned an empty title. Nothing was posted.");
  return written;
};

const leafAt = (payload, path) => path.reduce((held, key) => held?.[key], payload);

/* Copied down the path, never written into: the boundary compares what came back against this copy. */
const withLeaf = (payload, [key, ...rest], value) =>
  ({ ...payload, [key]: rest.length ? withLeaf(payload[key], rest, value) : value });

export const translated = (payload) => {
  const language = translateTo();
  if (!payload || !language) return payload;
  if (language !== "vi") {
    fail(
      `The prose language is \`${language}\` and vi is the only one this CLI writes.\n` +
        "Nothing was posted. Set translate to vi or off in .forge.json.",
    );
  }
  let done = { ...payload };
  for (const field of PROSE_FIELDS) {
    const path = field.split(".");
    const held = leafAt(done, path);
    if (typeof held !== "string" || !held.trim()) continue;
    const source = protectMachine(path.at(-1), held);
    const written = path.at(-1) === "title" ? translatedTitle(source) : translatedBody(source);
    done = withLeaf(done, path, written);
    console.error(`--- ${field} as posted ---\n${written}\n`);
  }
  return done;
};
