/* Every command in a document is one a developer will run, and `writes.md` drifted three ways in a day
   while every gate stayed green. The CLI's own tables answer, so a flag renamed there fails here. */
import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { claimProblems, docClaims } from "../src/doc-shape.mjs";
import { VERB_NAMES, usageOf } from "../src/resolve/visibility.mjs";

const ROOT = new URL("../..", import.meta.url).pathname;
const HOW = join(ROOT, "plugin", "hooks", "how");

const sources = () => {
  const out = [];
  const walk = (dir) => {
    for (const one of readdirSync(dir, { withFileTypes: true })) {
      if (one.isDirectory()) {
        if (one.name !== "vendor") walk(join(dir, one.name));
      } else if (one.name.endsWith(".mjs")) {
        out.push(readFileSync(join(dir, one.name), "utf8"));
      }
    }
  };
  walk(join(ROOT, "plugin", "src"));
  walk(join(ROOT, "plugin", "hooks"));
  return out.join("\n");
};

const held = {
  verbs: VERB_NAMES,
  usageOf,
  documented: readdirSync(HOW).filter((one) => one.endsWith(".md")).map((one) => one.slice(0, -3)),
  sources: sources(),
};

const markdown = execFileSync("git", ["-C", ROOT, "ls-files", "*.md"], { encoding: "utf8" })
  .trim()
  .split("\n")
  .filter(Boolean);

test("every command a document tells a reader to run is one the CLI has", () => {
  let claims = 0;
  for (const rel of markdown) {
    const text = readFileSync(join(ROOT, rel), "utf8");
    const found = docClaims(text);
    claims += found.calls.length + found.flags.length + found.envs.length;
    assert.deepEqual(claimProblems(text, held), [], rel);
  }
  assert.ok(markdown.length > 20, `${markdown.length} markdown file(s) found`);
  assert.ok(claims > 40, `${claims} claims across ${markdown.length} documents: the pattern found nothing`);
});

test("a renamed flag, a dropped verb, a document that moved and a dead switch each fail", () => {
  const said = claimProblems(
    "Run `forge hooks --nope`, then `forge nonsense`, read `forge hooks --how ghost`, set FORGE_MADE_UP=1.",
    held,
  );
  assert.deepEqual(said, [
    "`forge nonsense` is no verb",
    "`forge hooks --nope` is in no usage line",
    "`--how ghost` names no document",
    "FORGE_MADE_UP is read by nothing",
  ]);
  /* A truncation is in the real flag by substring, and truncation is how a flag drifts. */
  assert.deepEqual(claimProblems("`forge hooks --den`", held), ["`forge hooks --den` is in no usage line"]);
});

test("a proposal may name the verb it opens with, and nothing else the CLI lacks", () => {
  const marker = "**Status: proposal for `forge advance`.** Nothing here is built.";
  const body = "Run `forge advance ISS-1`, then `forge tranistion`, then `forge hooks --nope`.";
  const rest = ["`forge tranistion` is no verb", "`forge hooks --nope` is in no usage line"];
  assert.deepEqual(claimProblems(`# A title\n\n${marker}\n\n${body}`, held), rest);
  assert.deepEqual(claimProblems(`${body}\n\n${marker}`, held), ["`forge advance` is no verb", ...rest]);
});

/* The flags of a verb that takes a sub-verb live with the sub-verb, so checking them here would fail
   on every true document. `forge codex consult --diff` is real and its usage line cannot say so. */
test("a sub-verb's own flags are not held against the verb's usage line", () => {
  assert.deepEqual(claimProblems("`forge codex consult --diff --only blocker`", held), []);
});
