/* A box's install record says which copies are on it, never which is current, so a machine nobody updated agrees with itself (ISS-1324). A release states its version on the remote as a tag, the one thing a second machine reads with no fetch; unpublished, it is a release every box is blind to. What a box reads there is the version and never the commit under it, so a tag already carrying this version states the right thing wherever it points, and nothing here moves one it did not write. */
import { join } from "node:path";

import { git, read, REMOTE, stop } from "../../checkout.mjs";

export const tagOf = (version) => `v${version}`;

export const versionIn = (tree) => read(join(tree, "package.json"))?.version ?? null;

const firstLine = (text) => String(text ?? "").trim().split("\n")[0] || "no output";

const shortly = (sha) => String(sha).slice(0, 7);

const statedAt = (tree, tag) => {
  const run = git(["ls-remote", REMOTE, `refs/tags/${tag}`], tree);
  if (run.status !== 0) return { problem: firstLine(run.stderr) };
  return { sha: String(run.stdout).trim().split(/\s+/u)[0] ?? "" };
};

export const publishesVersion = (tree, commit, version, resume) => {
  if (!version || !commit) return console.log("  this tree names no version to publish");
  const tag = tagOf(version);
  const { sha, problem } = statedAt(tree, tag);
  if (!problem && sha === commit) return console.log(`  ${REMOTE} already states ${version}, at ${shortly(commit)}`);
  if (!problem && sha) {
    return console.log(`  ${REMOTE} states ${version} at ${shortly(sha)}, which this release is not: `
      + `the version a box reads off it is still this one, and no tag is moved here`);
  }
  const run = git(["push", REMOTE, `${commit}:refs/tags/${tag}`], tree);
  if (run.status === 0) return console.log(`  ${REMOTE} carries ${tag} at ${shortly(commit)}`);
  return stop(`the branch is pushed and ${tag} is not: ${firstLine(run.stderr)}\nNothing is rolled `
    + `back, the release being on the branch already — but until that tag is there every box asking `
    + `${REMOTE} for the newest released version reads an older one, which is the blindness this `
    + `publication exists to remove. ${resume}`);
};

/** Asked again at the end, because a resume aimed past the push step skips the publication. */
export const statesVersion = (tree, commit, version, resume) => {
  if (!version || !commit) return console.log("  this tree names no version, so none was published");
  const tag = tagOf(version);
  const { sha, problem } = statedAt(tree, tag);
  if (problem) return console.log(`  ${REMOTE} could not be asked whether it states ${version}: ${problem}`);
  if (sha) return console.log(`  ${REMOTE} states ${version} released, at ${shortly(sha)}`);
  return stop(`${REMOTE} states no ${version}, so this release states no version at all and every box `
    + `asking for the newest released one reads an older one. ${resume}`);
};
