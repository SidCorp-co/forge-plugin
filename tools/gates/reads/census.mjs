/* What blinds each test file of an audited run, every cause of it, and what a candidate change would
   free — derived through the collector the gate itself runs, never by matching a rendered cause
   string, which is how three readers before this one were wrong (ISS-1756). */
import { readFileSync } from "node:fs";
import { basename, isAbsolute, relative } from "node:path";
import { pathToFileURL } from "node:url";

import { recordsIn, setsOf } from "./sets.mjs";

const HELP = `Usage: node tools/gates/reads/census.mjs <records-dir>... [--root <dir>] [--times <file>]
                                          [--change <module.mjs>]

Every blinding cause of every test file in one audited run, and what removing one would free.

A run leaves its records under <gate temp root>/gate-reads/<step>, one directory per test step, and
keeps that root when KEEP_TEST_ROOMS=1 is set. Name each directory; several are read as one run.

  --root <dir>      the repository those records were taken against. The working directory otherwise
  --times <file>    per-file seconds, as '12.3s plugin/test/one.test.mjs' lines. The gate writes one
                    per test step at <gate ledger>/<step>.files
  --change <module> a candidate change, as an ES module exporting record(one, root): one audited
                    process record as that change would have left it. Drop a name from its 'blind'
                    array where an export stops blinding, or move a 'spawned' entry's cwd where a
                    child really stands. Every cause is then re-derived through the gate's own
                    reaches over the rewritten records, so nothing here reads a cause string

A cause is of one of two kinds, and they are different work: 'export' is a name the audit classifies
as unfollowable, fixed in the table in tools/gates/reads/audit.mjs with no test moving; 'child' is a
process that left no record and could have read this repository, fixed by closing that boundary in
the one test file that opens it. A file blinded by three causes is freed by none of them alone.`;

const flagged = (argv, name) => {
  const at = argv.indexOf(name);
  return at === -1 ? null : argv[at + 1] ?? null;
};

const secondsIn = (path) => {
  const took = new Map();
  if (path === null) return took;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const hit = /^\s*([\d.]+)s\s+(\S+)/u.exec(line);
    if (hit) took.set(hit[2], Math.max(took.get(hit[2]) ?? 0, Number(hit[1])));
  }
  return took;
};

const readAll = (dirs) => {
  const byTicket = new Map();
  const roots = [];
  for (const dir of dirs) {
    const held = recordsIn(dir);
    for (const [ticket, one] of held.byTicket) byTicket.set(ticket, one);
    roots.push(...held.roots);
  }
  return { byTicket, roots };
};

const changed = ({ byTicket, roots }, how, root) => ({
  byTicket: new Map([...byTicket].map(([ticket, one]) => [ticket, how(one, root)])),
  roots: roots.map((one) => how(one, root)),
});

const rowsOf = (sets, took) => sets
  .map((one) => ({ file: one.file, causes: one.blind, took: took.get(one.file) ?? 0 }))
  .sort((one, other) => one.file.localeCompare(other.file));

const sum = (rows) => Math.round(rows.reduce((at, one) => at + one.took, 0));

const named = (rows) => rows.slice().sort((one, other) => other.took - one.took)
  .map((one) => `  ${one.took.toFixed(1)}s ${one.file}`);

/* A child's cwd is a scratch path per case, so the cause carries its own room and every one of the
   hundred a file spawns is its own row. The shape is what a change is aimed at: the program, and
   whether it stood where this repository is. Exact causes stay under each file below. */
const where = (cwd, root) => {
  const rel = relative(root, cwd ?? root);
  if (rel === "") return "in the checkout";
  return rel.startsWith("..") || isAbsolute(rel) ? "outside, handed a path into the checkout" : "under the checkout";
};

const shapeOf = (cause, root) => (cause.kind === "export"
  ? cause.why
  : `${basename(cause.file)} standing ${where(cause.cwd, root)}`);

const byShape = (rows, root) => {
  const held = new Map();
  for (const row of rows) {
    for (const cause of row.causes) {
      const shape = shapeOf(cause, root);
      const key = `${cause.kind} ${shape}`;
      if (!held.has(key)) held.set(key, { kind: cause.kind, shape, files: new Set() });
      held.get(key).files.add(row);
    }
  }
  return [...held.values()].map((one) => ({ ...one, rows: [...one.files] }))
    .sort((one, other) => other.rows.length - one.rows.length
      || sum(other.rows) - sum(one.rows) || one.shape.localeCompare(other.shape));
};

