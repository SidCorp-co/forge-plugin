/* The quoted spans of a command, as the walk reads them, handed to a reader the way `replace` hands a
   match: every reader that blanked or judged a quoted span through a pattern of its own reads them
   here, so a quote the walk says is no quote opens no span for any of them (ISS-999). */
import assert from "node:assert/strict";
import test from "node:test";

import { respelled } from "../../../src/hooks/shell-spans.mjs";

const handed = (text) => {
  const seen = [];
  const out = respelled(text, (span, { flat }) => {
    seen.push(flat ? `${span} (flat)` : span);
    return `[${span.length}]`;
  });
  return { seen, out };
};

test("each quoted span is handed over once, in order, and replaced where it stood", () => {
  assert.deepEqual(handed(`'a''b' "c"`), { seen: ["'a'", "'b'", '"c"'], out: "[3][3] [3]" },
    "two spans side by side are two spans");
  assert.deepEqual(handed("x 'unclosed"), { seen: ["'unclosed"], out: "x [9]" }, "an unclosed one runs to the end");
  assert.deepEqual(handed(`echo "$(printf 'x')" y`), { seen: [`"$(printf 'x')"`], out: "echo [15] y" },
    "a substitution a double quote opened is inside the span around it, its own quotes with it");
  assert.deepEqual(handed('"a\\\nb"'), { seen: ['"a\\\nb"'], out: "[6]" },
    "and a line continuation inside one is handed over as the text holds it");
});

test("a quote the walk reads as no quote opens no span", () => {
  assert.deepEqual(handed("echo it\\'s 'x'").seen, ["'x'"], "an apostrophe a backslash made literal");
  assert.deepEqual(handed("ls # it's\necho 'x'").seen, ["'x'"], "nor one in a comment");
  assert.deepEqual(handed(`echo "$(cat <<'E'\nit's\nE\n)"`).seen.map((one) => one.endsWith("(flat)")), [true],
    "and a substitution read flat for its here-document is said to be");
});
