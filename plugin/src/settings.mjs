/* Where the endpoint, the credentials and the project's own conventions come from — never from an
   argument.

   Two scopes, and they are not the same scope. The url and the token are the *account's*: one
   Forge instance, one PAT, every project. The slug, the prose language and anything else a tracker
   decides for itself are the *project's*, and they are the things that change when you cd
   somewhere else — so the slug is demanded lazily, by the call that actually needs a project id,
   and `tools`, `schema` and `guide` never ask for it at all.

   Every setting resolves to `{ value, from }`. `doctor` exists because "not configured" and
   "configured in the wrong file" look identical from inside one failing command, so provenance is
   the return type rather than a courtesy some resolvers extend. */
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";

import { once, readJson, userConfig } from "./config.mjs";

export const fail = (message) => {
  console.error(message);
  process.exit(1);
};

/* Returns the trimmed stdout, or null when git refused. A caller that destructures this as
   `{ status, stdout }` gets two undefineds and silently takes its own fallback branch forever. */
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

/* A linked worktree has no `.mcp.json` or `.forge.json` of its own — both are git-ignored and
   belong to the checkout they were created in. `--git-common-dir` names the main checkout's
   `.git`, whose parent holds them, and that is the only way in from a worktree kept outside the
   main tree. Memoised: unmemoised this spawned `git rev-parse` nine times for one `forge issues`,
   and the cwd does not move inside a run. */
const searchRoots = once(() => {
  const cwd = process.cwd();
  const common = git(["rev-parse", "--git-common-dir"], cwd);
  const shared = common === null ? null : dirname(resolve(cwd, common));
  return [...ancestors(cwd), ...(shared ? [shared] : [])];
});

/* Each project file is read once per run and remembered with where it was found, so three settings
   reading `.forge.json` cost one walk rather than three. */
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

/* Every request carries the slug as a header when there is one — that is how the server scopes a
   call that takes no projectId — but its absence is only an error for a call that needs a project
   id, so this one answers null instead of exiting. */
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

/* Which language this project's issues are written in — a property of the tracker, not of the
   CLI. Measured 2026-08-27: sid-growth is Vietnamese and forge-dev is English, so posting one
   convention into both is a wrong-language issue that no verb can delete afterwards. Off is the
   default because that failure is unrecoverable and a missing translation is an edit. */
export const translateScope = once(() => {
  const chosen = pick([
    ["$FORGE_TRANSLATE", process.env.FORGE_TRANSLATE],
    [".forge.json", forgeJson().parsed?.translate],
  ]);
  const off = !chosen.value || chosen.value === "off" || chosen.value === "false";
  return off ? { value: null, from: chosen.from } : { value: String(chosen.value), from: chosen.from };
});

export const translateTo = () => translateScope().value;
