/* Which option a download verb names its file in: every reader of a write asks `WRITES` first, so an
   option it does not know is a file no gate is asked about. */
import assert from "node:assert/strict";
import test from "node:test";

import { WRITES, writtenPaths } from "../../../hooks/_hook.mjs";
import { tempRoom } from "../../fixtures.mjs";

const room = tempRoom("fetches-");

/* `WRITES` answers whether a command counts as a write at all, and it answers before `namesOf` is
   asked which file, so a spelling it cannot see is a write no gate reports and no refusal argues
   with (ISS-1547). Both verbs read one letter after a single hyphen, which is what a boundary after
   `-o` denied every target not spelled from the root: run here, `curl -output file://<a file>`
   creates `utput`, and `wget -Output` the same. */
test("a write verb's target written against its own option letter counts as a write", () => {
  for (const command of [
    "curl -otrap.md https://x",
    "wget -Onotes.md https://x",
    "curl -output https://x",
    "curl -o trap.md https://x",
    "curl -o/tmp/x.md https://x",
  ]) assert.equal(WRITES.test(command), true, command);
  for (const command of ["curl --outputting https://x", "wget --output-documented https://x"]) {
    assert.equal(WRITES.test(command), false, `${command} spells an option neither verb has`);
  }
  assert.deepEqual(
    writtenPaths("curl -otrap.md https://x", room).map((one) => one.token),
    ["trap.md"],
    "and the name reader is reached through that answer, so the gates see the file",
  );
});

/* A download verb writes through more options than its main one: run here against a `file://` source,
   `wget -o` and `-a` wrote their log, `curl -D` its header dump, and `--trace`, `--trace-ascii`,
   `--stderr`, `--libcurl` and `--etag-save` each the file they name — none of them read as a write,
   so a gate asked about a guarded path answered no while the file was there (ISS-1552). */
test("a file a download verb writes through any of its options counts as a write", () => {
  const spellings = (letter, long) => [
    [`${letter} f.md`, "f.md"], [`${letter}f.md`, "f.md"], [`${long} f.md`, "f.md"], [`${long}=f.md`, "f.md"],
  ];
  const cases = [
    ...["-o", "-a"].flatMap((letter, at) => spellings(letter, ["--output-file", "--append-output"][at])
      .map(([option, name]) => [`wget -q ${option} https://x`, name])),
    ...spellings("-D", "--dump-header").map(([option, name]) => [`curl -s ${option} https://x`, name]),
    ...["--trace", "--trace-ascii", "--stderr", "--libcurl", "--etag-save"]
      .map((long) => [`curl -s ${long} f.md https://x`, "f.md"]),
  ];
  for (const [command, name] of cases) {
    assert.equal(WRITES.test(command), true, command);
    assert.deepEqual(writtenPaths(command, room).map((one) => one.token), [name], `${command} writes ${name}`);
  }
  for (const command of [
    "curl --output-dir /tmp/a -O https://x",
    "curl --trace-time https://x",
    "curl --dump-headers h.md https://x",
    "wget --output-filed h.md https://x",
  ]) assert.equal(WRITES.test(command), false, `${command} names an option that writes no file of its own`);
});

/* A download verb reads its short options as a cluster, and the first letter taking a value takes the
   rest of the word or, where nothing is left, the next one. Read as a letter standing straight after
   the hyphen, the spellings a download is most often written in were no write at all, so a guarded
   file fetched with `curl -fsSLo` went past every gate (ISS-2958). */
test("a download verb's output option counts wherever it stands in a cluster of short options", () => {
  const cases = [
    ["curl -sSo f.md http://x", "f.md"],
    ["curl -fsSLo SKILL.md http://x", "SKILL.md"],
    ["curl -sSof.md http://x", "f.md"],
    ["wget -qO f.md http://x", "f.md"],
    ["wget -qOf.md http://x", "f.md"],
  ];
  /* One table and one comparison, so a red reading shows every spelling that failed and not only the first. */
  const tokens = (command, unplaceable) => writtenPaths(command, room, undefined, { unplaceable }).map((one) => one.token);
  assert.deepEqual(
    cases.map(([command]) => [command, WRITES.test(command), tokens(command), tokens(command, "strike")]),
    cases.map(([command, name]) => [command, true, [name], [name]]),
    "each counts as a write naming its file, under the strict reading as under the default",
  );
});

/* Run here, curl 8.18 wrote a file called `oh.md` for `-sDoh.md` and nothing for `-sHoq`: the letters
   behind `D` and `H` are the value each takes, so neither `o` is the output option. */
test("a letter behind a short option that takes a value is that value, not an option of its own", () => {
  assert.deepEqual(writtenPaths("curl -sDoh.md http://x", room).map((one) => one.token), ["oh.md"]);
  assert.equal(WRITES.test("curl -sHoq http://x"), false, "a header's value is no output");
});
