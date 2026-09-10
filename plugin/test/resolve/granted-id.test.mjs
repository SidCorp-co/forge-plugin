/* ISS-672. The id a command grants, read off each command of the text rather than off the text: a
   run in a worktree writes the assignment behind the `cd` that reaches it, and every position below
   fell through to the hook event's uuid while the CLI credited the exported name. */
import assert from "node:assert/strict";
import test from "node:test";

import { quoting } from "../../src/hooks/shell-spans.mjs";
import { idGrantedBy } from "../../src/resolve/granted-id.mjs";

const WRITE = "./plugin/bin/forge comment ISS-29 -";

/* Each row of the issue's own table, and the four separators a text puts in front of one. */
test("the id is read wherever the assignment sits, in either form", () => {
  const reads = {
    "export FORGE_SESSION_ID=a-run && cd /tmp && ./plugin/bin/forge comment ISS-29 -": "the export leading",
    [`true && export FORGE_SESSION_ID=a-run && ${WRITE}`]: "a command in front of it",
    [`cd /tmp && export FORGE_SESSION_ID=a-run && ${WRITE}`]: "the cd a worktree run makes",
    [`cd /tmp; export FORGE_SESSION_ID=a-run; ${WRITE}`]: "the same, semicolons",
    [`export FORGE_SESSION_ID=a-run; printf hi | cat; ${WRITE}`]: "a pipeline this shell outlives",
    [`export FORGE_SESSION_ID=a-run && cd /tmp || exit 1\n${WRITE}`]: "an or after it, not in front",
    [`cd /tmp\nexport FORGE_SESSION_ID=a-run\n${WRITE}`]: "the same, one command a line",
    [`cd /tmp && FORGE_SESSION_ID=a-run ${WRITE}`]: "the prefix on the writer behind a cd",
    [`cd /tmp\nFORGE_SESSION_ID=a-run ${WRITE}`]: "the prefix on the writer, a line down",
    [`cd /tmp && FORGE_SESSION_ID="a-run" ${WRITE}`]: "a quoted value behind a cd",
    [`cd /tmp && FORGE_SESSION_ID='a-run' ${WRITE}`]: "an apostrophed value behind a cd",
    [`cd /tmp && env FORGE_SESSION_ID=a-run ${WRITE}`]: "an env prefix behind a cd",
    "cd /wt && FORGE_SESSION_ID=a-run /a/b/plugin/bin/forge issue ISS-29": "an absolute writer",
    [`cd /wt && FORGE_SESSION_ID=a-run ${WRITE} && echo done`]: "a command after the writer",
    [`echo hi | FORGE_SESSION_ID=a-run ${WRITE}`]: "the writer on the right of a pipe",
    "export FORGE_SESSION_ID=a-run && /opt/forge+tools/forge advance ISS-29": "a path this file cannot spell",
    [`export FORGE_SESSION_ID=a-run && forge comment ISS-29 - <<'EOF'\nbody\nEOF`]: "a body the writer takes",
    [`cd /tmp && export FORGE_SESSION_ID=a-run && forge issue ISS-29 && ${WRITE}`]: "two calls, both after it",
  };
  for (const [command, what] of Object.entries(reads)) {
    assert.equal(idGrantedBy(command), "a-run", what);
  }
});

/* A text handed as its lines is one text: `stop-check` reads a turn's commands as an array. */
test("an array of commands is the text they make", () => {
  assert.equal(idGrantedBy(["cd /tmp", "export FORGE_SESSION_ID=a-run", WRITE]), "a-run");
});

/* The other direction, and the reason the reading is per command rather than a looser anchor: an id
   the writer's process will never hold is the same defect wearing the other shoe. */
