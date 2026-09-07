/* A refusal is only worth a round if the command it names exists. `forge claim <ref> --pushed` was
   in a refusal for two releases while claim's own usage line named neither that flag nor the two
   beside it, and nothing failed (ISS-65). The CLI's own tables answer, so a renamed flag fails here. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { routeProblems } from "../../src/checks/doc-shape.mjs";
import { VERB_NAMES, usageOf } from "../../src/resolve/visibility.mjs";
import { surfaceOf } from "../surfaces.mjs";

const ROOT = new URL("../../..", import.meta.url).pathname;
const HOW = join(ROOT, "plugin", "hooks", "how");

const held = {
  verbs: VERB_NAMES,
  usageOf: surfaceOf,
  documented: readdirSync(HOW).filter((one) => one.endsWith(".md")).map((one) => one.slice(0, -3)),
  sources: "",
};

const sources = () => {
  const out = [];
  const walk = (dir) => {
    for (const one of readdirSync(dir, { withFileTypes: true })) {
      if (one.isDirectory()) {
        if (one.name !== "vendor") walk(join(dir, one.name));
      } else if (one.name.endsWith(".mjs")) {
        out.push({ rel: join(dir, one.name).slice(ROOT.length), text: readFileSync(join(dir, one.name), "utf8") });
      }
    }
  };
  for (const tree of TREES) walk(join(ROOT, ...tree.split("/")));
  return out;
};

/* Tools print `forge` commands a reader types and sat outside this walk, so a route refused from the
   day it was written passed a green gate (ISS-118). The proof names a file per tree, not this list,
   which would fall silent with the tree it names. */
const TREES = ["plugin/src", "plugin/hooks", "tools"];

test("every `forge` form the source prints names a verb the CLI has and flags its usage carries", () => {
  const files = sources();
  for (const { rel, text } of files) assert.deepEqual(routeProblems(text, held), [], rel);
  for (const rel of ["plugin/src/cli.mjs", "plugin/hooks/gate.mjs", "tools/run.mjs"]) {
    assert.ok(files.some((one) => one.rel === rel), `${rel} is in no walk, so its routes are read by nothing`);
  }
  const counted = files.reduce((sum, { text }) => sum + (text.match(/forge [a-z]+/gu) ?? []).length, 0);
  assert.ok(files.length > 30, `${files.length} source file(s) walked`);
  assert.ok(counted > 60, `${counted} forms across ${files.length} files: the pattern found nothing`);
});

/* The case the checker exists for, in the shapes a refusal actually takes: a template value in the
   middle of the form, a flag renamed under a verb whose row delegates, and a verb since dropped. */
test("a flag no verb takes, a verb the CLI lacks and a dead document each fail", () => {
  const said = routeProblems([
    "fail(`take it again:\\n  forge claim ${ref} --pushed --nope`);",
    "fail(\"write it first:\\n  forge record verdict ISS-1 --criterion 2 --nonsense x\");",
    "fail(\"forge nonsense ISS-1, then forge hooks --how ghost\");",
  ].join("\n"), held);
  assert.deepEqual(said, [
    "`forge nonsense` is no verb",
    "`forge claim --nope` is in no usage line",
    "`forge record verdict --nonsense` is in no usage line",
    "`--how ghost` names no document",
  ]);
});

/* The scan stopped at the first quote, so a flag after a quoted value went unread (F4). */
test("a flag after a quoted value is read too", () => {
  const said = routeProblems('fail(`forge record confirmation ${ref} --where "a b c" --nope x`);', held);
  assert.deepEqual(said, ["`forge record confirmation --nope` is in no usage line"]);
  assert.deepEqual(routeProblems('fail(`forge record confirmation ${ref} --where "a b c" --finding f`);', held), []);
  assert.deepEqual(routeProblems('fail(`forge record note ${ref} --user "say --nonsense here"`);', held), [],
    "and a flag-like run inside a quoted value is data, not a route");
  const escaped = 'fail("forge record note ISS-1 --user \\"a b\\" --nope x");';
  assert.deepEqual(routeProblems(escaped, held), ["`forge record note --nope` is in no usage line"],
    "a double-quoted source string escapes its own quotes, and the flag after one is still read");
  assert.deepEqual(routeProblems('fail("forge record note ISS-1 --user \\"say --nonsense here\\"");', held), []);
});

/* Help is per kind and per action, so the word after the verb picks the surface: the same flag is
   a route under one and a finding under another, which is what "its usage" now means (ISS-700). */
