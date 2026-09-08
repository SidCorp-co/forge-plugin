/* The handled-forms listing, pinned against a transcript small enough to add up by hand. A form
   reached for through a pipeline counts and a word where nothing ran does not, which is what a run
   got being the figure's subject — the same reason the refusal reader in runs.test.mjs has. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { slugFor } from "../../src/stats/transcripts.mjs";
import { READ_AS } from "../../src/resolve/handler.mjs";
import { tempRoom } from "../fixtures.mjs";

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const PROJECT = "/fixture/project";
const BASE = Date.parse("2026-09-01T00:00:00.000Z");
const at = (seconds) => new Date(BASE + seconds * 1000).toISOString();

const use = (id, seconds, name, input) => JSON.stringify({
  timestamp: at(seconds),
  message: { role: "assistant", content: [{ type: "tool_use", id, name, input }] },
});

const result = (id, seconds, content, isError = false) => JSON.stringify({
  timestamp: at(seconds),
  message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content, is_error: isError }] },
});

const ask = (room, ...argv) =>
  spawnSync(FORGE, ["stats", "runs", "--checkout", PROJECT, ...argv], {
    encoding: "utf8",
    env: { ...process.env, XDG_CONFIG_HOME: tempRoom("stats-forms-home-"), TMPDIR: room },
  });

const said = (form, verb, ref) => `${READ_AS} ${form} as forge ${verb}${ref ? ` ${ref}` : ""}`;

test("the forms listing is what a run performed, keyed on the word typed", () => {
  const room = tempRoom("stats-forms-");
  const tasks = join(room, `claude-${process.getuid()}`, slugFor(PROJECT), "s", "tasks");
  mkdirSync(tasks, { recursive: true });
  const ran = (id, start, command, body, bad = false) =>
    [use(id, start, "Bash", { command }), result(id, start + 1, body, bad)];
  writeFileSync(join(tasks, "a0001.output"), `${[
    JSON.stringify({ timestamp: at(0), type: "user", message: { role: "user", content: "Skill forge:issue-flow ISS-97" } }),
    ...ran("h1", 10, "forge close ISS-97", `${said("close", "advance", "ISS-97")}\nISS-97  released -> closed`),
    ...ran("h2", 20, "forge list --status open", `${said("list", "issue")}\nISS-42  high  open  a title`),
    /* Through a pipe, which is how a form arrives most of the time and is still a form performed. */
    ...ran("h3", 30, "forge list --limit 5 | head -2", `${said("list", "issue")}\nISS-42  high  open  a title`),
    /* The form ran and what it ran refused: two readings of one call, each counted where it belongs. */
    ...ran("h4", 40, "forge park ISS-97",
      `${said("park", "advance", "ISS-97")}\nadvance: --park was given no value.`, true),
    ...ran("h5", 50, "forge advance ISS-97", "ISS-97  released -> closed"),
    use("h6", 60, "Bash", { command: "cat docs/cli/the-handler.md" }),
    result("h6", 61, `The line is \`${READ_AS} <form> as forge <verb>\`, on stderr.`),
    /* A log read quoting the line exactly: nothing performed it, so the count needs the command too (F3). */
    ...ran("h7", 70, "tail -3 /tmp/last-run.log", `${said("close", "advance", "ISS-45")}\nISS-45  released -> closed`),
    /* And a real line whose pair the handler does not route, which is a form name invented. */
    ...ran("h8", 80, "forge show ISS-97", `${said("show", "advance", "ISS-97")}\nnothing`),
    /* Both halves quoted into one command that ran neither, which is why the third claim is position. */
    ...ran("h9", 90, `printf '%s\\n' '${said("close", "advance", "ISS-45")}' 'forge close ISS-45'`,
      `${said("close", "advance", "ISS-45")}\nforge close ISS-45`),
    /* A heredoc body, stripped by the class reading before it decides, so this row inherits that repair. */
    ...ran("h13", 130, `cat <<'EOF'\n${said("close", "advance", "ISS-45")}\nforge close ISS-45\nEOF`,
      `${said("close", "advance", "ISS-45")}\nforge close ISS-45`),
    /* And the shapes that must go on counting: an environment prefix, and a path to the binary. */
    ...ran("h10", 100, "FORGE_SESSION_ID=x forge get ISS-97", `${said("get", "issue", "ISS-97")}\n{}`),
    ...ran("h11", 110, "./plugin/bin/forge read ISS-97", `${said("read", "issue", "ISS-97")}\n{}`),
  ].join("\n")}\n`);
  const run = ask(room);
  assert.equal(run.status, 0, run.stderr);
  const out = run.stdout;
  const has = (line) => assert.ok(out.includes(line), `${line}\n--- printed ---\n${out}`);
  has("handled forms performed, by the word typed");
  has("     1  close");
  has("     2  list");
  has("     1  park");
  assert.ok(!/^ {5}\d+ {2}advance$/mu.test(out), `a verb typed as itself was counted a form:\n${out}`);
  assert.ok(!/<form>/u.test(out), `a document naming the shape was counted:\n${out}`);
  assert.ok(!/^ {5}\d+ {2}show$/mu.test(out), `a pair the handler does not route was counted:\n${out}`);
  has("     1  get");
  has("     1  read");
  assert.ok(/^ {5}1 {2}close$/mu.test(out),
    `the log read and the printf were counted as closes, so position is not being read:\n${out}`);
});
