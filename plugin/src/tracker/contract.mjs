/* The contract this flow runs on, read out of the copy that is running: it sits inside `plugin/`
   because installing copies that and nothing beside it, and beside guides.mjs because `forge guide`
   serves both. Served by part, never whole — the parts are the file's own headings, so nothing here
   lists them and fifty thousand characters never arrive at once (ISS-78). */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { bare, didYouMean } from "../suggest.mjs";

/** The contract this build reads and stamps on every record; another number is two versions in one. */
export const CONTRACT = 1;

export const SLUG = "contract";
export const LISTING_ROW = `${SLUG}\n  this plugin's own, not the tracker's: `
  + `\`forge guide ${SLUG}\` is the issue-flow contract's table of contents, one part per call`;
const HERE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WITHIN = join("guides", "issue-flow-contract.md");

export const contractPath = (root = HERE) => join(root, WITHIN);

export const readContract = (root = HERE) => {
  try {
    return readFileSync(contractPath(root), "utf8");
  } catch {
    return null;
  }
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

/* A separator is how a name is misremembered, not which part was meant, so it costs no round. */
export const partFor = (parts, key) =>
  parts.find((part) => part.keys.includes(key))
  ?? parts.find((part) => part.keys.some((one) => bare(one) === bare(String(key ?? "")))) ?? null;

export const keysOfAll = (parts) => parts.flatMap((part) => part.keys);

/** One line per part and per status, with its size and command, and none of the contract's prose. */
export const contentsOf = (parts, number) => {
  const rows = parts.flatMap((part) => part.keys.map((key) => [key, part.chars]));
  const width = rows.reduce((wide, [key]) => Math.max(wide, key.length), 0);
  return [
    `The issue-flow contract — this plugin's own, contract ${number}, ${parts.length} part(s).`,
    "Each line is one part, its size in characters, and the command that prints it:",
    "",
    ...rows.map(([key, chars]) =>
      `  ${key.padEnd(width)}  ${String(chars).padStart(6)}  forge guide ${SLUG} ${key}`),
  ];
};

/** Never silent: a copy that lost the file, or the heading, is the copy that most needs to be told. */
export const stageLine = (status, parts, path = contractPath()) => {
  const part = partFor(parts, status);
  if (!part) return `No ${status} stage in the contract at ${path} — \`forge doctor\` says what this copy has.`;
  return `Contract, the ${status} stage — ${part.said}: \`forge guide ${SLUG} ${status}\``
    + ` (${part.chars} characters).`;
};

/** Presence first: a copy with no file holds none of the rules that are not code. */
export const contractProblems = ({ text, path, reads = CONTRACT }) => {
  if (text === null || text === undefined) {
    return [`no contract at ${path}, so this copy holds none of the rules that are not code`];
  }
  const states = statesContract(text);
  if (states === null) {
    return [`${path} states no contract number, so nothing says which rules a reader has`];
  }
  if (states !== reads) {
    return [`${path} states contract ${states} and this build reads contract ${reads}`];
  }
  return [];
};

/** All of what the verb answers — lines, or one refusal — so a case can ask it without a process. */
export const contractAnswer = ({ part = null, tracker = false, extra = [], root = HERE } = {}) => {
  if (tracker) {
    return { refusal: `--tracker is a guide's own text and the contract is this plugin's, not the`
      + ` tracker's. \`forge guide ${SLUG}\` prints it.` };
  }
  if (extra.length) {
    return { refusal: `${SLUG} takes one part, not \`${[part, ...extra].join(" ")}\`.`
      + ` \`forge guide ${SLUG}\` lists them.` };
  }
  const text = readContract(root);
  const wrong = contractProblems({ text, path: contractPath(root) });
  if (wrong.length) return { refusal: `${wrong[0]}. \`forge doctor\` reports which copy is running.` };
  const parts = partsOf(text);
  if (!part) return { lines: contentsOf(parts, statesContract(text)) };
  const held = partFor(parts, part);
  if (held) return { lines: [held.text] };
  return { refusal: didYouMean(`guide ${SLUG}`, part, keysOfAll(parts),
    `\`forge guide ${SLUG}\` lists every part.`) };
};
