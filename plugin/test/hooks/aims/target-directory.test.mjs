/* A copy or a move into a `-t` directory lands on a name the command never spells: the directory
   joined with each source's own last name. Read as the sources alone, a new `.md` in a guarded skill
   directory went through the learning gate unasked (ISS-2684). */
import assert from "node:assert/strict";
import test from "node:test";

import { writtenPaths } from "../../../hooks/_hook.mjs";

const CWD = "/w";
const landed = (command, unplaceable = "keep") =>
  writtenPaths(command, CWD, "md", { unplaceable }).map((one) => one.token);

test("each source of a copy into a target directory lands in it under its own name", () => {
  for (const spelling of ["-t /a/x", "-t/a/x", "-vt /a/x", "-vt/a/x", "--target-directory /a/x", "--target-directory=/a/x"]) {
    assert.deepEqual(landed(`cp ${spelling} /tmp/new.md`), ["/a/x/new.md"], spelling);
  }
  assert.deepEqual(landed("cp -t /a/x /tmp/one.md /tmp/two.md"), ["/a/x/one.md", "/a/x/two.md"], "every source, not the last");
  assert.deepEqual(landed("install -m 644 -t /a/x /tmp/new.md"), ["/a/x/new.md"], "`install`'s own flags take their values");
  assert.deepEqual(landed("install -v /tmp/new.md -t /a/x"), ["/a/x/new.md"], "and the one taking none leaves its word a source");
  assert.deepEqual(landed("cp -S .md -t /a/x /tmp/n.md"), ["/a/x/n.md"], "a suffix's value is no source");
  assert.ok(landed("cd /tmp && cp -t /a/x b.md").includes("/a/x/b.md"), "a command after an operator is read too");
});

test("a copy into a target directory writes none of its sources, and a move writes each", () => {
  assert.deepEqual(landed("cp -t /tmp /a/x/SKILL.md"), ["/tmp/SKILL.md"]);
  assert.deepEqual(landed("mv -t /a/x /tmp/new.md"), ["/tmp/new.md", "/a/x/new.md"]);
});

test("a relative target directory is placed where the command stands", () => {
  assert.deepEqual(writtenPaths("cd sub && cp -t skills/x /tmp/new.md", CWD, "md", { unplaceable: "keep" })
    .find((one) => one.token === "skills/x/new.md")?.trees, ["/w/sub"]);
});

test("no name is composed where no target directory is given, or where the caller must not invent one", () => {
  assert.deepEqual(landed("cp -St /a/x /tmp/n.md"), ["/tmp/n.md"], "a `t` that is `-S`'s value names no directory");
  assert.deepEqual(landed("cp -- -t /a/x.md"), ["/a/x.md"], "past `--` a `-t` is a file");
  assert.deepEqual(landed("rsync -t a.md /a/x/"), ["a.md"], "`rsync`'s `-t` keeps times");
  assert.deepEqual(landed("cp -t /a/x /tmp/new.txt"), [], "a name without the extension asked for");
  assert.deepEqual(landed("cp -t /a/x /tmp/new.md", "strike"), [], "and the strict reading takes none");
  assert.ok(!landed("printf '%s' a.md | xargs cp -t /a/x").includes("/a/x/a.md"), "a source handed over is not composed");
});