test("an id the writer would not receive is not granted", () => {
  const refuses = {
    [`${WRITE} && export FORGE_SESSION_ID=a-run`]: "the export sits after the writer",
    [`${WRITE}; export FORGE_SESSION_ID=a-run; true`]: "the same, with a command after it",
    [`(cd /wt && export FORGE_SESSION_ID=a-run) && ${WRITE}`]: "the export is the subshell's",
    [`(true; export FORGE_SESSION_ID=a-run; true); ${WRITE}`]: "the same, semicolons",
    [`(export FORGE_SESSION_ID=a-run; cd /wt) && ${WRITE}`]: "the subshell opens the text",
    "export FORGE_SESSION_ID=a-run": "nothing in the text writes",
    "export FORGE_SESSION_ID=a-run && node tools/run.mjs ship": "the writer is not this CLI",
    [`printf '%s\\n' 'a; export FORGE_SESSION_ID=a-run; b' && ${WRITE}`]: "the only id is quoted data",
    [`grep "export FORGE_SESSION_ID=other" f && export FORGE_SESSION_ID=a-run && ${WRITE}`]:
      "a second id, however it is spelled",
    [`cd /tmp && export FORGE_SESSION_ID=a-run && FORGE_SESSION_ID=other ${WRITE}`]: "two ids granted",
    [`cd /tmp && FORGE_SESSION_ID=a-run ${WRITE}; unset FORGE_SESSION_ID`]: "the id is taken back",
    [`cd /tmp && FORGE_SESSION_ID="$RUN_ID" ${WRITE}`]: "a value only the shell could resolve",
    [`cd /tmp && ${WRITE}`]: "no assignment at all",
    [`cd /tmp; echo $(true; export FORGE_SESSION_ID=a-run; true); ${WRITE}`]: "a substitution keeps its export",
    [`cd /tmp; echo <(true; export FORGE_SESSION_ID=a-run; true); ${WRITE}`]: "and so does a process one",
    [`cd /tmp; export FORGE_SESSION_ID=a-run | cat; ${WRITE}`]: "a pipeline stage is its own process",
    [`cd /tmp; export FORGE_SESSION_ID=a-run & ${WRITE}`]: "and so is a background job",
    [`cat <<'EOF' > b.md\nexport FORGE_SESSION_ID=a-run\nEOF\nforge comment ISS-29 b.md`]: "a data body is data",
    [`${WRITE}; export FORGE_SESSION_ID=a-run; echo forge`]: "the write is ahead of the export",
    [`cd /tmp; FORGE_SESSION_ID=a-run forge issue ISS-29; forge advance ISS-29`]: "one call of two is prefixed",
    [`true || export FORGE_SESSION_ID=a-run; ${WRITE}`]: "an or can jump the export and not the write",
    [`false || export FORGE_SESSION_ID=a-run && ${WRITE}`]: "the same shape, whatever the exit status is",
    [`false && export FORGE_SESSION_ID=a-run; ${WRITE}`]: "an and can drop the export and not the write",
    [`cd /tmp && export FORGE_SESSION_ID=a-run; ${WRITE}`]: "the write is not behind the export's condition",
  };
  for (const [command, what] of Object.entries(refuses)) {
    assert.equal(idGrantedBy(command), null, what);
  }
});

/* ISS-858. `spans` cut the command where it ends, so what it carries after the verb is that command's
   own: a redirection belongs to the process being granted, and a metacharacter inside a quoted value
   is prose the shell hands on. Both lost the grant to one character class, and this repository's own
   conventions put the second in nearly every record it writes. */
test("what a granted call carries after the verb is that call's own", () => {
  const advance = "forge advance ISS-29 --why";
  const reads = {
    [`FORGE_SESSION_ID=a-run ${WRITE} 2>&1`]: "the redirection an agent writes to see a refusal",
    [`FORGE_SESSION_ID=a-run ${WRITE} 2>&1 | tail -3`]: "the same, piped on",
    [`FORGE_SESSION_ID=a-run ${WRITE} > /tmp/out.log`]: "the output captured to a file",
    [`FORGE_SESSION_ID=a-run ${advance} "flags & payload both read it"`]: "an ampersand in a value",
    [`FORGE_SESSION_ID=a-run ${advance} "went from 8985 > 9000 chars"`]: "a greater-than in one",
    [`FORGE_SESSION_ID=a-run ${advance} "one update; one renewal"`]: "a semicolon in one",
    [`FORGE_SESSION_ID=a-run ${advance} "the parser (flags.mjs) refuses"`]: "parentheses in one",
    [`FORGE_SESSION_ID=a-run ${advance} "costs $5 a round"`]: "a dollar that opens nothing",
    [`FORGE_SESSION_ID=a-run ${advance} "held \${ROUNDS:-3} times"`]: "nor does an ordinary expansion",
    [`FORGE_SESSION_ID=a-run ${advance} "a | stage is read"`]: "a pipe in one",
    [`FORGE_SESSION_ID=a-run ${advance} 'flags & payload; a parser (x) | $5'`]: "the same six, apostrophed",
    [`FORGE_SESSION_ID=a-run forge comment ISS-29 --body "one line\nand another"`]: "a quoted newline",
    [`FORGE_SESSION_ID=a-run ${WRITE} \\\n  --why "a line the shell joins"`]: "a continuation, no opener",
  };
  for (const [command, what] of Object.entries(reads)) {
    assert.equal(idGrantedBy(command), "a-run", what);
  }
});

