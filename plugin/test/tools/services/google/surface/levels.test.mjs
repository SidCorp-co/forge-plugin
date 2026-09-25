/* The tree as a caller meets it: `-h` at a service, a resource and a nested resource lists that level,
   a command stopping at a level is refused with the listing, a word that names nothing is answered
   from its own level's children, and `schema` takes a level as well as a method. None reaches Google. */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { google, googleHome, startFake } from "../fake.mjs";
import { treeOf } from "../../../../../src/tools/services/google/tree.mjs";

let fake = null;
let home = null;

before(async () => {
  fake = await startFake();
  home = googleHome(fake);
});

after(() => fake?.close());

const ran = async (...argv) => {
  fake.requests.length = 0;
  return google(home, argv);
};

test("-h at a service lists its resources and names no method it does not have", async () => {
  const answer = await ran("gmail", "-h");
  assert.equal(answer.status, 0, answer.stderr);
  assert.match(answer.stdout, /^Resources: users$/mu);
  assert.match(answer.stdout, /^Methods: none$/mu);
});

test("-h at a resource lists its resources and its methods with verb, positionals and --yes", async () => {
  const answer = await ran("gmail", "users", "-h");
  assert.equal(answer.status, 0, answer.stderr);
  assert.match(answer.stdout, /^Resources: drafts, history, labels, messages, settings, threads$/mu);
  assert.match(answer.stdout, /^ {2}getProfile +GET +\[userId\]$/mu);
  assert.match(answer.stdout, /^ {2}stop +POST +\[userId\] +--yes: removes$/mu);
});

test("-h at a nested resource lists that level only, positionals in parameterOrder", async () => {
  const messages = await ran("gmail", "users", "messages", "-h");
  assert.equal(messages.status, 0, messages.stderr);
  assert.match(messages.stdout, /^Resources: attachments$/mu);
  assert.match(messages.stdout, /^ {2}delete +DELETE +\[userId\] <id> +--yes: deletes$/mu);
  assert.match(messages.stdout, /^ {2}get +GET +\[userId\] <id>$/mu);
  assert.ok(!messages.stdout.includes("getProfile"), "a level lists its own methods, not its parent's");
  const tabs = await ran("sheets", "spreadsheets", "sheets", "-h");
  assert.match(tabs.stdout, /^ {2}copyTo +POST +<spreadsheetId> <sheetId>$/mu);
  const smime = await ran("gmail", "users", "settings", "sendAs", "smimeInfo", "-h");
  assert.match(smime.stdout, /^ {2}insert +POST +\[userId\] <sendAsEmail> +--yes: changes where mail goes$/mu);
});

test("-h after a method prints its call, its verb and path, and what it owes", async () => {
  const answer = await ran("drive", "files", "delete", "-h");
  assert.equal(answer.status, 0, answer.stderr);
  assert.match(answer.stdout, /^Usage: forge google drive files delete <fileId> \[flags\]$/mu);
  assert.match(answer.stdout, /^DELETE files\/\{fileId\}/mu);
  assert.match(answer.stdout, /^--yes: deletes$/mu);
});

test("a command that stops at a level exits 3 with that level's listing on stderr", async () => {
  for (const argv of [["sheets"], ["gmail", "users", "settings"]]) {
    const answer = await ran(...argv);
    assert.equal(answer.status, 3, argv.join(" "));
    assert.ok(answer.stderr.includes(`${argv.join(".")} is a level, not a method`), answer.stderr);
    assert.match(answer.stderr, /^Resources: /mu);
    assert.equal(answer.stdout, "");
  }
  assert.deepEqual(fake.requests, []);
});

const suggested = (stderr) => (/Did you mean: (?<names>[^?]+)\?/u.exec(stderr)?.groups.names ?? "").split(", ").filter(Boolean);

test("a word naming nothing at its level is refused with 4 and suggestions from that level alone", async () => {
  const cases = [[["gmail", "users", "mesages", "list"], "gmail.users"], [["drive", "files", "lst"], "drive.files"],
    [["gmail", "users", "settings", "sendas", "list"], "gmail.users.settings"]];
  for (const [argv, at] of cases) {
    const answer = await ran(...argv);
    assert.equal(answer.status, 4, answer.stderr);
    assert.ok(answer.stderr.includes(`No resource or method of ${at} named`), answer.stderr);
    let node = treeOf(at.split(".")[0]);
    for (const word of at.split(".").slice(1)) node = node.resources[word];
    const children = [...Object.keys(node.resources), ...Object.keys(node.methods)];
    const names = suggested(answer.stderr);
    assert.ok(names.length > 0, answer.stderr);
    for (const name of names) assert.ok(children.includes(name), `${name} is not a child of ${at}`);
  }
});

test("schema of a resource prints its subtree, each method with verb, positionals and consent", async () => {
  const shown = JSON.parse((await ran("schema", "gmail.users.messages")).stdout);
  assert.equal(shown.id, "gmail.users.messages");
  assert.deepEqual(shown.methods.delete, { http: "DELETE", args: ["userId", "id"], yes: "deletes" });
  assert.deepEqual(shown.methods.get, { http: "GET", args: ["userId", "id"], yes: null });
  assert.deepEqual(Object.keys(shown.resources.attachments.methods), ["get"]);
  const service = JSON.parse((await ran("schema", "sheets")).stdout);
  assert.equal(service.served, true);
  assert.deepEqual(service.resources.spreadsheets.resources.sheets.methods.copyTo,
    { http: "POST", args: ["spreadsheetId", "sheetId"], yes: null });
});

test("schema of an unserved service's level still reads it, marked unserved", async () => {
  const shown = JSON.parse((await ran("schema", "chat.spaces")).stdout);
  assert.equal(shown.served, false);
  assert.ok(shown.methods.list);
});
