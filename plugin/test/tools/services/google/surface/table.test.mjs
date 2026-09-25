/* The consent table against every write the six served documents hold: each is named by a row or
   freed by the list, so a refresh that brings in a write nobody judged fails here; the free list names
   only methods the documents hold and none a row always refuses; and a write the table does not name
   is refused rather than sent, which the last case proves through the one path every call takes. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";

import { tempRoom } from "../../../../fixtures.mjs";
import { CONSENT, FREE, UNCLASSIFIED, classified, consentOwed, consentSaid, rowsFor } from "../../../../../src/tools/services/google/consent.mjs";
import { SERVED_SERVICES, carriedIndex, methodById } from "../../../../../src/tools/services/google/surface.mjs";

const writes = () => SERVED_SERVICES.flatMap((service) => Object.entries(carriedIndex(service).methods)
  .filter(([, entry]) => entry.http !== "GET").map(([id]) => methodById(id)));

test("every non-GET method of the six served documents is named by a row or freed by the list", () => {
  const unnamed = writes().filter((method) => !classified(method)).map((method) => method.id);
  assert.deepEqual(unnamed, [], "name each in a row of CONSENT or in FREE, in consent.mjs");
  assert.ok(writes().length > 100, "the walk reached the documents");
});

test("the free list names only methods the documents hold, none of them a read, and none a row always refuses", () => {
  for (const id of Object.values(FREE).flat()) {
    const method = methodById(id);
    assert.notEqual(method.entry.http, "GET", `${id} is a read, which owes nothing without being listed`);
    assert.deepEqual(rowsFor(method).filter((row) => !row.when).map((row) => row.owes), [], `${id} is freed and refused at once`);
  }
});

test("every row names at least one served method, so no row is a rule nothing reaches", () => {
  for (const row of CONSENT) {
    assert.ok(writes().some((method) => row.names(method)), `${row.owes}${row.where ? ` where ${row.where}` : ""} names nothing`);
  }
});

const invented = { id: "drive.files.frobnicate", service: "drive", index: carriedIndex("drive"),
  entry: { http: "POST", path: "files/{fileId}:frobnicate" } };

test("a write the table does not name owes --yes as unclassified, and a read owes nothing", () => {
  assert.equal(classified(invented), false);
  assert.equal(consentOwed(invented, { body: null }), UNCLASSIFIED);
  assert.equal(consentSaid(invented), UNCLASSIFIED);
  assert.equal(consentOwed(methodById("drive.files.get"), { body: null }), null);
});

test("what a listing says a method owes names each condition a conditional row fires on", () => {
  assert.equal(consentSaid(methodById("drive.files.delete")), "deletes");
  assert.equal(consentSaid(methodById("drive.files.create")), null);
  assert.equal(consentSaid(methodById("drive.files.update")), "trashes where its body sets trashed; overwrites a file's content where it uploads");
  assert.equal(consentSaid(methodById("sheets.spreadsheets.batchUpdate")), "removes or overwrites content in its batch where a request in it deletes, clears, replaces or writes over cells");
});

const INVOCATION = new URL("../../../../../src/tools/services/google/invocation.mjs", import.meta.url).href;
const SURFACE = new URL("../../../../../src/tools/services/google/surface.mjs", import.meta.url).href;

test("an unclassified write is refused with 3 through invoke before any token is asked for", () => {
  const script = `import { invoke } from ${JSON.stringify(INVOCATION)};
import { carriedIndex } from ${JSON.stringify(SURFACE)};
const method = ${JSON.stringify({ ...invented, index: undefined })};
method.index = carriedIndex("drive");
await invoke(method, { params: { fileId: "F1" }, path: "files/F1:frobnicate", query: {}, body: null }, { argv: ["drive", "files", "frobnicate", "F1"] });`;
  const run = spawnSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8",
    env: { ...process.env, XDG_CONFIG_HOME: tempRoom("google-table-"), FORGE_GOOGLE_ACCESS_TOKEN: "ya29.table-sentinel" } });
  assert.equal(run.status, 3, run.stderr);
  assert.ok(run.stderr.includes(`drive.files.frobnicate ${UNCLASSIFIED}, which --yes has to be given for`), run.stderr);
  assert.match(run.stderr, /carry it out: forge google drive files frobnicate F1 --yes/u);
});
