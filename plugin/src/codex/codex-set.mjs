/* Which files one consult is about, and which of them anything can be shown of. docs/cli/codex-the-consult.md. */
import { lstatSync } from "node:fs";
import { isAbsolute, join } from "node:path";

import { fail } from "../resolve/settings.mjs";
import { pathed } from "../hooks/shell-spans.mjs";
import { changedAgainst, ignoredIn, locate } from "./codex-api.mjs";

export const relsOf = (root, named) => named.map((one) => {
  const held = locate(root, one);
  if (!held) fail(`codex: ${one} is not a readable file, from ${root}.`);
  return held.rel;
});

/** Absent, and not merely unreadable: `lstat` rather than `stat`, so a dangling symbolic link is
 *  present, and only `ENOENT` answers yes, so an `EACCES` file is somebody's work and stays. */
export const absentFrom = (root, rel) => {
  try {
    lstatSync(isAbsolute(rel) ? rel : join(root, rel));
    return false;
  } catch (error) {
    return error.code === "ENOENT";
  }
};

/** One home for the question two readers ask: a diff git refused is not one that came back empty, and
 *  neither is one nobody asked for. `missing` covers a deletion and an unreadable file too, so `nothingToShow` — a heading handed over with none of the file under it — asks the disk about absence (ISS-703). */
export const noDiffIn = (diff) => !diff?.text && !diff?.error;

export const nothingToShow = (root, part) => absentFrom(root, part.rel) && noDiffIn(part.diff);

/** The parts anything can be shown of, what leaves with nothing, and the lines saying so. With no
 *  anchor no diff was collected, so absence alone cannot tell a phantom from a tracked deletion:
 *  HEAD is asked, and where it will not answer nothing is dropped and the line says so. */
export const shownOf = (root, parts, anchor) => {
  const absent = parts.filter((part) => nothingToShow(root, part)).map((part) => part.rel);
  const asked = absent.length && !anchor ? changedAgainst(root, "HEAD") : false;
  const empty = asked === null ? [] : (asked ? absent.filter((rel) => !asked.includes(rel)) : absent);
  const deleted = absent.filter((rel) => !empty.includes(rel));
  const said = [];
  if (empty.length) {
    said.push(`${empty.length} file(s) offered are absent from the tree and carry no diff`
      + `${anchor ? ` against ${anchor}` : ""}: ${empty.join(", ")}. Not reviewed, not recorded, and out `
      + "of this turn's record.");
  }
  if (deleted.length && asked === null) {
    said.push(`${deleted.length} file(s) offered are not in the tree and git would not say whether HEAD `
      + `holds them, so nothing was dropped: ${deleted.join(", ")}. Pass --diff, or name them.`);
  } else if (deleted.length) {
    said.push(`${deleted.length} file(s) offered are deleted from the tree and travel with no diff, this `
      + `consult having no base: ${deleted.join(", ")}. Pass --diff to send the deletion itself.`);
  }
  return { parts: empty.length ? parts.filter((part) => !empty.includes(part.rel)) : parts, empty, said };
};

/* Absent, then ignored, then unchanged as the remainder, so no path lands in no class; ignored is said
   apart, being real work. `gone` holds no deletion: `changedAgainst` names every one, so none is excluded. */
const classified = (root, left, base) => {
  const absent = left.filter((rel) => absentFrom(root, rel));
  const present = left.filter((rel) => !absent.includes(rel));
  const ignored = [...ignoredIn(root, present)];
  const unchanged = present.filter((rel) => !ignored.includes(rel));
  const said = [];
  if (absent.length) {
    said.push(`${absent.length} path(s) this turn's record held are absent from the tree and carry no diff `
      + `against ${base}: ${absent.join(", ")}. Out of the review, out of the log and out of the record, so `
      + "no later consult is offered them.");
  }
  if (ignored.length) {
    said.push(`${ignored.length} path(s) this turn's record held are ones git ignores, so no diff against `
      + `${base} names them and this review does not see them: ${ignored.join(", ")}. Review them anyway by `
      + `naming them: \`forge codex consult --diff ${ignored.map(pathed).join(" ")}\`.`);
  }
  if (unchanged.length) {
    said.push(`${unchanged.length} path(s) this turn's record held are not in the review set: `
      + `${unchanged.join(", ")}. The tree does not change them against ${base}.`);
  }
  return { gone: absent, said };
};

const TOUCHED = (many) => `${many} this turn touched`;

const recordSaid = (record, pattern) => (record.length
  ? [`${record.length} file(s) from this turn's record, which holds only what \`${pattern}\` matches — `
    + "anything else the tree has changed is outside this review. Pass --diff for the tree's own list."]
  : []);

/* A key is a subject named as a file is: a consult about four filings would otherwise review whatever else the turn touched, and `--diff` beside a key still wins. */
const keysSaid = (keys) => `${keys.join(", ")} named and no file, so no file is under review: the `
  + "reviewer reads those issues itself. Name a file, or pass --diff, to review a change beside them.";

const recheckSaid = (record) => [`${record.length} file(s) from this turn's record: a recheck answers `
  + "one consult's findings rather than reviewing a change, so the tree's own list does not decide its "
  + "set — name files to decide it yourself."];

const committedSaid = (record, pattern, base) => (record.length
  ? [`nothing differs from ${base}, so the ${record.length} file(s) this turn's record holds travel `
    + `instead. The record holds only what \`${pattern}\` matches, so a change just committed is reviewed `
    + `in part — \`--base ${base}~1\` reviews that commit whole.`]
  : []);

/** What the caller named, else — a recheck excepted, that being about findings — the checkout's change
 *  against the base, which wins whatever the turn record holds, a pattern-kept record having shown a
 *  reviewer a strict subset twice (ISS-703); else the record, nothing differing leaving no subset. */
export const reviewSet = ({ root, named, keys = [], base, namedBase, held, pattern, recheck }) => {
  if (named.length) return { rels: [...new Set(relsOf(root, named))], offered: TOUCHED, said: [], gone: [] };
  if (keys.length && !base) return { rels: [], offered: TOUCHED, said: [keysSaid(keys)], gone: [] };
  const record = [...new Set(held)];
  if (!base) return { rels: record, offered: TOUCHED, said: recordSaid(record, pattern), gone: [] };
  /* A recheck answers findings, and the tree winning here loses the file they are about the moment anything else is dirty — the round then refuses instead of ruling (ISS-703). */
  if (recheck && record.length) return { rels: record, offered: TOUCHED, said: recheckSaid(record), gone: [] };
  const changed = changedAgainst(root, base, base === namedBase);
  if (!changed) {
    fail(`codex: --base ${base} is no ref this checkout can read, so what changed against it is unknown. `
      + "Name the base, or name the files.");
  }
  const offered = (many) => `${many} that differ from ${base} now`;
  if (!changed.length) {
    return { rels: record, offered, said: committedSaid(record, pattern, base), gone: [] };
  }
  const { gone, said } = classified(root, record.filter((rel) => !changed.includes(rel)), base);
  return {
    rels: changed,
    offered,
    said: [`nothing named, so the ${changed.length} file(s) changed against ${base}: ${changed.join(", ")}.`, ...said],
    gone,
  };
};
