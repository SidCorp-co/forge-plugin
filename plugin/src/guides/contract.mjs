/* The contract the flow this project runs answers on, read out of the copy that is running: it sits
   inside `plugin/` because installing copies that and nothing beside it, and beside guides.mjs
   because `forge guide` serves both. Served by part, never whole — one file per part, ordered by the
   number its name carries, so nothing here lists them (ISS-78, ISS-802). Why one flow's directory is
   the whole of what it serves, and what that leaves undeclared: docs/cli/the-flow-axis.md. */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { bare, didYouMean } from "../suggest.mjs";
import { FLOWS, flowPinned, flowRefusal, servedFor } from "./flow.mjs";

/** The contract this build reads and stamps on every record; another number is two versions in one. */
export const CONTRACT = 1;

export const SLUG = "contract";
const ROW = `${SLUG}\n  this plugin's own, not the tracker's: `
  + `\`forge guide ${SLUG}\` is the issue-flow contract's table of contents, one part per call`;

/** The listing's own line, or the refusal every other row carries: a flow refused on one surface and served on another is the inconsistency the axis exists without. */
export const listingRow = () => {
  const held = flowRefusal();
  return held ? `${SLUG}\n  ${held}` : ROW;
};
const HERE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DIR = "contract";

export const contractRoot = (root = HERE) => join(root, "guides", DIR);

export const contractPath = (root = HERE, flow = flowPinned().value) =>
  join(contractRoot(root), flow);

/** One heading per file, at the top: a file that lost its own is prose the join serves under the part before it, and a second is a part whose file name addresses neither. */
export const partFileProblem = (name, text) => {
  const lines = String(text).split("\n").filter((line) => line.trim());
  const heads = lines.filter((line) => HEADING.test(line));
  if (!lines.length || !HEADING.test(lines[0])) return `${name} opens with no heading, so nothing addresses it`;
  return heads.length > 1 ? `${name} carries ${heads.length} headings, and its name addresses one part` : null;
};

export const partFilesIn = (dir) => {
  try {
    const names = readdirSync(dir).filter((one) => one.endsWith(".md")).sort();
    return names.length ? names.map((name) => [name, readFileSync(join(dir, name), "utf8")]) : null;
  } catch {
    return null;
  }
};

const flowsIn = (dir) => {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter((one) => one.isDirectory()).map((one) => one.name);
  } catch {
    return [];
  }
};

export const partEntriesIn = (dir) =>
  partFilesIn(dir)?.map(([name, text]) => ({ name, text })) ?? null;

/** One flow's whole contract: one `readdir` and no merge, since a flow's set is complete and no sibling is ever read for a part it has not got. */
export const contractParts = ({ root = HERE, flow = flowPinned().value } = {}) =>
  partEntriesIn(contractPath(root, flow));

export const joinedParts = (entries) => entries
  .map(({ text }) => text.replace(/\s+$/u, ""))
  .join("\n\n");

export const identityOf = (entries) => statesContract(joinedParts(entries));

/** The parts joined. A malformed part withholds the whole join rather than serving its prose under the part before it: a reader that took the join would answer with the wrong part's text and nothing would say so, and this way every reader takes its own absent-contract route to `forge doctor`, which names the file. */
export const readContract = (root = HERE, flow = flowPinned().value) => {
  const entries = contractParts({ root, flow });
  if (!entries) return null;
  if (entries.some(({ name, text }) => partFileProblem(name, text))) return null;
  return joinedParts(entries);
};

/* Its own line and shape, so the prose about contract versions is not read as the file's claim. */
const STATES = /^\*\*Contract (\d+)\.\*\*/mu;

export const statesContract = (text) => {
  const found = STATES.exec(String(text ?? ""));
  return found ? Number(found[1]) : null;
};

const HEADING = /^(#{1,6}) +(\S.*)$/u;
const SPAN = /`([^`]+)`/gu;
const DASH = /\s+—\s+/u;

const slugOf = (title) => title.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");

/* A heading names its part up to the em dash and says what it reads after. The statuses a part
   covers are the code spans in that first half, which is how `closed`, `dropped` is one part. */
const keysOf = (title) => {
  const [named] = title.split(DASH);
  const spans = [...named.matchAll(SPAN)].map((one) => one[1]);
  const rest = named.replace(SPAN, "").replace(/[,\s]+/gu, "");
  return spans.length && !rest ? spans : [slugOf(named)];
};

/** Every part, in order, holding the text to the next heading of any level: they partition the whole. */
export const partsOf = (text) => {
  const parts = [];
  for (const line of String(text ?? "").split("\n")) {
    const found = HEADING.exec(line);
    if (found) parts.push({ level: found[1].length, title: found[2], keys: keysOf(found[2]), body: [line] });
    else if (parts.length) parts.at(-1).body.push(line);
  }
  return parts.map(({ level, title, keys, body }) => {
    const held = body.join("\n").replace(/\s+$/u, "");
    const said = title.split(DASH).slice(1).join(" — ");
    return { level, title, keys, said, text: held, chars: held.length };
  });
};

/** Every part of a set with the file it was read out of, so a refusal can name that file. */
export const addressed = (entries) => entries.flatMap(({ name, text }) =>
  partsOf(text).map((part) => ({ ...part, file: name })));

/* A separator is how a name is misremembered, not which part was meant, so it costs no round. */
export const partFor = (parts, key) =>
  parts.find((part) => part.keys.includes(key))
  ?? parts.find((part) => part.keys.some((one) => bare(one) === bare(String(key ?? "")))) ?? null;

export const keysOfAll = (parts) => parts.flatMap((part) => part.keys);

/** What a citation of the contract resolves against: every key the verb would answer. */
export const contractKeys = (root = HERE, flow = flowPinned().value) => keysOfAll(partsOf(readContract(root, flow) ?? ""));

/** One line per part and per status, with its size and command, and none of the contract's prose. */
export const contentsOf = (parts, number) => {
  const rows = parts.flatMap((part) => part.keys.map((key) => [key, part]));
  const width = rows.reduce((wide, [key]) => Math.max(wide, key.length), 0);
  return [
    `The issue-flow contract — this plugin's own, contract ${number}, ${parts.length} part(s).`,
    "Each line is one part, its size in characters, and the command that prints it:",
    "",
    ...rows.map(([key, part]) =>
      `  ${key.padEnd(width)}  ${String(part.chars).padStart(6)}`
      + `  forge guide ${SLUG} ${key}`),
  ];
};