test("a flag is held to the sub-verb's surface and not the verb's", () => {
  assert.deepEqual(routeProblems("forge record verdict ISS-1 --criterion 2", held), []);
  assert.deepEqual(routeProblems("forge record confirmation ISS-1 --criterion 2", held),
    ["`forge record confirmation --criterion` is in no usage line"],
    "`--criterion` is verdict's field, and the union of every kind would have passed this");
  assert.deepEqual(routeProblems("forge codex consult --send bodies", held), []);
  assert.deepEqual(routeProblems("forge codex show --send bodies", held),
    ["`forge codex show --send` is in no usage line"]);
});

/* One command written over two lines of one expression: the flags past the `+` were read by nothing,
   which is indistinguishable from a form that has none. The forms in earned.mjs are that shape. */
test("a form continued onto a second template line carries its flags", () => {
  const form = (tail) => [
    "  `forge record verdict ${ref} --criterion ${number} --verdict pass --commit ${commit} `",
    `    + \`${tail}\`,`,
  ].join("\n");
  assert.deepEqual(routeProblems(form("--evidence <attachment|url|sha>"), held), []);
  assert.deepEqual(routeProblems(form("--nonsense x"), held),
    ["`forge record verdict --nonsense` is in no usage line"],
    "and the continuation is judged rather than skipped, which is the whole of the case");
});

/* The flags the worklog added to `claim` were in a refusal's own text and in neither table for two
   releases. This is the case that fails on the tree as it stood before this issue. */
test("the three worklog flags are on claim's own line, which is what the tree lacked", () => {
  for (const flag of ["--pushed", "--review", "--open"]) {
    assert.deepEqual(routeProblems(`forge claim ISS-65 ${flag}`, held), [], flag);
    assert.match(usageOf("claim"), new RegExp(`${flag}(?![\\w-])`, "u"), `${flag} on the row forge -h prints`);
  }
  const older = { ...held, usageOf: () => "Usage: forge claim <uuid|ISS-45> [--minutes n] [--next line]" };
  assert.deepEqual(routeProblems("forge claim ISS-65 --pushed", older),
    ["`forge claim --pushed` is in no usage line"],
    "which is the row as it stood before this issue, and the finding this checker was written for");
});

/* The printed route answered `[]` and the CLI refused it: the value past the flag went unread (ISS-118). */
test("a value the flag does not take fails, and the printed route is that case", () => {
  const printed = "console.log(`  the baseline:  forge record baseline ISS-1 --scope partial`);";
  assert.deepEqual(routeProblems(printed, held),
    ["`forge record baseline --scope partial` is no value it takes: whole or part"]);
  assert.deepEqual(routeProblems(printed.replace("partial", "whole"), held), [],
    "and the value the usage does spell passes");
  assert.deepEqual(routeProblems("forge record verdict ISS-1 --verdict maybe", held),
    ["`forge record verdict --verdict maybe` is no value it takes: pass or fail or skipped"],
    "and a set the usage spells as alternatives is read the same way");
});

/* A set whose alternatives are one letter long reads as a placeholder here, so `forge new
   --complexity` has its values judged by the verb and by nothing in a printed route (ISS-700). */
test("a one-letter alternative is not read as a spelled value, so those values go unjudged", () => {
  assert.deepEqual(routeProblems("console.log(`forge new - --complexity feature`);", held), [],
    "the row spells xs|s|m|l|xl and this checker reads none of them");
  assert.deepEqual(routeProblems("forge next --count 3", held), [],
    "which is the same reading that keeps `--count n` a placeholder rather than the value `n`");
});

test("a value against a placeholder is not judged, and the surfaces spell their placeholders", () => {
  assert.deepEqual(routeProblems("forge claim ISS-118 --next start-here", held), []);
  assert.deepEqual(routeProblems("forge stats runs --checkout /tmp/x --since 3d", held), []);
  const padded = { ...held,
    usageOf: () => "Usage: forge record <kind> <uuid|ISS-45>\n  --pushed        the branch and its head, read from git" };
  assert.deepEqual(routeProblems("forge record note ISS-1 --pushed now", padded), [],
    "a flag padded out to its column is a detail line, and the prose after it is not a value it takes");
  const bare = { ...held, usageOf: () => "Usage: forge claim <uuid|ISS-45> [--next line]" };
  assert.deepEqual(routeProblems("forge claim ISS-118 --next start-here", bare),
    ["`forge claim --next start-here` is no value it takes: line"],
    "which is what an unbracketed placeholder costs, and why the surfaces bracket theirs");
});
