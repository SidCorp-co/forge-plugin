/* Which copies are installed is a fact about one box, so a box nobody has updated agrees with itself and reads green — sixteen filings over three days against defects already released (ISS-1324). The newest released version is therefore asked of the remote a release publishes to, never of anything on this machine, and every way that ask can fail is said by name: an unknown that reads as agreement is the defect, not a quieter version of it. docs/cli/doctor.md. */
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { readJson } from "../../resolve/config.mjs";
import { hereCopy, pluginCopy } from "../plugin-copy.mjs";

const LABEL = "newest release";
const REMOTE = "origin";
/* Long enough for a round trip to a git host on a slow link, short enough that a report nobody is
   waiting on cannot hold up the phase that runs it. */
export const MS = 5000;

const OWN = new URL("../../../.claude-plugin/plugin.json", import.meta.url);

const note = (detail) => [{ level: "note", label: LABEL, detail }];
const said = (detail) => [{ level: "ok", label: LABEL, detail }];

const triple = (text) => {
  const held = /^v?(\d+)\.(\d+)\.(\d+)$/u.exec(String(text).trim());
  return held ? [Number(held[1]), Number(held[2]), Number(held[3])] : null;
};

const above = (one, two) => {
  const at = one.findIndex((part, index) => part !== two[index]);
  return at !== -1 && one[at] > two[at];
};

/** The directory this plugin's marketplace is registered from, and the version that directory holds:
 *  a registration is what `claude plugin install` reads, so it is the tree an update would copy. */
export const registeredSource = (home) => {
  const name = readJson(OWN)?.name;
  const known = readJson(join(home, ".claude", "plugins", "known_marketplaces.json"));
  if (!name || !known || typeof known !== "object") return null;
  for (const [market, held] of Object.entries(known)) {
    const at = held?.installLocation ?? held?.source?.path;
    if (typeof at !== "string") continue;
    const ships = readJson(join(at, ".claude-plugin", "marketplace.json"))?.plugins;
    const mine = Array.isArray(ships) ? ships.find((one) => one?.name === name) : null;
    if (!mine || typeof mine.source !== "string") continue;
    const tree = resolve(at, mine.source);
    return { market, name, at, tree, version: readJson(join(tree, ".claude-plugin", "plugin.json"))?.version ?? null };
  }
  return null;
};

/* Named and never git's own default, which is the branch's upstream and can be a second remote whose tags are older: a release publishes to origin, so a row agreeing with anything else agrees wrongly. And no terminal prompt and no ssh that can ask for anything — a blocked prompt is a phase that never starts, and a report is no place to discover a box's credential has expired. */
const asked = (at, ms) => spawnSync("git", ["ls-remote", "--tags", REMOTE], {
  cwd: at,
  encoding: "utf8",
  timeout: ms,
  env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_SSH_COMMAND: "ssh -oBatchMode=yes" },
});

const firstLine = (text) => String(text ?? "").trim().split("\n")[0] || "no output";

export const releasedVersions = (at, ms = MS) => {
  const run = asked(at, ms);
  if (run.error?.code === "ETIMEDOUT") return { problem: `the remote did not answer inside ${ms / 1000}s` };
  if (run.error) return { problem: `git could not be run: ${run.error.message}` };
  if (run.status !== 0) return { problem: `git ls-remote origin exited ${run.status}: ${firstLine(run.stderr)}` };
  const held = [...String(run.stdout).matchAll(/refs\/tags\/(\S+?)(?:\^\{\})?$/gmu)]
    .map((one) => triple(one[1]))
    .filter(Boolean);
  /* An annotated tag answers twice, itself and its peeled commit, and both name one release. */
  const once = [...new Map(held.map((one) => [one.join("."), one])).values()];
  if (!once.length) return { problem: "the remote carries no version tag" };
  return { versions: once.sort((one, two) => (above(one, two) ? 1 : -1)) };
};

/* Counting tags and never releases: every release before this one published nothing to count, so a
   copy older than the oldest tag is told that rather than given a number this cannot know. */
const behindBy = (versions, mine) => {
  const newer = versions.filter((one) => above(one, mine));
  return newer.length === versions.length
    ? "every tagged release is newer than it, and the releases made before tagging began are not counted"
    : `${newer.length} tagged release(s) newer than it`;
};

/* Two steps and both named, because updating from a directory that is itself behind reinstalls the
   copy already running — the same blindness one row up, and the reason this row exists. */
const wayOut = (source, released) => {
  const update = `\`claude plugin update ${source.name}@${source.market}\` then restart the session`;
  return triple(source.version) && above(released, triple(source.version))
    ? `${source.at} holds ${source.version} and has to reach ${released.join(".")} first, then ${update}`
    : update;
};

/** What the newest released version is, against what is running here, or which step could not say. */
export const releaseRows = ({ home = homedir(), running = hereCopy().version, ms = MS } = {}) => {
  const source = registeredSource(home);
  if (!source) {
    return note("not read: no marketplace registration on this box names a directory this plugin is "
      + "installed from, so nothing here can say whether the copy running is the current one");
  }
  const mine = triple(running);
  if (!mine) return note(`not read: the running copy states no version, so there is nothing to compare  ← ${source.at}`);
  const { versions, problem } = releasedVersions(source.tree, ms);
  if (problem) {
    return note(`not read: ${problem}  ← git ls-remote ${REMOTE} in ${source.tree} — this box cannot tell `
      + "whether the copy it runs is current, which is not the same as it being current");
  }
  const newest = versions.at(-1);
  const where = `← git ls-remote ${REMOTE} in ${source.tree}`;
  if (newest.join(".") === mine.join(".")) {
    return said(`${newest.join(".")} — the newest released version, and the one running  ${where}`);
  }
  if (!above(newest, mine)) {
    return said(`${running} running, ${newest.join(".")} the newest released — this copy is ahead of `
      + `every release, which a tree mid-change is  ${where}`);
  }
  return note(`${running} running, ${newest.join(".")} released — ${behindBy(versions, mine)}. `
    + `${wayOut(source, newest)}  ${where}`);
};

/* Two readings of one subject, in the order they go wrong: a session that has not restarted since the last install, then a box on which nothing installed is current. */
const hereRow = (copy) => (copy.stale
  ? { level: "note", label: "plugin copy", detail: `${copy.running} here, ${copy.installed} installed — a `
    + "session keeps the registration it started with: `claude plugin update` then restart" }
  : { level: "ok", label: "plugin copy", detail: `${copy.running} — running and installed` });

export const copyRows = (asked = {}) => {
  const copy = pluginCopy();
  return [...(copy ? [hereRow(copy)] : []), ...releaseRows(asked)];
};
