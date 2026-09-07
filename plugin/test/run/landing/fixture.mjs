/* The world a landing runs in: a bare origin, a checkout of it, a branch a build pushed, a `claude`
   whose install record can be read back, and a tracker that keeps what is written to it. In process
   rather than through the script, because half of these cases are a death in the middle of a
   landing and what a second run resumes from is the checkpoint — which has to be written first. */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { fakeTracker, tempRoom } from "../../fixtures.mjs";

export const LANDER = "the-lander-run";
export const BUILDER = "the-builder-run";
export const KEY = "ISS-673";
export const UUID = "landing-uuid";
export const NEXT_KEY = "ISS-674";
export const NEXT_UUID = "landing-uuid-two";
export const BASE = "master";
export const BRANCH = "iss-673";
export const NEXT_BRANCH = "iss-674";
/** The second branch's own file, so the two land without meeting. */
export const NEXT_OWNED = join("docs", "two.md");
export const MARKET = "scratch-local";
export const PLUGIN = "scratch";
/** The change's own file, ten lines, so a base commit can move a line the branch did not touch. */
export const OWNED = join("plugin", "src", "one.mjs");
const TEN = Array.from({ length: 10 }, (_, at) => `line ${at + 1}\n`).join("");

/* Whatever the developer's own HOME holds, and read at the module's load: `plugin-copy.mjs` fixes
   the install record's path when it is imported, so every case here shares one record and resets it. */
const ROOM = tempRoom("land-ready-room-");
const BIN = join(ROOM, "bin");
export const RECORD = join(ROOM, ".claude", "plugins", "installed_plugins.json");

/* The landing's lock, tried for by something that is not the landing: `run-lock.test.mjs` already
   holds `ship` and `land` to waiting on it, so what is owed here is that the span really is the
   pin through the install — which is read from inside the gate and from inside the install. */
const LOCK = new URL("../../../../tools/run/lock.mjs", import.meta.url).href;
export const PROBE_SAID = join(ROOM, "probe-said.txt");
const PROBE = `import { appendFileSync } from "node:fs";
import { shipHolder, takeShipLock } from ${JSON.stringify(LOCK)};
const [tree, said] = process.argv.slice(2);
try {
  const drop = await takeShipLock(tree, shipHolder(tree), { ms: 200 });
  drop();
  appendFileSync(said, "took it\\n");
} catch (error) {
  appendFileSync(said, \`waited: \${error.message.split("\\n")[0]}\\n\`);
}
`;
export const PROBE_GATE = `node tools/probe.mjs . ${PROBE_SAID}`;
export const probeSaid = () =>
  (existsSync(PROBE_SAID) ? readFileSync(PROBE_SAID, "utf8") : "").split("\n").filter(Boolean);
export const forgetProbe = () => rmSync(PROBE_SAID, { force: true });
/** The same probe from inside the install, which is the far end of the span the lock is held over. */
export const probeInInstall = (tree) => writeFileSync(join(ROOM, "probe-tree"), `${tree}\n`);
export const probeOnce = (tree) => {
  spawnSync(process.execPath, [join(tree, "tools", "probe.mjs"), tree, PROBE_SAID], { encoding: "utf8" });
  return probeSaid().at(-1);
};

