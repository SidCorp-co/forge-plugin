/* No commit gate reaches a plan or its criteria, so the verbs that write them ask. docs/cli/codex-the-consult.md. */
import { readFileSync, statSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

import { digest, locate } from "./codex-api.mjs";
import { answered, bodied, logEntries } from "./codex-log.mjs";
import { FAILED, NO_GATEWAY, STOOD_DOWN_REASON, consultState, gatewayFailed, passesUnread } from "./log/unavailable.mjs";
import { repoRoot } from "../git/repo-root.mjs";
import { typed } from "../hooks/shell-spans.mjs";
import { WRITE_READ_OWED } from "../ladder.mjs";
import { bodyItself, notAPath } from "../resolve/payload.mjs";
import { gateway } from "../resolve/machine/stores.mjs";
import { codexConsultAt } from "../resolve/settings.mjs";

const OFF = "`FORGE_CODEX_DISABLE=1` in front of this command stands the check down; it runs in this "
  + "process, so the prefix reaches it.";

const FILE_ROUTE = (what) =>
  `${what} cannot have been read: a consult is asked for a path, and there is no path here. Write it `
  + "to a file and name the file.";

/* The log's key, quoted, and the root where the caller is not standing in one. `here` is the caller's own root, already computed, and a second probe answers the same directory at another realpath. The owed sentence is the ladder's, which the rung's rounds print too, and it comes before the stand-down so a run reads that no rung buys this read away before it reads the way past it (ISS-1322, ISS-2303). */
const readIt = (here, root, rel, why) =>
  `${why}\n\nDo this: \`${here === root ? "" : `cd ${typed(root)} && `}echo "<the issue, and `
  + `what this claims to have verified in code>" | forge codex consult --send bodies ${typed(rel)}\`, `
  + `then re-send. ${WRITE_READ_OWED} ${OFF}`;

/* One file's half of `shortOfWhole`, borrowing its test rather than restating it: what is wanted here is the part itself, for the bytes it carried, and a diffs consult sent none of them. */
const carriedWhole = (entry, rel) => {
  if (entry.send !== "bodies") return null;
  const held = (entry.sent ?? []).find((one) => one.rel === rel);
  return bodied(held) ? held : null;
};

/* A stand-down carries its own name as the reason, so the comment the verb posts says who waived it (ISS-2932). */
const STOOD_DOWN = { refusal: null, text: null, unread: STOOD_DOWN_REASON };
/* The bytes ride along with the consult refusal: a caller whose own checks refuse this file spends no consult on it. */
const refusing = (refusal, text = null) => ({ refusal, text });

/* Where a row's name for a file lands: its rel under the root it ran in, or the absolute path `locate` records for a file outside that root. */
const landsAt = (one, file) => (isAbsolute(file) ? file : one.root ? join(one.root, file) : null);

/* The consults that named the file at this real path, each with its own name for it. The file is the key and the caller's directory no part of it, so a consult from a worktree, a sibling checkout or no checkout at all clears the write wherever it is made; the row's own name is what finds the body it carried (ISS-904). */
const readersOf = (entries, real) => answered(entries).flatMap((one) => {
  const rel = (one.files ?? []).find((file) => landsAt(one, file) === real);
  return rel ? [{ one, rel }] : [];
});

/* The newest consult that carried this file whole at these bytes and got no answer back. */
const failedWhole = (entries, real, sha) => entries.findLast((one) => {
  if (!gatewayFailed(one)) return false;
  const rel = (one.files ?? []).find((file) => landsAt(one, file) === real);
  return Boolean(rel) && carriedWhole(one, rel)?.sha === sha;
}) ?? null;

const ADVISORY = "`forge doctor --set codex.consult=advisory` is the project's way to let an unavailable "
  + "gateway hold nothing: the write then goes through and the issue is told no consult read the file.";

/* What the refusal says where the reason is the gateway rather than the agent: a run sent back to
   the consult that just failed learns nothing from the sentence it read before. */
const gatewaySaid = (rel, state, reason) => (state === FAILED
  ? `A consult was asked for ${rel} whole at these bytes and got nothing back: ${reason}. ${ADVISORY}`
  : `No consult can be asked for ${rel}: ${reason}. ${ADVISORY}`);

/* Any consult, not the latest: restored bytes are read bytes, which a hash says and a clock denies. */
const readWhole = (mine, sha) => mine.some(({ one, rel }) => carriedWhole(one, rel)?.sha === sha);

const whyNot = (mine, rel) => {
  const { one: last, rel: named } = mine.at(-1) ?? {};
  const of = last && (last.id ?? last.at);
  if (!last) return `No consult has read ${rel}, and the issue is about to take it as its own.`;
  if (last.send !== "bodies") return `Consult ${of} named ${rel} but sent its diff, not its text — a `
    + "reviewer told to fetch a file for itself may never have asked for it.";
  if (!carriedWhole(last, named)) return `Consult ${of} carried no whole body for ${rel}, so that much of `
    + "it is unread.";
  return `Consult ${of} read ${rel} whole, and its text has changed since.`;
};

/** The refusal owed before a file becomes an issue's plan or its criteria, and the bytes it judged. */
export const readOrRefuse = (path, cwd = process.cwd()) => {
  if (process.env.FORGE_CODEX_DISABLE === "1") return STOOD_DOWN;
  if (path === "-") return refusing(FILE_ROUTE("A body piped in on stdin"));
  if (path.startsWith("@")) return refusing(FILE_ROUTE(`\`${path}\``));
  if (bodyItself(path, cwd)) return refusing(notAPath(path, false));
  const real = resolve(cwd, path);
  /* Raised, never swallowed: a stand-down here is a body the reader takes unjudged; `stat` first because `readFileSync` on a fifo does not return. */
  const file = statSync(real).isFile();
  /* These verbs write from any directory, so no stand-down: one `cd` would be the way past the rule. */
  const here = repoRoot(cwd);
  const root = here ?? repoRoot(real);
  /* With no root to try first, `locate` names the file by its real path alone. */
  const held = file ? locate(root, real) : null;
  if (!held) {
    return refusing(`${path} is not a regular file, so no consult can be shown it.\n\nDo this: `
      + `write the text to a file and name that. ${OFF}`);
  }
  const text = readFileSync(held.real, "utf8");
  const entries = logEntries();
  const mine = readersOf(entries, held.real);
  const sha = digest(text);
  if (readWhole(mine, sha)) return { refusal: null, text };
  const configured = !gateway().problem;
  const failed = configured ? failedWhole(entries, held.real, sha) : null;
  const { state, reason } = consultState({ read: false, failed, gateway: configured });
  if (passesUnread(state, codexConsultAt(root ?? cwd).value)) return { refusal: null, text, unread: reason };
  const lead = state === FAILED || state === NO_GATEWAY ? `${gatewaySaid(held.rel, state, reason)}\n\n` : "";
  if (!root) {
    return refusing(`${lead}${whyNot(mine, held.rel)} ${path} is in no git checkout, and neither is ${cwd}, `
      + "and a consult runs in one.\n\nDo this: run the consult on this path from the checkout the "
      + `change is for, then re-send from anywhere. ${WRITE_READ_OWED} ${OFF}`, text);
  }
  return refusing(`${lead}${readIt(here, root, held.rel, whyNot(mine, held.rel))}`, text);
};
