/* The write gates read where a here-document's body is through the reader the session-id readers
   take (ISS-2865). Their own pattern took any `<<` for an opener, a quoted, commented, here-string or
   shift one included, and dropped everything after it; read only the first operator of a line; took
   only a letters-and-digits word for a delimiter; and ended a body at any line holding that word
   between blanks. Each case below is a verdict that moved with the fold, or one that had to hold. */
import assert from "node:assert/strict";
import test from "node:test";

import { shellWrites, writtenPaths } from "../../../hooks/_hook.mjs";

const SKILL = ".claude/skills/x/SKILL.md";
const MEMORY = "/m/memory/x.md";
const written = (command) => writtenPaths(shellWrites(command), "/w").map((one) => one.token);
const sees = (command, path) => assert.ok(written(command).includes(path), `${JSON.stringify(command)}: ${JSON.stringify(written(command))}`);
const misses = (command, path) => assert.ok(!written(command).includes(path), `${JSON.stringify(command)}: ${JSON.stringify(written(command))}`);

test("a << that opens no here-document leaves the line after it a command", () => {
  for (const opener of ['echo "use <<EOF"', "echo $(( 1 << 2 ))", "cat <<< hi", "# see <<EOF", "(( x <<= 1 ))"]) {
    sees(`${opener}\necho hi > ${SKILL}`, SKILL);
  }
});

test("every operator on a line has its body read as data", () => {
  misses(`cat <<A <<B\none\nA\ncp a ${MEMORY}\nB\necho ok`, MEMORY);
  sees(`cat <<A <<B\none\nA\ntwo\nB\necho hi > ${SKILL}`, SKILL);
});

test("only the exact delimiter line ends a body", () => {
  misses(`cat > f <<EOF\n  EOF\ncp a ${MEMORY}\nEOF`, MEMORY);
  sees(`cat > f <<EOF\n  EOF\nEOF\necho hi > ${SKILL}`, SKILL);
});

test("a delimiter a shell word spells beyond letters and digits is placed", () => {
  misses(`cat > f <<'END-X'\ncp a ${MEMORY}\nEND-X`, MEMORY);
  misses(`cat > f <<"EOF.1"\ncp a ${MEMORY}\nEOF.1`, MEMORY);
});

test("a commit message fed through a command substitution is prose, a double quote inside it included", () => {
  const message = `fix > ${MEMORY}\nsay "hi" > ${SKILL}\nit's done`;
  assert.deepEqual(written(`git commit -m "$(cat <<'EOF'\n${message}\nEOF\n)"`), []);
  sees(`git commit -m "$(cat <<'EOF'\n${message}\nEOF\n)"\necho hi > ${SKILL}`, SKILL);
});

test("a body inside a bare substitution or a subshell is data", () => {
  misses(`x=$(cat <<'EOF'\ncp a ${MEMORY}\nEOF\n)\necho ok`, MEMORY);
  misses(`( cat <<'EOF'\ncp a ${MEMORY}\nEOF\n)\necho ok`, MEMORY);
  sees(`x=$(cat <<'EOF'\nbody\nEOF\n)\necho hi > ${SKILL}`, SKILL);
});

test("a body inside a -c body is data there too", () => {
  misses(`bash -c 'cat > f <<EOF\ncp a ${MEMORY}\nEOF'`, MEMORY);
  sees(`bash -c 'cat > f <<EOF\nbody\nEOF\necho hi > ${SKILL}'`, SKILL);
});

test("a body a shell or an interpreter reads on stdin is still its program, inside a -c body or not", () => {
  sees(`bash <<'EOF'\ncp a ${MEMORY}\nEOF`, MEMORY);
  sees(`python3 - <<'PY'\nopen('${MEMORY}', 'w')\nPY`, MEMORY);
  sees(`bash -c 'bash <<EOF\ncp a ${MEMORY}\nEOF'`, MEMORY);
  /* A comparison in a program body is its own, and never a redirect: the onProgram reading, not the shell's. */
  const compared = `ok = "z" > "${SKILL}"`;
  misses(`python3 - <<'PY'\n${compared}\nPY`, SKILL);
  misses(`bash -c 'python3 - <<PY\n${compared.replaceAll('"', "")}\nPY\necho done'`, SKILL);
  sees(`bash -c 'python3 - <<PY\nx = 1\nPY\necho hi > ${SKILL}'`, SKILL);
});

test("a data body with no delimiter line is still dropped to the end of the text", () => {
  misses(`cat > f <<EOF\ncp a ${MEMORY}`, MEMORY);
  sees(`cat > ${SKILL} <<EOF\nbody`, SKILL);
});

test("an unquoted data body running a substitution is still dropped, and the write after it seen", () => {
  const command = `cat > f <<EOF\n$(echo hi > ${SKILL})\nEOF\necho hi > .claude/skills/y/SKILL.md`;
  misses(command, SKILL);
  sees(command, ".claude/skills/y/SKILL.md");
});
