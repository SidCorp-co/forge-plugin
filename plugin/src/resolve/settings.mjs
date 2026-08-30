/* Where every setting comes from — never from an argument. Two scopes: the url and token are the
   ACCOUNT's, the slug and prose language the PROJECT's, so the slug is demanded lazily. Each
   resolves to `{ value, from }`, because provenance is what doctor reports. docs/FORGE-CLI.md. */
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";

import { once, readJson, userConfig } from "./config.mjs";

export const fail = (message) => {
  console.error(message);
  process.exit(1);
};

/* Trimmed stdout, or null. A caller destructuring `{ status, stdout }` gets two undefineds. */
const git = (args, cwd) => {
  const { status, stdout } = spawnSync("git", args, { cwd, encoding: "utf8" });
  return status === 0 ? (stdout ?? "").trim() : null;
};

const ancestors = (start) => {
  const seen = [];
  let current = resolve(start);
  for (;;) {
    seen.push(current);
    const parent = dirname(current);
    if (parent === current) return seen;
    current = parent;
  }
};

/* A linked worktree owns neither file; `--git-common-dir` names the checkout that does. Memoised —
   unmemoised this spawned nine `git rev-parse` for one `forge issues`. */
const searchRoots = once(() => {
  const cwd = process.cwd();
  const common = git(["rev-parse", "--git-common-dir"], cwd);
  const shared = common === null ? null : dirname(resolve(cwd, common));
  return [...ancestors(cwd), ...(shared ? [shared] : [])];
});

/* Each project file is read once per run, with where it was found. */
const nearest = (name) =>
  once(() => {
    for (const root of searchRoots()) {
      const parsed = readJson(join(root, name));
      if (parsed) return { parsed, from: name };
    }
    return { parsed: null, from: null };
  });

const forgeJson = nearest(".forge.json");
const mcpJson = nearest(".mcp.json");
const mcpForge = () => mcpJson().parsed?.mcpServers?.forge ?? null;

/* First source that answers wins, and it says which it was. */
const pick = (sources) => {
  for (const [from, value] of sources) if (value) return { value, from };
  return { value: null, from: null };
};

export const accountCredentials = once(() => {
  const saved = userConfig();
  const server = mcpForge();
  return {
    url: pick([
      ["$FORGE_MCP_URL", process.env.FORGE_MCP_URL],
      ["~/.config/forge/config.json", saved.url],
      [".mcp.json", server?.url],
    ]),
    token: pick([
      ["$FORGE_TOKEN", process.env.FORGE_TOKEN],
      ["~/.config/forge/config.json", saved.token],
      [".mcp.json", server?.headers?.Authorization],
    ]),
  };
});

export const settings = once(() => {
  const { url, token } = accountCredentials();
  if (!url.value || !token.value) {
    fail(
      "No Forge endpoint. Run `forge doctor --token <pat> --url <endpoint>` to save one,\n" +
        "or set FORGE_MCP_URL and FORGE_TOKEN, or give a `.mcp.json` at or above this\n" +
        "directory a `forge` server carrying both. `forge doctor` says which of these it found.",
    );
  }
  const bearer = token.value.startsWith("Bearer ") ? token.value : `Bearer ${token.value}`;
  return { url: url.value, token: bearer };
});

export const projectScope = once(() =>
  pick([
    ["$FORGE_PROJECT_SLUG", process.env.FORGE_PROJECT_SLUG],
    [".forge.json", forgeJson().parsed?.slug],
    [".mcp.json", mcpForge()?.headers?.["X-Forge-Project-Slug"]],
  ]),
);

/* The slug is a header when there is one, and an error only for a call needing a project id. */
export const slugIfAny = () => projectScope().value;

export const projectSlug = () => {
  const { value } = projectScope();
  if (!value) {
    fail(
      "This call is project-scoped and no project slug is set. Export FORGE_PROJECT_SLUG,\n" +
        'or put `{ "slug": "<project>" }` in a `.forge.json` at the root of the project,\n' +
        "or give the `forge` server in `.mcp.json` an X-Forge-Project-Slug header.",
    );
  }
  return value;
};

/* A property of the tracker, not the CLI. Off by default: a wrong-language issue cannot be
   deleted, and a missing translation is an edit. */
export const translateScope = once(() => {
  const chosen = pick([
    ["$FORGE_TRANSLATE", process.env.FORGE_TRANSLATE],
    [".forge.json", forgeJson().parsed?.translate],
  ]);
  const off = !chosen.value || chosen.value === "off" || chosen.value === "false";
  return off ? { value: null, from: chosen.from } : { value: String(chosen.value), from: chosen.from };
});

export const translateTo = () => translateScope().value;

/* The same kind of fact as `translate`, at the same altitude, with an English default. */
const DEFAULT_PROSE = {
  marker: "those edges are recorded",
  blockedBy: "blocked by",
  blocks: "blocks",
  noun: "issues?",
};

export const depsConvention = once(() => {
  const given = forgeJson().parsed?.deps;
  return {
    value: { ...DEFAULT_PROSE, ...(given ?? {}) },
    from: given ? ".forge.json" : "the built-in English default",
  };
});