const CLAUDE = `#!/usr/bin/env node
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
const room = ${JSON.stringify(ROOM)};
const argv = process.argv.slice(2);
appendFileSync(join(room, "claude-calls.json"), JSON.stringify(argv) + "\\n");
const asked = join(room, "probe-tree");
if (existsSync(asked)) {
  const tree = readFileSync(asked, "utf8").trim();
  spawnSync(process.execPath, [join(tree, "tools", "probe.mjs"), tree, ${JSON.stringify(PROBE_SAID)}]);
}
const at = join(room, "marketplace-source");
if (argv[1] === "marketplace" && argv[2] === "add") {
  writeFileSync(at, argv[3] + "\\n");
  process.exit(0);
}
const source = existsSync(at) ? readFileSync(at, "utf8").trim() : null;
if (!source) {
  process.stderr.write("no marketplace is registered here\\n");
  process.exit(1);
}
if (argv[1] === "update") {
  const [name, market] = argv[2].split("@");
  const manifest = JSON.parse(readFileSync(join(source, "plugin", ".claude-plugin", "plugin.json"), "utf8"));
  const dir = join(room, ".claude", "plugins", "cache", market, name, manifest.version);
  mkdirSync(dirname(dir), { recursive: true });
  cpSync(join(source, "plugin"), dir, { recursive: true });
  const record = join(room, ".claude", "plugins", "installed_plugins.json");
  const held = existsSync(record) ? JSON.parse(readFileSync(record, "utf8")) : { version: 2, plugins: {} };
  held.plugins[argv[2]] = [...(held.plugins[argv[2]] ?? []),
    { scope: "user", installPath: dir, version: manifest.version, lastUpdated: new Date().toISOString() }];
  mkdirSync(dirname(record), { recursive: true });
  writeFileSync(record, JSON.stringify(held, null, 2));
}
process.exit(0);
`;

mkdirSync(BIN, { recursive: true });
writeFileSync(join(BIN, "claude"), CLAUDE, { mode: 0o755 });
process.env.HOME = ROOM;
process.env.PATH = `${BIN}:${process.env.PATH}`;
process.env.FORGE_SESSION_ID = LANDER;
process.env.AI_AGENT = "a-test-agent";
process.env.CLAUDE_PID = "4242";

export const claudeCalls = () => {
  const path = join(ROOM, "claude-calls.json");
  return (existsSync(path) ? readFileSync(path, "utf8") : "").split("\n").filter(Boolean).map((one) => JSON.parse(one));
};

/** The record the install writes, dropped: what a resume finds where the install never ran. */
export const forgetInstall = () => rmSync(join(ROOM, ".claude"), { recursive: true, force: true });

/** A record another install left behind, at whatever version, so an older one can be refused. */
export const installedAt = (version) => {
  mkdirSync(dirname(RECORD), { recursive: true });
  writeFileSync(RECORD, JSON.stringify({
    version: 2,
    plugins: { [`${PLUGIN}@${MARKET}`]: [{ scope: "user", installPath: join(ROOM, "elsewhere"), version, lastUpdated: new Date().toISOString() }] },
  }, null, 2));
};

const posted = (held, body) => {
  held.push({ documentId: `c-${held.length + 1}`, createdAt: new Date().toISOString(), authorId: "agent", body });
  return { documentId: `c-${held.length}` };
};

export const state = {
  config: { baseBranch: BASE, productionBranch: BASE, pipelineConfig: { autoProdDeploy: false } },
  issues: [],
  comments: {},
  calls: [],
  answer: {
    forge_config: () => ({ config: state.config }),
    forge_issues: (args) => {
      if (args.action === "list") return { issues: state.issues, returned: state.issues.length, hasMore: false };
      /* A mark names its issue in the payload rather than as the call's subject, so both are read. */
      const named = args.documentId ?? args.data?.issueId;
      const at = state.issues.findIndex((one) => one.documentId === named);
      const which = at < 0 ? 0 : at;
      if (args.action === "update" || args.action === "transition") {
        state.issues[which] = { ...state.issues[which], ...(args.data ?? {}) };
      }
      /* The tracker's own doing, stood in for: a mark is read back off the comment page. */
      if (args.action === "mark_merged") {
        posted(state.comments[state.issues[which].documentId], `mark_merged ${args.data.note}`);
      }
      return state.issues[which];
    },
    forge_comments: (args) => {
      const held = state.comments[args.filters?.issue ?? args.data?.issue] ?? [];
      if (args.action === "list") return { comments: held, returned: held.length, hasMore: false };
      return posted(held, args.data.body);
    },
  },
};

export const tracker = await fakeTracker(state);
Object.assign(process.env, tracker.env);

