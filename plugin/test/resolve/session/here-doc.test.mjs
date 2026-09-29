/* ISS-1717. The reader every session-id reader takes a command's text through: what it removes is a here-document's body and nothing else, since a line it drops that the shell runs is a
   command no reader after it sees, and one it keeps that is only a body is a call, an id or a move nobody made. */
import assert from "node:assert/strict";
import test from "node:test";

import { withoutBodies } from "../../../src/resolve/session/here-doc.mjs";

test("a here-document it can delimit loses its body and its operator, and nothing else", () => {
  const cut = {
    "cat > f <<'X'\nforge comment\nX\nforge issue ISS-1": "cat > f      \nforge issue ISS-1",
    "cat <<-EOF\n\tcd /x\n\tEOF\nls": "cat       \nls",
    "cat <<A <<'B'\none\nA\ntwo\nB\nls": "cat          \nls",
    "cat <<X\n\\$(no)\nX": "cat    \n",
  };
  for (const [text, left] of Object.entries(cut)) assert.equal(withoutBodies(text), left, text);
});

test("a << that is no here-document, or one it cannot vouch for, leaves the text whole", () => {
  for (const text of [
    "printf '%s\\n' \"$((1 << exit))\"\nexit\nforge comment ISS-1",
    "(( x << y ))\ny\nforge comment ISS-1",
    "x=$(cat <<'E'\nbody\nE\n)\nforge comment ISS-1",
    "echo 'a <<X'\nX\nforge comment ISS-1",
    "cat <<< X\nX\nforge comment ISS-1",
    "cat <<X\n$(forge advance ISS-2)\nX\nforge comment ISS-1",
    "cat <<X\nnever closed\nforge comment ISS-1",
  ]) assert.equal(withoutBodies(text), text, text);
});
