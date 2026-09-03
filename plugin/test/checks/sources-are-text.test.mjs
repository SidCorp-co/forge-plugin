/* A NUL reached a hook's source and nothing noticed: the file ran, the suite passed, and `git diff`
   reported "Bin" while `grep` matched nothing in it. A character no one can see is not a character
   anyone chose, so the tree is checked for the ones a text file has no use for. */
import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");

/* Tab, newline and carriage return are the ones a source file uses; everything below space is not. */
const HIDDEN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u;
const TEXT = /\.(?:mjs|js|ts|tsx|json|md|py|sh|yml|yaml|toml|css|html)$/u;

const tracked = () =>
  execFileSync("git", ["-C", ROOT, "ls-files", "-z"], { encoding: "utf8", maxBuffer: 8e6 })
    .split("\0")
    .filter((one) => one && TEXT.test(one));

test("no tracked source carries a character a reader cannot see", () => {
  const files = tracked();
  assert.ok(files.length > 100, `${files.length} text files tracked; the selector matches too little`);
  const found = [];
  for (const rel of files) {
    const text = readFileSync(join(ROOT, rel), "utf8");
    const hit = HIDDEN.exec(text);
    if (!hit) continue;
    const at = text.slice(0, hit.index).split("\n").length;
    found.push(`${rel}:${at} holds U+${hit[0].codePointAt(0).toString(16).padStart(4, "0")}`);
  }
  assert.deepEqual(found, [], `a hidden character survives review because nothing prints it:\n${found.join("\n")}`);
});