/** Never silent: a copy that lost the file, or the heading, is the copy that most needs to be told. */
export const stageLine = (status, parts, path = contractPath()) => {
  const part = partFor(parts, status);
  if (!part) return `No ${status} stage in the contract at ${path} — \`forge doctor\` says what this copy has.`;
  return `Contract, the ${status} stage — ${part.said}: \`forge guide ${SLUG} ${status}\``
    + ` (${part.chars} characters).`;
};

/** The malformed part before presence: a directory holding one is what `readContract` withholds the join for, and a reader told only that the contract is absent would go looking for a directory that is right there. The parts are resolved here rather than handed in, because a caller with no list to offer would otherwise switch the rule off and be told the contract is well formed (ISS-848). */
export const contractProblems = ({ root = HERE, flow = flowPinned().value, reads = CONTRACT } = {}) => {
  const dir = contractPath(root, flow);
  const entries = contractParts({ root, flow });
  if (entries === null) {
    return [`no contract at ${dir}, so this copy holds none of the rules that are not code`];
  }
  const malformed = entries
    .map(({ name, text }) => {
      const said = partFileProblem(name, text);
      return said === null ? null : `${dir}: ${said}`;
    })
    .filter(Boolean);
  if (malformed.length) return malformed;
  const states = identityOf(entries);
  if (states === null) {
    return [`${dir} states no contract number, so nothing says which rules a reader has`];
  }
  if (states !== reads) {
    return [`${dir} states contract ${states} and this build reads contract ${reads}`];
  }
  return [];
};

/** Which of the statuses handed in no part of this set answers. What is done with the answer, and why it is not a refusal, is `doctor.mjs`'s. */
export const unansweredIn = (parts, statuses) => statuses.filter((one) => !partFor(parts, one));

/** What this copy ships held against the slugs it declares, no pin in the question so a gate verdict does not move with a `.forge.json` it never declared. Both findings are about a slug: what a flow holds is its own, so no part and no sibling's set is left to hold it to. */
export const flowProblems = (root = HERE, flows = FLOWS) => {
  const out = [];
  for (const flow of Object.keys(flows)) {
    if (partFilesIn(contractPath(root, flow))) continue;
    out.push(`${flow} is declared and ${contractPath(root, flow)} holds no part — install the plugin again for a whole copy, or take the flow out of FLOWS`);
  }
  for (const name of flowsIn(contractRoot(root))) {
    if (!Object.hasOwn(flows, name)) {
      out.push(`${contractRoot(root)} holds ${name} and FLOWS names no such flow — declare it, or delete the directory`);
    }
  }
  return out;
};

/** All of what the verb answers — lines, or one refusal — so a case can ask it without a process. */
export const contractAnswer = ({ part = null, tracker = false, extra = [], root = HERE, flow = flowPinned().value } = {}) => {
  if (tracker) {
    return { refusal: `--tracker does not apply to ${SLUG}, which is this plugin's own, not the`
      + ` tracker's. \`forge guide ${SLUG}\` prints it.` };
  }
  if (extra.length) {
    return { refusal: `${SLUG} takes one part, not \`${[part, ...extra].join(" ")}\`.`
      + ` \`forge guide ${SLUG}\` lists them.` };
  }
  /* The flow before the file: an absent `erp-flow/` is a chosen slug, not a copy that lost its rules. */
  const pinned = flowRefusal();
  if (pinned) return { refusal: pinned };
  const wrong = contractProblems({ root, flow });
  if (wrong.length) return { refusal: `${wrong[0]}. \`forge doctor\` reports which copy is running.` };
  const entries = contractParts({ root, flow });
  const parts = addressed(entries);
  if (!part) return { lines: [...contentsOf(parts, identityOf(entries)), "", ...servedFor(flow)] };
  const held = partFor(parts, part);
  if (!held) {
    return { refusal: didYouMean(`guide ${SLUG}`, part, keysOfAll(parts),
      `\`forge guide ${SLUG}\` lists every part.`) };
  }
  return { lines: [held.text, "", ...servedFor(flow)] };
};
