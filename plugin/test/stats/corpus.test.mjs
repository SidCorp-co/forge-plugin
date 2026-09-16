/* Where a project's runs are read from, and what the reading says about each place it looked. */
import assert from "node:assert/strict";
import test from "node:test";
import { rmSync } from "node:fs";
import { join } from "node:path";

import { corpusUnder, durableBase, rootFor, sourcesFor } from "../../src/stats/corpus.mjs";
import { tempRoom } from "../fixtures.mjs";
import { ask, corpus, linkedIn, storedIn, transcript } from "./fixture-runs.mjs";

/* The home is read where it is used, so a case that left it would read the developer's own store. */
const read = (room) => {
  const was = process.env.HOME;
  process.env.HOME = room;
  try {
    return corpusUnder(join(room, `claude-${process.getuid()}`, "-fixture-project"));
  } finally {
    process.env.HOME = was;
  }
};

test("both places are worked out from the project directory, and neither arrives from a caller", () => {
  const root = rootFor("/a/project/");
  assert.deepEqual(sourcesFor(root).map((one) => one.path),
    [join(durableBase(), "-a-project"), root],
    "one slug, derived from the path, and the store read first so a counted run is named by the file that survives");
  assert.deepEqual(sourcesFor(root).map((one) => one.temporary), [false, true]);
  assert.equal(rootFor("/a/project"), root, "the trailing separator is cut, or one checkout answers as two corpora");
});

/* The index entries the host writes are symlinks into its own store, so a corpus read through the
   index alone is as deep as the last sweep left it and no deeper (ISS-1578). */
test("a run the index no longer reaches is counted where the host still holds it", () => {
  const room = tempRoom("stats-corpus-");
  storedIn(room, "session-one", "agent-0001.jsonl", transcript());
  const { transcripts, sources } = read(room);
  assert.equal(transcripts.length, 1, "the store answers for it with no index entry at all");
  assert.deepEqual(sources.map((one) => one.transcripts), [1, 0]);
  assert.equal(transcripts[0].session, "session-one", "and the session is the one the store filed it under");
});

test("a transcript both places reach is counted once, off the path each resolves to", () => {
  const room = tempRoom("stats-corpus-both-");
  linkedIn(room, "session-one", "0001", transcript());
  const { transcripts, sources } = read(room);
  assert.equal(transcripts.length, 1, "counted twice it would double every figure computed over the corpus");
  assert.deepEqual(sources.map((one) => [one.transcripts, one.taken]), [[1, 1], [1, 0]],
    "each place says what it held and what it added, which is what tells a swept index from an empty one");
  assert.match(transcripts[0].path, /\/subagents\/agent-0001\.jsonl$/u, "and the survivor is the one named");
});

test("a broken index entry stands for itself rather than taking the reading down", () => {
  const room = tempRoom("stats-corpus-broken-");
  linkedIn(room, "session-one", "0001", transcript());
  rmSync(join(room, ".claude", "projects", "-fixture-project", "session-one", "subagents", "agent-0001.jsonl"));
  assert.equal(read(room).transcripts.length, 1, "it is still an entry, and reading it is what says it is gone");
});

test("the reading names every place it looked and which of them the system sweeps", () => {
  const run = ask(corpus());
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /\/\.claude\/projects\/-fixture-project {2}0 transcript\(s\), 0 counted here$/mu);
  assert.match(run.stdout,
    /\/claude-\d+\/-fixture-project {2}2 transcript\(s\), 2 counted here {2}— a temporary filesystem, swept on reboot and between$/mu,
    "a reader told only that depth is gone cannot act; told which place is swept, they can");
});

test("the depth line carries its cause", () => {
  const room = corpus();
  const json = JSON.parse(ask(room, "--json").stdout);
  assert.deepEqual(json.sources.map((one) => one.temporary), [false, true],
    "the object carries the same two places, so a reading held at a mark can be read for them");
  assert.match(json.root, /\/claude-\d+\/-fixture-project$/u,
    "and the key a mark is held under is the one it always was, or every reading held for this project is orphaned");
});