const row = (documentId, issueId, status, landing, lease, owned) => ({
  documentId,
  issueId,
  status,
  title: "one flow: the landing",
  description: "a body.\n\nSize: feature.\n",
  plan: `Screen change: no\nSchema coupling: no\nUser-facing outcome: no\n\nIt edits ${owned}.\n\n1. it lands\n`,
  sessionContext: { ...(landing ? { landing } : {}), ...(lease ? { lease } : {}) },
});

/** The issues a case runs against, their checkpoints, and nothing recorded against either. */
export const seeded = ({ landing = null, status = "in_progress", lease = null, next = null } = {}) => {
  state.issues = [row(UUID, KEY, status, landing, lease, OWNED)];
  if (next) state.issues.push(row(NEXT_UUID, NEXT_KEY, status, next, null, NEXT_OWNED));
  state.comments = { [UUID]: [], [NEXT_UUID]: [] };
  state.calls = [];
};

export const issue = (documentId = UUID) => state.issues.find((one) => one.documentId === documentId);
export const context = (documentId = UUID) => issue(documentId)?.sessionContext ?? null;
export const comments = (documentId = UUID) => state.comments[documentId];
export const marks = (documentId = UUID) =>
  state.comments[documentId].filter((one) => one.body.startsWith("mark_merged"));

export const git = (room, ...args) =>
  spawnSync("git", ["-C", room, "-c", "user.email=t@t", "-c", "user.name=t", ...args], { encoding: "utf8" });

export const sha = (room, rev) => git(room, "rev-parse", rev).stdout.trim();

const written = (room, path, text) => {
  mkdirSync(join(room, dirname(path)), { recursive: true });
  writeFileSync(join(room, path), text);
};

const SYNC = `import { readFileSync, writeFileSync } from "node:fs";
const at = "plugin/.claude-plugin/plugin.json";
const held = JSON.parse(readFileSync(at, "utf8"));
writeFileSync(at, JSON.stringify({ ...held, version: JSON.parse(readFileSync("package.json", "utf8")).version }, null, 2));
`;

const PACKAGE = {
  name: "scratch",
  version: "1.0.0",
  type: "module",
  scripts: { check: "node -e \"console.log('the scratch gate ran')\"", version: "node tools/sync.mjs" },
};

/** A checkout of a bare origin, the change on a branch both hold, and the base wherever `base`
 *  puts it. The gate is a script here; the version lifecycle is a real one. */
