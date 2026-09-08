/* Every command in a document is one a developer will run, and `writes.md` drifted three ways in a day
   while every gate stayed green. The CLI's own tables answer, so a flag renamed there fails here. */
import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { RECORDS_RATHER_THAN_INSTRUCTS, claimProblems, docClaims } from "../../../src/checks/doc-shape.mjs";
import { VERB_NAMES } from "../../../src/resolve/visibility.mjs";
import { FORM_NAMES } from "../../../src/resolve/handler.mjs";
import { surfaceOf } from "../../surfaces.mjs";

const ROOT = new URL("../../../..", import.meta.url).pathname;
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

/* A handled form is a command the CLI has, so a document naming one is naming something a reader can
   type; what the forms may not appear in is any help text, which cli-help.test.mjs holds. */
const held = {
  verbs: [...VERB_NAMES, ...FORM_NAMES],
  usageOf: surfaceOf,
  documented: readdirSync(HOW).filter((one) => one.endsWith(".md")).map((one) => one.slice(0, -3)),
  sources: sources(),
};

const markdown = execFileSync("git", ["-C", ROOT, "ls-files", "*.md"], { encoding: "utf8" })
  .trim()
  .split("\n")
  .filter(Boolean);

test("every command a document tells a reader to run is one the CLI has", () => {
  let claims = 0;
  const read = markdown.filter((rel) => !RECORDS_RATHER_THAN_INSTRUCTS.test(rel));
  for (const rel of read) {
    const text = readFileSync(join(ROOT, rel), "utf8");
    const found = docClaims(text);
    claims += found.calls.length + found.flags.length + found.envs.length;
    assert.deepEqual(claimProblems(text, held), [], rel);
  }
  assert.ok(read.length > 20, `${read.length} markdown file(s) found`);
  assert.ok(claims > 40, `${claims} claims across ${read.length} documents: the pattern found nothing`);
});

/* The journal is the one exemption, and it is worth a case of its own: a run's dated record of a
   command that has since been retired is not the same claim as a topic still naming it. */
test("the journal of what runs typed is read as a record and not as an instruction", () => {
  const journal = markdown.filter((rel) => RECORDS_RATHER_THAN_INSTRUCTS.test(rel));
  assert.deepEqual(journal, ["docs/issue-flow-dry-runs.md"], "one path, and the walk still reaches it");
  assert.equal(RECORDS_RATHER_THAN_INSTRUCTS.test("docs/cli/claim.md"), false, "and no topic beside it");
  const said = claimProblems("The run typed `forge nonsense ISS-45` and it was refused.", held);
  assert.equal(said.length, 1, "the same line in a topic is a finding, which is what the filter removes");
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

/* The verb here is one the CLI does not have: `advance` was the fixture until ISS-3 shipped it,
   and a proposal for a verb that exists would prove nothing about the exemption. */
test("a proposal may name the verb it opens with, and nothing else the CLI lacks", () => {
  const marker = "**Status: proposal for `forge reopen`.** Nothing here is built.";
  const body = "Run `forge reopen ISS-1`, then `forge tranistion`, then `forge hooks --nope`.";
  const rest = ["`forge tranistion` is no verb", "`forge hooks --nope` is in no usage line"];
  assert.deepEqual(claimProblems(`# A title\n\n${marker}\n\n${body}`, held), rest);
  assert.deepEqual(claimProblems(`${body}\n\n${marker}`, held), ["`forge reopen` is no verb", ...rest]);
});

/* The flags of a verb that takes a sub-verb live with the sub-verb, and holding them to the verb's
   own row would have failed every true document — so they went unjudged, and a document naming a
   flag no action takes read as clean. The word after the verb says which surface answers (ISS-700). */
test("a sub-verb's flags are judged against the sub-verb's own usage", () => {
  assert.deepEqual(claimProblems("`forge codex consult --diff --only blocker`", held), []);
  assert.deepEqual(claimProblems("`forge codex consult --nonsense x`", held),
    ["`forge codex consult --nonsense` is in no usage line"]);
  assert.deepEqual(claimProblems("`forge record verdict ISS-1 --criterion 2 --verdict pass`", held), []);
  assert.deepEqual(claimProblems("`forge record confirmation ISS-1 --criterion 2`", held),
    ["`forge record confirmation --criterion` is in no usage line"],
    "and a kind is a surface too: `--criterion` is verdict's, and the kinds' union would pass this");
});