/* ISS-949. The same removal one character class further in: an opener a shell would not act on where it stands is the prose it looks like, and this repository's convention puts a backtick around every
   identifier a record names. The quoting `shell-spans` reads is what decides, so every row is a shell fact — single quotes carry anything, a double quote runs a substitution and reads a process
   substitution or a here-doc operator as text, and a backslash makes an opener's own character literal. */
test("an opener a shell would not act on is the prose it looks like", () => {
  const advance = "forge advance ISS-29 --why";
  const reads = {
    [`FORGE_SESSION_ID=a-run ${advance} 'the \`set\` flag'`]: "a backtick apostrophed, which every record writes",
    [`FORGE_SESSION_ID=a-run ${advance} 'run $(date), \`date\` and <(date)'`]: "every spelling at once, apostrophed",
    [`FORGE_SESSION_ID=a-run ${advance} 'held \${ ROUNDS; } times'`]: "the brace substitution, apostrophed",
    [`FORGE_SESSION_ID=a-run ${advance} 'a body it takes on <<EOF'`]: "the here-doc operator, apostrophed",
    [`FORGE_SESSION_ID=a-run ${advance} "read <(date) as text"`]: "a process substitution a double quote does not run",
    [`FORGE_SESSION_ID=a-run ${advance} "shifted a << b"`]: "nor a here-doc operator",
    [`FORGE_SESSION_ID=a-run ${advance} "the \\\`set\\\` flag"`]: "a backtick a backslash made literal",
    [`FORGE_SESSION_ID=a-run ${advance} "\\$(not a substitution)"`]: "and the dollar of one",
    [`FORGE_SESSION_ID=a-run ${advance} pre\\\`set\\\`post`]: "the same escape outside every quote",
    [`FORGE_SESSION_ID=a-run ${advance} "it's the \\\`set\\\` flag, isn't it"`]: "apostrophes that delimit nothing, beside an escaped opener",
  };
  for (const [command, what] of Object.entries(reads)) {
    assert.equal(idGrantedBy(command), "a-run", what);
  }
});

/* The reading the rows above spend, in the spender's own suite: `plugin/test/hooks/` holds ten source files and an eleventh trips the folder-width limit, which is why `typed` and `waitsIn` are tested
   from their spenders too. A state character per character of the text, so an offset in the answer is an offset in the text — and one pair the shell removes, which is what joins an opener it split. */
test("every character a shell reads carries the quoting it stands under", () => {
  const under = (text) => quoting(text).map((one) => one.under).join("");
  assert.equal(under("cd /tmp"), "       ", "bare text stands under nothing");
  assert.equal(under("a 'b' c"), "  '''  ", "a single-quoted run, its delimiters in it");
  assert.equal(under('a "b" c'), '  """  ', "and a double-quoted one");
  assert.equal(under("a # b"), "  ###", "a comment, from its hash to the line's end");
  assert.equal(under("a \\# b"), "  \\\\  ", "a hash a backslash made literal opens none");
  assert.equal(under("a 'b"), "  ''", "an unclosed quote runs to the end");
  assert.equal(under("'a\\'"), "''''", "and a backslash inside single quotes escapes nothing");
  assert.deepEqual(quoting("$\\\n(x)").map(({ at, one }) => `${at}${one}`), ["0$", "3(", "4x", "5)"],
    "a continuation is gone, both characters of it, and its neighbours join");
  assert.equal(quoting("\u{1f600}$\\\n(x)").map(({ one }) => one).join(""), "\u{1f600}$(x)",
    "and the pair dropped is the pair, past a code point that is two code units");
  assert.equal(quoting("$\\q(x)").map(({ one }) => one).join(""), "$\\q(x)",
    "where every other escaped character stands where it stood");
});

