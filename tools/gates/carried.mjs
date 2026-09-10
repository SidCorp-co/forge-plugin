/* The gate's record, carried across the version commit. Every step's digest is keyed on the manifests,
   so a release left the shared record unreadable at the head every branch is cut from — 954s re-proving
   master's own content (ISS-939). Read before that commit, re-keyed after, and no wider. */
import { existsSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import { gitFiles } from "../checkout.mjs";
import { contentOf, digestFile, forgetContent, ledgerFor, recordPass } from "./ledger.mjs";
import { gateSteps, TEST_FILE } from "./steps.mjs";

/* The gate's own entry point, whose module graph is part of every digest: this has to name the file
   `tools/gates.mjs` passes as its own, or these digests key on another derivation and match none. */
const RUNNER = ["tools", "gates.mjs"];

/* Where a release writes a version and nowhere else, by path: the manifest's own field, and in a lock
   file the root package's second copy. One locator, read for the agreement and removed for the
   comparison, so no field can be excused by one half of the guard and unread by the other. */
const LOCK = "package-lock.json";
const locationsIn = (one) => basename(one) === LOCK ? [["version"], ["packages", "", "version"]] : [["version"]];

const held = (found, key) => (found !== null && typeof found === "object" ? found[key] ?? null : null);

const without = (found, [key, ...deeper]) => {
  if (deeper.length === 0) {
    const rest = { ...found };
    delete rest[key];
    return rest;
  }
  return held(found, key) === null ? found : { ...found, [key]: without(found[key], deeper) };
};

const besideVersion = (root, one) => {
  try {
    return digestFile(join(root, one),
      (text) => JSON.stringify(locationsIn(one).reduce((found, path) => without(found, path), JSON.parse(text))));
  } catch {
    return null;
  }
};

const releaseVersions = (root, one) => {
  try {
    const found = JSON.parse(readFileSync(join(root, one), "utf8"));
    return locationsIn(one).map((path) => path.reduce(held, found));
  } catch {
    return null;
  }
};

const manifestsIn = (root, wrote) => wrote.filter((one) => existsSync(join(root, one)));

const ledgerAt = (root, files) => ledgerFor(gateSteps(files.filter((one) => TEST_FILE.test(one))),
  { root, files, runner: resolve(root, ...RUNNER) });

/** What the record holds green at the content on disk now, and that content's own digests beside it.
 *  Taken before the commit: after it, the digests these matched are gone. */
export const passesHeld = (root, wrote) => {
  forgetContent();
  const files = gitFiles(root);
  return {
    content: contentOf(root, files),
    beside: new Map(manifestsIn(root, wrote).map((one) => [one, besideVersion(root, one)])),
    kept: ledgerAt(root, files).entries.filter((step) => step.green)
      .map((step) => ({ label: step.label, seconds: step.took })),
  };
};

/** A fresh reading of the whole step table at the content on disk now: how many steps the record holds green, out of how many there are. Read after the carry, so it answers for the commit a release pushed and not for the tree the gate itself was scoped over. Its own read and not `carryPasses`'s count, which is over the entries that run selected for carrying. */
export const greenHeld = (root) => {
  forgetContent();
  const { entries } = ledgerAt(root, gitFiles(root));
  return { green: entries.filter((step) => step.green).length, of: entries.length };
};

const movedBetween = (held, now) => [...new Set([...held.keys(), ...now.keys()])]
  .filter((one) => held.get(one) !== now.get(one)).sort();

const disagreeing = (named) => named
  .map(([one, found]) => `${one} at ${found.join(" and ")}`).join(", ");

const unauthorized = (root, moved, held, wrote) => {
  const stranger = moved.find((one) => !wrote.includes(one));
  if (stranger) return `${stranger} moved since the gate read this tree, and a release writes only ${wrote.join(", ")}`;
  const more = moved.find((one) => held.beside.get(one) === null || besideVersion(root, one) !== held.beside.get(one));
  if (more) return `${more} moved in more than the version a release writes`;
  const named = manifestsIn(root, wrote).map((one) => [one, releaseVersions(root, one)]);
  const bare = named.find(([, found]) => found === null || found.some((one) => typeof one !== "string"));
  if (bare) return `${bare[0]} holds no version string where a release writes one`;
  return new Set(named.flatMap(([, found]) => found)).size > 1
    ? `this commit left ${disagreeing(named)}, and a release writes one version into every file it writes`
    : null;
};

/** Those same passes re-keyed onto the content on disk now, or the one line saying why none was. */
export const carryPasses = (root, held, wrote) => {
  forgetContent();
  const files = gitFiles(root);
  const why = unauthorized(root, movedBetween(held.content, contentOf(root, files)), held, wrote);
  if (why) return `no pass was carried: ${why}. The next gate spends every step that reads it`;
  if (held.kept.length === 0) return `the record held no pass at the content the gate judged, so there was none to carry`;
  const { dir, entries } = ledgerAt(root, files);
  const seconds = new Map(held.kept.map((one) => [one.label, one.seconds]));
  const carried = entries.filter((step) => seconds.has(step.label));
  for (const step of carried) recordPass(dir, step, seconds.get(step.label));
  return `${carried.length} of ${entries.length} gate step(s) carried onto this content, so a worktree `
    + `cut from this head spends none of them — ${dir}`;
};

/** The bump, with the record read before it and re-keyed after. Both halves report and neither
 *  refuses: a record this cannot read is not a release this may stop. */
export const acrossVersion = (tree, wrote, bump, say = console.log) => {
  let green = null;
  try {
    green = passesHeld(tree, wrote);
  } catch (error) {
    say(`  what the gate's record holds could not be read, so this release carries none of it: ${error.message}`);
  }
  const made = bump();
  if (!green) return made;
  try {
    say(`  ${carryPasses(tree, green, wrote)}`);
  } catch (error) {
    say(`  the gate's record could not be carried onto this release: ${error.message}`);
  }
  return made;
};
