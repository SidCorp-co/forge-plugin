// cm:why core's judged-build weighs files, so any later commit touching a file the issue changed reads as a change to the issue, and on a project that deploys every push most issues could never be judged; this checkout's git weighs the lines instead (ISS-122, forge judge run 8555bf38)
import { spawnSync } from "node:child_process";

import { escaped } from "../markdown.mjs";

const git = (args, cwd) => {
  const run = spawnSync("git", args, { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  return run.status === 0 ? run.stdout : null;
};

const short = (sha) => sha.slice(0, 12);

const HEADER = /^([0-9a-f]{40,64}) \d+ (\d+)/u;
const HUNK = /^@@ -(\d+)(?:,\d+)? \+\d+(?:,\d+)? @@/u;

// cm:why an entry appended after the issue's last one adds a separator to the issue's own last line (`}` to `},`), which changes no content the issue made; only that and trailing space are set aside
const same = (one, other) => one.replace(/,?\s*$/u, "") === other.replace(/,?\s*$/u, "");

// cm:why core's `issue-ref.ts:textNamesIssueKey`: a commit is the issue's where its subject names the key as a whole token, the reading core's own served-over takes
const namesKey = (key) => new RegExp(`(?<![A-Za-z0-9-])${escaped(key)}(?![0-9])`, "iu");

// cm:why `linguist-generated` in .gitattributes is the mark hosts already read for a generated file, so a project marks one once for both and this plugin asks for no setting of its own; it is read at the served build, where the mark stands now
const generatedOf = (files, served, cwd) => {
  const out = git(["check-attr", "-z", `--source=${served}`, "linguist-generated", "--", ...files], cwd)
    ?? git(["check-attr", "-z", "linguist-generated", "--", ...files], cwd) ?? "";
  const parts = out.split("\0");
  const marked = new Set();
  for (let at = 0; at + 2 < parts.length; at += 3) if (["set", "true"].includes(parts[at + 2])) marked.add(parts[at]);
  return marked;
};

const ownLines = (file, head, commits, cwd) => {
  const out = git(["blame", "--porcelain", head, "--", file], cwd);
  if (out === null) return null;
  const own = new Map();
  let sha = null;
  let final = 0;
  for (const line of out.split("\n")) {
    const header = HEADER.exec(line);
    if (header) {
      sha = header[1];
      final = Number(header[2]);
    } else if (line.startsWith("\t") && commits.has(sha)) own.set(final, line.slice(1));
  }
  return own;
};

const hunksOf = (diff) => {
  const hunks = [];
  let hunk = null;
  for (const line of diff.split("\n")) {
    const opened = HUNK.exec(line);
    if (opened) hunks.push(hunk = { at: Number(opened[1]), removed: [], added: [] });
    else if (hunk && line.startsWith("-")) hunk.removed.push({ at: hunk.at + hunk.removed.length, text: line.slice(1) });
    else if (hunk && line.startsWith("+")) hunk.added.push(line.slice(1));
  }
  return hunks;
};

const changedOwn = (hunks, own) => hunks.flatMap((hunk) => hunk.removed
  .filter((line) => own.get(line.at) === line.text && !hunk.added.some((added) => same(added, line.text)))
  .map((line) => line.text));

const DIFF = ["--no-color", "--no-ext-diff", "--no-renames", "-U0"];

const changedBy = (file, head, served, texts, cwd) => {
  const later = (git(["rev-list", `${head}..${served}`, "--", file], cwd) ?? "").split("\n").filter(Boolean);
  const named = later.filter((commit) => hunksOf(git(["diff-tree", "-p", "-m", "--first-parent", "--no-commit-id", ...DIFF, commit, "--", file], cwd) ?? "")
    .some((hunk) => hunk.removed.some((line) => texts.some((text) => same(text, line.text)))));
  return (named.length ? named : later).reverse().map(short);
};

const fileReading = (file, { head, served, commits, cwd }) => {
  const own = ownLines(file, head, commits, cwd);
  if (!own) return { file, unread: `git blame cannot read ${file} at ${short(head)}` };
  const diff = git(["diff", ...DIFF, head, served, "--", file], cwd);
  if (diff === null || /^Binary files /mu.test(diff)) return { file, unread: `git cannot compare ${file}'s lines` };
  const texts = changedOwn(hunksOf(diff), own);
  return texts.length ? { file, commits: changedBy(file, head, served, texts, cwd) } : { file };
};

const missing = (shas, cwd) => shas.find((sha) => git(["cat-file", "-e", `${sha}^{commit}`], cwd) === null);

// cm:why where the lines cannot be read here — no checkout, a build this checkout lacks, an issue no commit subject names — the reading is `unread` and the brief stops on core's file reading, as it did before, never guessing a pass
const linesCarried = (key, head, served, files, cwd) => {
  if (!files.length) return { unread: "core named none of the files the added commits change" };
  if (git(["rev-parse", "--show-toplevel"], cwd) === null) return { unread: "this directory is in no git checkout" };
  const lacking = missing([head, served], cwd);
  if (lacking) return { unread: `${short(lacking)} is not in this checkout; fetch it, or brief from one that holds it` };
  if (git(["merge-base", "--is-ancestor", head, served], cwd) === null) return { unread: `${short(served)} does not descend from ${short(head)} here` };
  const generated = generatedOf(files, served, cwd);
  const weighed = files.filter((file) => !generated.has(file));
  const pattern = namesKey(key);
  const log = weighed.length ? git(["log", "--format=%H%x09%s", head, "--", ...weighed], cwd) ?? "" : "";
  const commits = new Set(log.split("\n").filter((line) => pattern.test(line.split("\t").slice(1).join("\t"))).map((line) => line.split("\t")[0]));
  if (weighed.length && !commits.size) return { unread: `no commit before ${short(head)} that changes ${weighed.join(", ")} names ${key} in its subject` };
  const read = weighed.map((file) => fileReading(file, { head, served, commits, cwd }));
  const changed = read.filter((one) => one.commits);
  if (changed.length) return { changed: changed.map(({ file, commits: by }) => ({ file, commits: by })) };
  const unread = read.find((one) => one.unread);
  if (unread) return { unread: unread.unread };
  return { kept: { generated: files.filter((file) => generated.has(file)), weighed } };
};

// cm:why only core's `touched` reading is weighed again: `not-descendant` and `unread` are core's readings of descent and of what it kept, which the lines of one checkout do not answer
export const withLines = (judged, key, cwd) => {
  const served = judged?.served;
  if (!served?.sha || !judged.sha || served.carries !== "touched" || !key) return judged;
  return { ...judged, served: { ...served, lines: linesCarried(key, judged.sha, served.sha, served.touched ?? [], cwd) } };
};
