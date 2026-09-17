import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/* The defect this issue is: the gate covered three verbs and not the five that write the record
   now. A funnel closes today's list, and this closes the next one — every tracker write in the
   source is either behind the check or named here with the reason it is not. */
const CHECKED = /\brenew\(|\bmustBeShown\(|\bnotAnothers\(/u;
const WINDOW = 12;
/* Keyed by path and action, so an unchecked write added to an exempted file is not exempt with it. */
const EXEMPT = {
  "tracker/filing/route.mjs:forge_issues:create": "the one create every filing route calls creates the issue, and an issue being created has no comments to have read — docs/cli/filing.md says why the routes hold no create of their own",
  "tracker/comments.mjs:forge_comments:create": "the create this module owns is the one the check has cleared, and the credit is taken on its answer",
};

/* Not line by line and not by the word alone: a call split over lines, one whose answer is returned
   rather than awaited, and one spaced from its parenthesis are the same write — while a comment
   naming the word is none. Comments go first, and quote-aware, or a `//` inside a string would
   blank the rest of a real line; every newline is kept, so a line number still counts. */
const bare = (text) => {
  let out = "";
  let quote = "";
  let inside = "";
  for (let at = 0; at < text.length; at += 1) {
    const one = text[at];
    const pair = text.slice(at, at + 2);
    const blank = one === "\n" ? one : " ";
    if (inside === "line") {
      inside = one === "\n" ? "" : inside;
      out += blank;
    } else if (inside === "block") {
      inside = pair === "*/" ? "" : inside;
      out += pair === "*/" ? "  " : blank;
      at += pair === "*/" ? 1 : 0;
    } else if (quote) {
      quote = one === quote ? "" : quote;
      out += one;
      at += one === "\\" ? 1 : 0;
      out += one === "\\" ? " " : "";
    } else if (pair === "//" || pair === "/*") {
      inside = pair === "//" ? "line" : "block";
      out += " ";
    } else {
      quote = ["\"", "'", "`"].includes(one) ? one : quote;
      out += one;
    }
  }
  return out;
};
const CALLS = /(?<![.\w])write\s*\(\s*(?:"(forge_\w+)")?/gu;
/* The specifier's last segment, not the word `rest` in it: every module inside `tracker/` reaches the
   transport as `./rest.mjs` or `../rest.mjs`, which is where the writes are, and a pattern spelling
   the directory misses all of them. The separator is the boundary, so `interest.mjs` is not it. */
const FROM_TRANSPORT = /import\s*(\*\s*as\s*\w+|\{[^}]*\})\s*from\s*"(?:[^"]*\/)?rest\.mjs"/u;

export const uncheckedIn = (name, source) => {
  const text = bare(source);
  const lines = text.split("\n");
  const found = [];
  for (const said of text.matchAll(CALLS)) {
    const at = text.slice(0, said.index).split("\n").length - 1;
    const near = lines.slice(at, at + 3).join(" ");
    const tool = said[1] ?? /"(forge_\w+)"/u.exec(near)?.[1] ?? "forge_issues";
    if (!["forge_issues", "forge_comments"].includes(tool)) continue;
    const before = lines.slice(Math.max(0, at - WINDOW), at + 1).join("\n");
    const action = /action:\s*"(\w+)"/u.exec(near)?.[1] ?? "";
    if (CHECKED.test(before) || EXEMPT[`${name}:${tool}:${action}`]) continue;
    found.push(`${name}:${at + 1} writes ${tool} with no read-before-write check above it`);
  }
  return found;
};

/* A name the scan cannot follow: `write` under another name, or the whole module behind one. */
export const renamesWrite = (text) => {
  const said = FROM_TRANSPORT.exec(text)?.[1];
  return Boolean(said) && (said.startsWith("*") || /\bwrite\s+as\s+/u.test(said));
};

test("the scan sees a write however it is spelled, and nothing that is not one", () => {
  const flagged = (text) => uncheckedIn("probe.mjs", text).length;
  assert.equal(flagged('await write("forge_issues", { action: "transition" });'), 1);
  assert.equal(flagged('return write(\n  "forge_issues",\n  { action: "update" },\n);'), 1, "split over lines");
  assert.equal(flagged('write ("forge_comments", { action: "create", data: { issue: x } });'), 1, "spaced");
  assert.equal(flagged("const answer = write(name, resolved);"), 1, "and one whose tool is a variable");
  assert.equal(flagged('await renew(id, ref);\nawait write("forge_issues", { action: "update" });'), 0);
  assert.equal(flagged('process.stdout.write("hello");\nchild.stdin.write(body);'), 0, "a method of that name");
  assert.equal(flagged('await write("forge_uploads", { action: "request" });'), 0, "and a tool that is no issue");
  assert.equal(flagged('/* write("forge_issues") is the transport */\n// await write("forge_comments", {});'), 0,
    "a comment naming the word is no call, on either form");
  assert.equal(flagged('const url = "http://host"; await write("forge_issues", { action: "update" });'), 1,
    "and a string holding comment syntax hides nothing after it");
  assert.equal(flagged("const held = `${await write(\"forge_issues\", args)}`;"), 1,
    "nor does a template literal: a string's content is carried through, only a comment is blanked");
});

test("an aliased or namespaced import of the transport is refused", () => {
  assert.equal(renamesWrite('import { write as post } from "../tracker/rest.mjs";'), true);
  assert.equal(renamesWrite('import * as sent from "../tracker/rest.mjs";'), true);
  assert.equal(renamesWrite('import { write as post } from "./rest.mjs";'), true,
    "the form every module inside tracker/ uses, which is where the writes are");
  assert.equal(renamesWrite('import * as sent from "../rest.mjs";'), true, "and the form filing/ uses");
  assert.equal(renamesWrite('import { scoped, write } from "../tracker/rest.mjs";'), false);
  assert.equal(renamesWrite('import { ROUTES } from "../tracker/routes.mjs";'), false,
    "and the table beside it writes nothing, so importing that is no write to rename");
  assert.equal(renamesWrite('import * as all from "./interest.mjs";'), false,
    "a name merely ending in those letters: the separator is what makes it the transport");
  assert.equal(renamesWrite('import { write as post } from "./other.mjs";'), false, "another module is not this one");
});

const sources = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    (entry.isDirectory() ? sources(join(dir, entry.name)) : [join(dir, entry.name)].filter((one) => one.endsWith(".mjs"))));

const SRC = new URL("../../src", import.meta.url).pathname;

test("every tracker write in the source is behind the check, or named as exempt", () => {
  const found = [];
  for (const path of sources(SRC)) {
    if (path.endsWith("/tracker/rest.mjs")) continue;
    const text = readFileSync(path, "utf8");
    assert.equal(renamesWrite(text), false, `${path} takes the transport under another name, which the scan reads`);
    found.push(...uncheckedIn(path.slice(SRC.length + 1), text));
  }
  assert.deepEqual(found, [], `${found.join("\n")}\nEvery write to an issue passes the comments check `
    + "first: renew() for a payload write, mustBeShown() for a raw call. Add one, or name the site "
    + "in EXEMPT here with the reason it needs none.");
});
