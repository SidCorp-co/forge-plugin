/* ISS-672. The id a command grants, read off each command of the text rather than off the text: a
   run in a worktree writes the assignment behind the `cd` that reaches it, and every position below
   fell through to the hook event's uuid while the CLI credited the exported name. */
import assert from "node:assert/strict";
import test from "node:test";

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
