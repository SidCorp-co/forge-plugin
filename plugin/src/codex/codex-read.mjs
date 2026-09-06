/* No commit gate reaches a plan or its criteria, so the verbs that write them ask. docs/cli/codex-the-consult.md. */
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { digest, locate } from "./codex-api.mjs";
import { answered, logEntries } from "./codex-log.mjs";
import { repoRoot } from "./codex.mjs";
import { bodyFrom } from "../resolve/payload.mjs";
import { typed } from "../hooks/shell-spans.mjs";

const OFF = "`FORGE_CODEX_DISABLE=1` in front of this command stands the check down; it runs in this "
  + "process, so the prefix reaches it.";

const FILE_ROUTE = (what) =>
  `${what} cannot have been read: a consult is asked for a path, and there is no path here. Write it `
  + "to a file and name the file.";

/* The log's key, quoted, and the root where the caller is not standing in one. `here` is the caller's own root, already computed, and a second probe answers the same directory at another realpath. */
const readIt = (here, root, rel, why) =>
  `${why}\n\nDo this: \`${here === root ? "" : `cd ${typed(root)} && `}echo "<the issue, and `
  + `what this claims to have verified in code>" | forge codex consult --send bodies ${typed(rel)}\`, `
  + `then re-send. ${OFF}`;

/* `recheckOwed`'s test: `sent` is what was read off disk, and a diffs consult sent none of it. */
const carriedWhole = (entry, rel) => {
  if (entry.send !== "bodies") return null;
  const held = (entry.sent ?? []).find((one) => one.rel === rel);
  return held && !held.clipped && Number(held.chars) > 0 ? held : null;
};

const named = (entry, rel) => (entry.files ?? []).includes(rel);

const STOOD_DOWN = { refusal: null, text: null };
const refusing = (refusal) => ({ refusal, text: null });

/* The one subset both readings below want, filtered once: the answered consults of this repository that named this file, oldest first. The log is tens of megabytes, so a second pass over it is the cost of the refusal path. */
const consultsOf = (entries, root, rel) =>
  answered(entries).filter((one) => one.root === root && named(one, rel));

/* Any consult, not the latest: restored bytes are read bytes, which a hash says and a clock denies. */
const readWhole = (mine, rel, sha) => mine.some((one) => carriedWhole(one, rel)?.sha === sha);

const whyNot = (mine, rel) => {
  const last = mine.at(-1);
  const of = last && (last.id ?? last.at);
  if (!last) return `No consult has read ${rel}, and the issue is about to take it as its own.`;
  if (last.send !== "bodies") return `Consult ${of} named ${rel} but sent its diff, not its text — a `
    + "reviewer told to fetch a file for itself may never have asked for it.";
  if (!carriedWhole(last, rel)) return `Consult ${of} carried no whole body for ${rel}, so that much of `
    + "it is unread.";
  return `Consult ${of} read ${rel} whole, and its text has changed since.`;
};

/** The refusal owed before a file becomes an issue's plan or its criteria, and the bytes it judged. */
export const readOrRefuse = (path, cwd = process.cwd()) => {
  if (process.env.FORGE_CODEX_DISABLE === "1") return STOOD_DOWN;
  if (path === "-") return refusing(FILE_ROUTE("A body piped in on stdin"));
  if (path.startsWith("@")) return refusing(FILE_ROUTE(`\`${path}\``));
  const real = resolve(cwd, path);
  /* Raised, never swallowed: a stand-down here is a body the reader takes unjudged; `stat` first because `readFileSync` on a fifo does not return. */
  const file = statSync(real).isFile();
  /* These verbs write from any directory, so no stand-down: one `cd` would be the way past the rule. */
  const here = repoRoot(cwd);
  const root = here ?? repoRoot(real);
  if (!root) {
    return refusing(`${path} is in no git checkout, and neither is ${cwd}. The consult log is keyed `
      + "by repository, so there is nowhere to look this up and nowhere to run the consult that "
      + `would clear it.\n\nDo this: put the file in the checkout the change is for and run from `
      + `there. ${OFF}`);
  }
  const held = file ? locate(root, real) : null;
  if (!held) {
    return refusing(`${path} is not a regular file, so no consult can be shown it.\n\nDo this: `
      + `write the text to a file and name that. ${OFF}`);
  }
  const text = readFileSync(held.real, "utf8");
  const mine = consultsOf(logEntries(), root, held.rel);
  if (readWhole(mine, held.rel, digest(text))) return { refusal: null, text };
  return refusing(readIt(here, root, held.rel, whyNot(mine, held.rel)));
};

/** The body both verbs write: the judged bytes, or — only under the kill switch — the reader's own. */
export const bodyChecked = async (path, raise, cwd = process.cwd()) => {
  const { refusal, text } = readOrRefuse(path, cwd);
  if (refusal) raise(refusal);
  return text ?? bodyFrom(path);
};