export const world = ({ base = "still", gate = PACKAGE.scripts.check, second = false } = {}) => {
  const at = tempRoom("land-ready-");
  const work = join(at, "checkout");
  git(at, "init", "--bare", "origin.git");
  mkdirSync(work, { recursive: true });
  git(work, "init", "-b", BASE);
  /* In the repository's own config, not on each command line: the version commit is `git commit`
     inside a worktree of this one, and a worktree reads the repository's identity. */
  git(work, "config", "user.email", "t@t");
  git(work, "config", "user.name", "t");
  written(work, "package.json", JSON.stringify({ ...PACKAGE, scripts: { ...PACKAGE.scripts, check: gate } }, null, 2));
  written(work, ".forge.json", JSON.stringify({ slug: "forge-plugin" }));
  written(work, join("tools", "sync.mjs"), SYNC);
  written(work, join("tools", "probe.mjs"), PROBE);
  written(work, join("plugin", ".claude-plugin", "plugin.json"), JSON.stringify({ name: PLUGIN, version: "1.0.0" }, null, 2));
  written(work, join(".claude-plugin", "marketplace.json"),
    JSON.stringify({ name: MARKET, plugins: [{ name: PLUGIN, source: "./plugin" }] }));
  written(work, OWNED, TEN);
  git(work, "add", ".");
  git(work, "commit", "-qm", "the tree this landing starts from");
  git(work, "remote", "add", "origin", join(at, "origin.git"));
  git(work, "push", "-q", "origin", `HEAD:${BASE}`);
  const branched = (branch, path, text) => {
    git(work, "checkout", "-qb", branch, BASE);
    written(work, path, text);
    git(work, "add", path);
    git(work, "commit", "-qm", `the change on ${branch}`);
    git(work, "push", "-q", "origin", branch);
    git(work, "checkout", "-q", BASE);
    return sha(work, branch);
  };
  const head = branched(BRANCH, OWNED, TEN.replace("line 2\n", "line 2, as the change wrote it\n"));
  const next = second ? branched(NEXT_BRANCH, NEXT_OWNED, "the second change\n") : null;
  /* `moved` takes a line of the change's own file the branch did not touch, so the merge is clean
     and the change's paths still differ from what was judged; `conflict` takes the line it did. */
  if (base === "moved" || base === "conflict") {
    const line = base === "conflict" ? "line 2\n" : "line 9\n";
    written(work, OWNED, TEN.replace(line, `${line.trim()}, as the base moved it\n`));
    git(work, "add", OWNED);
    git(work, "commit", "-qm", `the base over ${base === "conflict" ? "the change's own line" : "another line"}`);
    git(work, "push", "-q", "origin", `HEAD:${BASE}`);
  }
  if (base === "other") {
    written(work, join("docs", "other.md"), "a page nobody's change touches\n");
    git(work, "add", join("docs", "other.md"));
    git(work, "commit", "-qm", "the base, elsewhere");
    git(work, "push", "-q", "origin", `HEAD:${BASE}`);
  }
  writeFileSync(join(ROOM, "marketplace-source"), `${work}\n`);
  process.chdir(work);
  return { at, work, head, next, base: sha(work, BASE) };
};

/** Another clone's release, pushed to the same origin: the checkout's tracking ref stays where it
 *  was, which is the state a landing that pinned a head and looked again has to survive. */
export const serverPushes = (at, version) => {
  const clone = join(at, `clone-${version}`);
  spawnSync("git", ["clone", "-q", join(at, "origin.git"), clone], { encoding: "utf8" });
  const held = JSON.parse(readFileSync(join(clone, "package.json"), "utf8"));
  written(clone, "package.json", JSON.stringify({ ...held, version }, null, 2));
  written(clone, join("plugin", ".claude-plugin", "plugin.json"), JSON.stringify({ name: PLUGIN, version }, null, 2));
  git(clone, "add", "package.json", join("plugin", ".claude-plugin", "plugin.json"));
  git(clone, "commit", "-qm", `chore(release): ${version}, another clone's`);
  git(clone, "push", "-q", "origin", `HEAD:${BASE}`);
  return sha(clone, "HEAD");
};

/** The checkpoint a build leaves, as `forge claim --pushed --ready` writes it. */
export const ready = (head, base, extra = {}) => ({
  state: "ready",
  builder: BUILDER,
  branch: BRANCH,
  head,
  base,
  files: [OWNED],
  at: new Date().toISOString(),
  ...extra,
});

export const ctx = (work) => ({
  root: work,
  base: BASE,
  self: "node tools/run.mjs",
  market: MARKET,
  plugin: PLUGIN,
});

/* The boundary the landing task is held to, in one place because every outcome is held to it: the
   field the checkpoint and the lease share, the merged mark, a status the flow table allows and the
   park's own record. A verdict, a review or a plan write would be another call and would show up
   here; so would a field written beside the checkpoint in the same update. */
export const strayWrites = () => state.calls
  .filter((one) => one.args.data)
  .filter((one) => {
    if (one.name === "forge_comments") return !/^## Park\b/mu.test(one.args.data?.body ?? "");
    if (one.args.action === "update") return Object.keys(one.args.data ?? {}).join(",") !== "sessionContext";
    return one.args.action !== "mark_merged" && one.args.action !== "transition";
  })
  .map((one) => `${one.name} ${one.args.action} ${Object.keys(one.args.data ?? {}).join(",")}`);