/* The other side of the same removal, and the reason the class could not simply go: an inline
   assignment prefixes one command, so a writer a substitution starts is a second process this grant
   never reaches, where an export — being the environment — does reach one. Every attempt to read what
   sits inside an opener had a hole, each row below one of them, so an opener is refused unread. */
test("a granted call that can start a second command is granted nothing", () => {
  const advance = "forge advance ISS-29 --why";
  const refuses = {
    [`FORGE_SESSION_ID=a-run ${WRITE} $(date)`]: "a substitution the prefix cannot reach",
    [`FORGE_SESSION_ID=a-run ${WRITE} \`date\``]: "the same, spelled with backticks",
    [`FORGE_SESSION_ID=a-run ${advance} "the \`set\` flag"`]: "a backtick a shell runs in double quotes",
    [`FORGE_SESSION_ID=a-run ${advance} 'closed' \`date\``]: "an opener past the quotes that end before it",
    [`FORGE_SESSION_ID=a-run ${advance} $'can\\'t'$(forge advance ISS-30)`]:
      "an apostrophe an ANSI-C word keeps, which this reading cannot place",
    [`FORGE_SESSION_ID=a-run ${advance} $\\\n'can\\'t'$(forge advance ISS-30)`]:
      "the same word, its own opener written as two characters neither of which is one",
    [`FORGE_SESSION_ID=a-run ${advance} "\u{1f600}$\\\n(forge advance ISS-30)"`]:
      "a continuation past a code point outside the BMP, where a code-point offset would be one out",
    [`FORGE_SESSION_ID=a-run ${advance} "\${missing:-"it's $(forge advance ISS-30)"}"`]:
      "a quote an expansion nests, which a flat reading of the text closes early",
    [`FORGE_SESSION_ID=a-run ${advance} "$[0 + "it's $(forge advance ISS-30)"]"`]:
      "and the deprecated arithmetic form, whose body no shell this runs on is read for",
    [`FORGE_SESSION_ID=a-run ${advance} "$(forge advance ISS-30)"`]: "a writer nested in a substitution",
    [`FORGE_SESSION_ID=a-run ${advance} "$(cd /x && forge advance ISS-30)"`]: "a separator a quote hides",
    [`FORGE_SESSION_ID=a-run ${advance} "it's $(forge advance ISS-30) isn't"`]: "apostrophes delimit nothing",
    [`FORGE_SESSION_ID=a-run ${advance} "say '$(forge advance ISS-30)' now"`]: "nor does a spaced pair",
    [`FORGE_SESSION_ID=a-run ${advance} "$(for"ge" advance ISS-30)"`]: "what quote removal spells",
    [`FORGE_SESSION_ID=a-run ${advance} "$\\\n(forge advance ISS-30)"`]: "a continuation splitting an opener",
    [`FORGE_SESSION_ID=a-run ${advance} "\${ forge advance ISS-30; }"`]: "bash 5.3's brace substitution",
    [`FORGE_SESSION_ID=a-run ${advance} "\${| forge advance ISS-30; }"`]: "and the form that names a reply",
    [`FORGE_SESSION_ID=a-run forge comment ISS-29 <(forge issue ISS-30)`]: "a process substitution",
    [`FORGE_SESSION_ID=a-run forge comment ISS-29 - <<EOF\n# $(forge advance ISS-30)\nEOF`]:
      "a body the shell expands and `spans` reads as a comment",
    ["FORGE_SESSION_ID=a-run forge advance ISS-29"]: "a no-break space is part of the name",
  };
  for (const [command, what] of Object.entries(refuses)) {
    assert.equal(idGrantedBy(command), null, what);
  }
});
