/* `forge spec proofs`: the checkout's side of the reading — the tree, the test files the project
   declared and the words printed. What each list means and why none is a finding: docs/cli/spec-proofs.md. */
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { checkoutRoot, projectTests } from "../../resolve/settings.mjs";
import { flags } from "../../resolve/flags.mjs";
import { escapesIn } from "../claims/proof.mjs";
import { TREE, specTreeRead } from "../tree.mjs";
import { proofsRead } from "./read.mjs";

export const PROOFS = "proofs";
const KNOWN = ["--json"];

export const PROOFS_USAGE = [
  `Usage: forge spec ${PROOFS} [--json]`,
  "",
  "The Proof lines of this project's requirements tree read backwards, derived at this read and",
  "stored nowhere. Three lists, each opening with its count:",
  "  unproven criteria   each criterion on R-11's `none yet` escape, with the issue it names and",
  "                      whether that issue is still open — the one list that asks the tracker",
  "  unnamed test files  every file under `tests.root` whose name matches `tests.pattern` that no",
  "                      Proof names, most lines first, with its case count",
  "  shared cases        each case more than one criterion names, with those criteria",
  "",
  "  --json   one object with one member per list, each carrying its count, for a verb to read",
  "",
  "A list is a reading and never a finding, so this exits 0 whatever it holds. Where to look for",
  "tests is the project's to say: `forge doctor --set tests.root=<path>` and",
  "`forge doctor --set tests.pattern=<pattern>`, `*` and `?` its wildcards. Until both are set the",
  "unnamed list is reported unread and the other two still print.",
].join("\n");

const posixOf = (path) => path.split(sep).join("/");

/* Every file under the root whose own name the pattern takes. A link is not followed: the root is
   the project's word for where its tests are, and a link is a path to wherever its author liked. */
const walk = (root, dir, named, out = []) => {
  for (const one of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(dir, one.name);
    if (one.isDirectory()) walk(root, path, named, out);
    else if (one.isFile() && named.test(one.name)) {
      out.push({ path: posixOf(relative(root, path)), text: readFileSync(path, "utf8") });
    }
  }
  return out;
};

/* The key refuses a root that leaves the checkout by its spelling; a link inside it can still point
   anywhere, so the directory walked is the real one and it has to lie under the real checkout. */
const insideOf = (root, declared) => {
  const dir = join(root, declared);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return null;
  const [home, real] = [realpathSync(root), realpathSync(dir)];
  return real === home || real.startsWith(home + sep) ? real : null;
};

const setCalls = (keys) => keys.map((key) => `forge doctor --set ${key}=<${key.split(".")[1] === "root" ? "path" : "pattern"}>`);

/** The declared test files, or `unread` saying why there are none to compare. */
const testsHere = (root) => {
  const declared = projectTests();
  if (declared.problem) {
    const { key, takes, given } = declared.problem;
    return { unread: `\`${key}\` in ${declared.from} is ${takes}, not \`${JSON.stringify(given)}\`: ${setCalls([key])[0]}` };
  }
  if (declared.missing) {
    return { unread: `${declared.missing.join(" and ")} not set in ${declared.from}: ${setCalls(declared.missing).join(", ")}` };
  }
  const dir = insideOf(root, declared.root);
  if (!dir) {
    return { unread: `tests.root names ${declared.root}, which is no directory inside ${root}: ${setCalls(["tests.root"])[0]}` };
  }
  return { ...declared, tests: walk(realpathSync(root), dir, declared.named) };
};

const statusSaid = (one, keys) => {
  if (!one.key) return "names no issue";
  const key = one.key.padEnd(keys);
  if (one.status === null) return `${key}  status unread`;
  return `${key}  ${one.status}, ${one.owes ? "still owes the case" : "owes nothing now"}`;
};

const unprovenLines = ({ unproven, why }) => {
  const width = (of) => Math.max(0, ...unproven.map((one) => of(one).length));
  const [wide, ids, keys] = [width((one) => `${one.file}:${one.line}`), width((one) => one.id), width((one) => one.key ?? "")];
  return [
    `Unproven criteria: ${unproven.length}`,
    ...(why ? [`  statuses unread: ${why}`] : []),
    ...unproven.map((one) => `  ${`${one.file}:${one.line}`.padEnd(wide)}  ${one.id.padEnd(ids)}  ${statusSaid(one, keys)}`),
  ];
};

const unnamedLines = (held) => {
  if (held.unread) return [`Unnamed test files: not read — ${held.unread}`];
  const wide = Math.max(0, ...held.unnamed.map((one) => one.path.length));
  return [
    `Unnamed test files: ${held.unnamed.length} of ${held.tests.length} under ${held.root} named ${held.pattern}, most lines first`,
    ...held.unnamed.map((one) => `  ${one.path.padEnd(wide)}  ${one.lines} line(s), ${one.cases} case(s)`),
  ];
};

const sharedLines = (shared) => [
  `Shared cases: ${shared.length}`,
  ...shared.map((one) => `  ${one.path} "${one.name}"  ${one.criteria.join(", ")}`),
];

const asJson = (held) => ({
  proofs: held.proofs,
  unproven: { count: held.unproven.length, unread: held.why ?? null, criteria: held.unproven },
  unnamed: held.unread ? { count: null, unread: held.unread }
    : { count: held.unnamed.length, of: held.tests.length, root: held.root, pattern: held.pattern, files: held.unnamed },
  shared: { count: held.shared.length, cases: held.shared },
});

const NO_PROOFS = `No criterion under ${TREE}/ carries a Proof line, so there is nothing to read backwards.`;
const NO_TREE = `This project keeps no requirements tree at ${TREE}/, so no Proof line exists to read backwards.`;

/** `readOwing` answers with `{ statusOf, owes, why }` off the tracker, and is spent only where an
 *  escape names a key: a tree owing nothing is read with no call at all. */
export const proofs = async (argv, readOwing) => {
  const given = flags(argv, `spec ${PROOFS}`, KNOWN, { usage: PROOFS_USAGE });
  const root = checkoutRoot();
  const tree = root ? specTreeRead() : null;
  const said = (line) => console.log(given.json ? JSON.stringify({ proofs: 0, said: line }, null, 2) : line);
  if (!tree) return said(NO_TREE);
  const exists = (path) => existsSync(join(root, path));
  const local = testsHere(root);
  const owing = escapesIn(tree.documents).some((one) => one.key) ? await readOwing() : {};
  const read = proofsRead({ documents: tree.documents, tests: local.tests ?? null, exists, ...owing });
  if (!read.proofs) return said(NO_PROOFS);
  const held = { ...read, ...local, why: owing.why ?? null };
  if (given.json) return console.log(JSON.stringify(asJson(held), null, 2));
  return console.log([...unprovenLines(held), "", ...unnamedLines(held), "", ...sharedLines(held.shared)].join("\n"));
};
