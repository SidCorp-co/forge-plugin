#!/usr/bin/env node
// List the files a change can reach that the change did not touch — the readers a diff-driven
// grep misses, because they mention nothing the diff renamed. Logic in ../src/blast-radius.mjs.

import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { diffIdentifiers, rank } from "../src/blast-radius.mjs";

const MAX_BYTES = 512 * 1024;

function git(root, args) {
  const run = spawnSync("git", ["-C", root, ...args], { encoding: "utf8", maxBuffer: 1 << 28 });
  if (run.status !== 0) throw new Error((run.stderr || run.stdout || "git failed").trim());
  return run.stdout;
}

/** The branch point, so the reading covers the whole change rather than the last commit of it. */
function baseFor(root, ref) {
  const candidates = ref ? [ref] : ["origin/HEAD", "origin/master", "origin/main", "master", "main"];
  for (const candidate of candidates) {
    try {
      const merge = git(root, ["merge-base", "HEAD", candidate]).trim();
      if (merge) return { base: merge, named: candidate };
    } catch {
      /* try the next one; a repo need not have any of them */
    }
  }
  return null;
}

/** Tracked text files, read once: a binary or a huge blob is tokenized to nothing useful. */
function tree(root) {
  const out = [];
  for (const path of git(root, ["ls-files", "-z"]).split("\0").filter(Boolean)) {
    const full = join(root, path);
    try {
      if (statSync(full).size > MAX_BYTES) continue;
      const text = readFileSync(full, "utf8");
      if (text.includes("\0")) continue;
      out.push([path, text]);
    } catch {
      /* deleted, a symlink, or not this process's to read */
    }
  }
  return out;
}

const USAGE = `List the files a change can reach that the change did not touch.

  blast-radius.mjs [--since <git-ref>] [--top N] [--repo DIR]

A grep for what the diff renamed finds the renamed thing. It finds nothing when every identifier
stays and only their PROVENANCE moved — a value the client used to send that the server now
assigns — because the code that reads the value on the old convention mentions no line of the
diff. So the identifiers the diff USES are looked up across the tracked tree, and a file sharing
several of the narrow ones while sitting outside the diff is reported as a reader to go and read.

Which identifiers are too common to localize anything is measured from the tree, not listed here.

Exit 0 whether or not anything is listed: these are files to read, not defects. Exit 2 on a bad
invocation, or a tree git will not answer for.`;

function main(argv) {
  let ref = null;
  let top = 15;
  let root = process.cwd();
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "-h" || argv[i] === "--help") {
      process.stdout.write(`${USAGE}\n`);
      return 0;
    } else if (argv[i] === "--since") ref = argv[++i];
    else if (argv[i] === "--top") top = Number(argv[++i]);
    else if (argv[i] === "--repo") root = argv[++i];
    else {
      process.stderr.write(`unknown argument: ${argv[i]}\n\n${USAGE}\n`);
      return 2;
    }
  }
  if (!Number.isInteger(top) || top < 1) {
    process.stderr.write(`--top wants a positive integer\n`);
    return 2;
  }

  let found;
  try {
    found = baseFor(root, ref);
    if (!found) {
      process.stderr.write(`no base to compare against — name one with --since\n`);
      return 2;
    }
    const { base, named } = found;
    const touched = new Set(git(root, ["diff", "--name-only", base]).split("\n").filter(Boolean));
    if (touched.size === 0) {
      process.stdout.write(`no change against ${named} (${base.slice(0, 7)}) — nothing to reach\n`);
      return 0;
    }
    const wanted = diffIdentifiers(git(root, ["diff", "-U0", base]));
    const { cutoff, reachable } = rank({ files: tree(root), touched, wanted });

    process.stdout.write(
      `${touched.size} file(s) changed against ${named} (${base.slice(0, 7)}); ` +
        `an identifier in more than ${cutoff} files is too common to point anywhere\n`,
    );
    if (reachable.length === 0) {
      process.stdout.write("nothing outside the diff shares a narrow identifier with it\n");
      return 0;
    }
    for (const hit of reachable.slice(0, top)) {
      process.stdout.write(`${String(hit.score).padStart(3)}  ${hit.path}\n`);
      process.stdout.write(`     ${hit.shared.slice(0, 8).join(" ")}\n`);
    }
    if (reachable.length > top) {
      process.stdout.write(`\n… ${reachable.length - top} more, --top to see them\n`);
    }
    process.stdout.write(
      "\nThese are not findings. Read the top of the list and say, for each, whether the change " +
        "alters what it reads — a green suite says nothing about a file nothing covers.\n",
    );
    return 0;
  } catch (error) {
    process.stderr.write(`${String(error.message ?? error)}\n`);
    return 2;
  }
}

process.exit(main(process.argv.slice(2)));
