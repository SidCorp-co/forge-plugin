/* A `$(…)` or a backtick pair a double quote opened is a shell's body, and the quoting walk says so per
   character: every reader that asks whether a character is shell or text gets one answer, and each keeps
   its own default over it (ISS-1533). */
import assert from "node:assert/strict";
import test from "node:test";

import { quoting, spans } from "../../../src/hooks/shell-spans.mjs";

const unders = (text) => quoting(text).map((one) => one.under).join("");
const markOf = (text, at) => quoting(text).find((one) => one.at === at);

test("a substitution a double quote opened is marked with the quoting its body has", () => {
  const plain = '"$(a; b)"';
  assert.equal(markOf(plain, plain.indexOf(";")).under, " ", "its separator is the body's, bare");
  assert.equal(markOf(plain, plain.indexOf(";")).depth, 1, "one substitution deep");
  const quoted = '"$(echo "a;b")"';
  assert.equal(markOf(quoted, quoted.indexOf(";")).under, '"', "a quote inside it opens its own context");
  assert.equal(unders(quoted), '"" ' + "    " + ' """""' + ' "', "its brackets bare, the quotes around them the outer one's");
  assert.equal(markOf(quoted, 1).depth, 0, "the `$` before the bracket stands outside it");
  const ticked = '"`a; b`"';
  assert.equal(markOf(ticked, ticked.indexOf(";")).under, " ", "and a backtick pair the same");
});

test("a bracket or a quote inside such a substitution closes nothing outside it", () => {
  for (const text of [`x "$(echo "(" ')')" ; y`, "x \"$(echo `printf )`)\" ; y"]) {
    assert.equal(markOf(text, text.length - 1).under, " ", `the word after it is bare: ${text}`);
    assert.equal(markOf(text, text.length - 1).depth, 0, text);
    assert.equal(spans(text).length, 2, `and the separator after it cuts: ${text}`);
  }
  const nested = "x \"$(echo `printf )`)\" ; y";
  assert.equal(markOf(nested, nested.indexOf(")")).depth, 2, "a `)` in a backtick pair inside one stands a frame deeper");
});

/* A bare one is placed as surely as a quoted one, so no reader counts brackets to find where it ends (ISS-3087). */
test("a bare substitution gives its body a depth, and its brackets stand inside it", () => {
  const dollar = "a $(b $(c) d) e";
  assert.deepEqual(quoting(dollar).map((one) => one.depth).join(""), "000111122211100", "one deeper per substitution around it");
  assert.equal(markOf(dollar, 4).within, "bare", "and it is a bare one");
  assert.equal(markOf(dollar, 0).within, "", "nothing at depth zero");
  const ticks = "a `b` `c``d` e";
  assert.deepEqual(quoting(ticks).map((one) => one.depth).join(""), "00111011111100", "a backtick pair the same, one closing beside the next");
  const both = 'a $(b "$(c)") d';
  assert.equal(markOf(both, both.indexOf("c")).depth, 2, "a quoted one inside a bare one");
  assert.equal(markOf(both, both.indexOf("c")).within, "quoted", "and the innermost names it");
  const nested = '"$(a $(b))"';
  assert.equal(markOf(nested, nested.indexOf("b")).depth, 2, "a bare `$(` inside a quoted one is a frame of its own");
  assert.equal(spans("x $(a; b) y").length, 2, "and a bare one is still cut where it was");
  for (const continued of ["a $\\\n(b) c", '"$\\\n(b)"']) {
    assert.equal(markOf(continued, continued.indexOf("b")).depth, 1, `a continuation between the \`$\` and its bracket opens it all the same: ${continued}`);
  }
});

/* The flat reading these texts had at 39d9b53, written out: the double quote holds the substitution and
   its here-document whole, so a body's apostrophe opens nothing (ISS-1533). */
test("a double-quoted substitution holding a here-document is read flat, as the quote around it", () => {
  const commit = "git commit -m \"$(cat <<'EOF'\nIt's done.\nEOF\n)\" && git push";
  const open = commit.indexOf('"');
  const shut = commit.lastIndexOf('"');
  assert.equal(unders(commit), `${" ".repeat(open)}${'"'.repeat(shut - open + 1)}${" ".repeat(commit.length - shut - 1)}`);
  assert.ok(quoting(commit).every((one) => one.within !== "quoted"), "and nothing in it stands in a frame");
  const body = markOf(commit, commit.indexOf("done"));
  assert.deepEqual([body.under, body.depth, body.within], ['"', 1, "flat"], "its body one substitution deep, marked as the quote around it");
  assert.equal(markOf(commit, shut).depth, 0, "and the quote closing it outside that substitution");
  assert.deepEqual(spans(commit).map(({ start, end }) => commit.slice(start, end).trim()),
    [commit.slice(0, shut + 1), "git push"], "so the command after it is cut where it was");
  const quoted = "echo \"$(cat <<'X'\na 'b' c\nX\n)\"; ls";
  assert.equal(unders(quoted), `     ${'"'.repeat(quoted.indexOf(";") - 5)}    `, "a body holding a quoted word as well");
});
