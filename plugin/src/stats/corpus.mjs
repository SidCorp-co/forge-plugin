/* Where one project's run transcripts are, and every one of them read back — docs/cli/stats.md. */
import { readFileSync, readdirSync, realpathSync } from "node:fs";
import { basename, join } from "node:path";
import { homedir, tmpdir } from "node:os";

export const transcriptBase = () => join(tmpdir(), `claude-${process.getuid?.() ?? 0}`);

export const slugFor = (directory) => directory.replaceAll(/[^a-zA-Z0-9]/gu, "-");

/** Where one project's transcripts sit; the trailing separator is cut first, or one checkout named two ways answers as two corpora. The identity a reading is held under, so a mark written against a corpus goes on resolving whatever else this module learns to read. */
export const rootFor = (directory) => join(transcriptBase(), slugFor(directory.replace(/\/+$/u, "") || "/"));

/** Where the host keeps the transcripts themselves. Read at the call and never at load, so a home the caller sets reaches it. */
export const durableBase = () => join(homedir(), ".claude", "projects");

const OUTPUT = /^a\S*\.output$/u;
const AGENT = /^agent-\S*\.jsonl$/u;
const TASKS = "tasks";
const SUBAGENTS = "subagents";

const namesIn = (directory) => {
  try {
    return readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }
};

const filesUnder = (root, held, shape) =>
  namesIn(root)
    .filter((entry) => entry.isDirectory())
    .flatMap((session) => {
      const inside = join(root, session.name, held);
      return namesIn(inside)
        .filter((entry) => !entry.isDirectory() && shape.test(entry.name))
        .map((entry) => ({ session: session.name, path: join(inside, entry.name) }));
    });

/** Both places one project's runs are readable from, the durable store first so a run counted from there is named by the file that will still be there. Each is worked out from the one slug `rootFor` derived, so neither reaches this module from a caller. */
export const sourcesFor = (root) => [
  { path: join(durableBase(), basename(root)), temporary: false, held: SUBAGENTS, shape: AGENT },
  { path: root, temporary: true, held: TASKS, shape: OUTPUT },
];

/* The index entries are symlinks into the store, so the same transcript is under both roots and the resolved path is what says so: counted twice it would double every figure computed over the corpus. A path that cannot be resolved stands for itself rather than being dropped (ISS-1578). */
const canonical = (path) => {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
};

/** Every transcript of one project, each source's own count beside it — the count being what a reader needs to tell a swept index from a corpus that was never deeper. */
export const corpusUnder = (root) => {
  const seen = new Set();
  const transcripts = [];
  const sources = sourcesFor(root).map((source) => {
    const found = filesUnder(source.path, source.held, source.shape);
    const taken = found.filter((one) => {
      const key = canonical(one.path);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    transcripts.push(...taken);
    return { path: source.path, temporary: source.temporary, transcripts: found.length, taken: taken.length };
  });
  return { transcripts, sources };
};

export const readTranscript = (path) => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
};