const causeTable = (table) => [
  "| kind | what blinds it | files | node's own seconds |",
  "|---|---|---|---|",
  ...table.map((one) => `| ${one.kind} | \`${one.shape}\` | ${one.rows.length} | ${sum(one.rows)}s |`),
];

/* The count that made four filings wrong: summing this column double-counts every file more than one
   cause reaches, so it is printed beside the population it is a sum over rather than instead of it. */
const overlapSaid = (blind, table) => {
  const summed = table.reduce((at, one) => at + one.rows.length, 0);
  const several = blind.filter((one) => one.causes.length > 1);
  return `${summed} file-and-cause pair(s) over ${blind.length} blind file(s): `
    + `${several.length} of them carry more than one cause, so the files column sums to more than the `
    + `population and a per-cause figure predicts nothing on its own.`;
};

/* Grouped under the shape and never reduced to it: a run's hundred children of one shape stand in a
   hundred rooms of their own, and the exact cause is what somebody writing a ceiling has to read. */
const causesSaid = (causes, root) => {
  const held = new Map();
  for (const cause of causes) {
    const shape = `${cause.kind}: ${shapeOf(cause, root)}`;
    if (!held.has(shape)) held.set(shape, []);
    held.get(shape).push(cause.why);
  }
  return [...held].flatMap(([shape, why]) => [`      ${shape}${why.length > 1 ? ` ×${why.length}` : ""}`,
    ...(why.length === 1 && why[0] === shape.slice(shape.indexOf(": ") + 2) ? [] : why.map((one) => `          ${one}`))]);
};

const perFile = (blind, root) => blind.slice().sort((one, other) => other.took - one.took)
  .map((one) => [`  ${one.took.toFixed(1)}s ${one.file}`, ...causesSaid(one.causes, root)].join("\n"));

const prediction = (before, after) => {
  const left = new Set(after.filter((one) => one.causes.length > 0).map((one) => one.file));
  const was = before.filter((one) => one.causes.length > 0);
  const freed = was.filter((one) => !left.has(one.file));
  const wasBlind = new Set(was.map((one) => one.file));
  const gained = after.filter((one) => one.causes.length > 0 && !wasBlind.has(one.file));
  const still = after.filter((one) => one.causes.length > 0 && wasBlind.has(one.file));
  return [
    "",
    "## What this candidate is worth, re-derived rather than matched",
    "",
    "| | blind files | blind seconds |",
    "|---|---|---|",
    `| before | ${was.length} | ${sum(was)}s |`,
    `| after | ${still.length + gained.length} | ${sum([...still, ...gained])}s |`,
    `| **freed** | **${freed.length}** | **${sum(freed)}s** |`,
    "",
    `Freed, every one by name (${freed.length}):`,
    ...named(freed),
    "",
    `Newly blind, which a candidate should not make (${gained.length}):`,
    ...named(gained),
  ];
};

const argv = process.argv.slice(2);
if (argv.length === 0 || argv.includes("-h") || argv.includes("--help")) {
  console.log(HELP);
  process.exit(argv.length === 0 ? 1 : 0);
}

const root = flagged(argv, "--root") ?? process.cwd();
const times = flagged(argv, "--times");
const change = flagged(argv, "--change");
const dirs = argv.filter((one, at) => !one.startsWith("--") && !argv[at - 1]?.startsWith("--"));

const took = secondsIn(times);
const records = readAll(dirs);
const rows = rowsOf(setsOf(records, root), took);
const blind = rows.filter((one) => one.causes.length > 0);
const table = byShape(blind, root);

const out = [
  `# The blind census: \`node tools/gates/reads/census.mjs ${argv.join(" ")}\``,
  "",
  `Root \`${root}\`, records from ${dirs.map((one) => `\`${one}\``).join(", ")}.`,
  "",
  `${rows.length} test file(s) left a record; ${blind.length} blind, carrying ${sum(blind)}s of ${sum(rows)}s.`,
  overlapSaid(blind, table),
  "",
  "## Every cause by its shape, counted once per file it blinds",
  "",
  ...causeTable(table),
  "",
  "## Every blind file, and every cause that reaches it",
  "",
  ...perFile(blind, root),
];

if (change !== null) {
  const how = (await import(pathToFileURL(change).href)).record;
  if (typeof how !== "function") {
    console.error(`${change} exports no \`record\` function, so there is no candidate to apply. `
      + `Export \`record(one, root)\` returning one audited process record as the change would have left it.`);
    process.exit(1);
  }
  out.push(...prediction(rows, rowsOf(setsOf(changed(records, how, root), root), took)));
}

console.log(out.join("\n"));
