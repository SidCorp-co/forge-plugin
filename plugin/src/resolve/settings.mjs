/* Where every setting comes from — never from an argument. Two scopes: the url and token are the
   ACCOUNT's, the slug and prose language the PROJECT's, so the slug is demanded lazily. Each
   resolves to `{ value, from }`, because provenance is what doctor reports. docs/cli/settings.md. */
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";

import { CONFIG_PATH, once, readJson, userConfig } from "./config.mjs";

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
const checkoutRoot = once(() => {
  const common = git(["rev-parse", "--git-common-dir"], process.cwd());
  return common === null ? null : dirname(resolve(process.cwd(), common));
});

const searchRoots = once(() => {
  const shared = checkoutRoot();
  return [...ancestors(process.cwd()), ...(shared ? [shared] : [])];
});

const nearest = (name) =>
  once(() => {
    for (const root of searchRoots()) {
      const parsed = readJson(join(root, name));
      if (parsed) return { parsed, from: name, root };
    }
    return { parsed: null, from: null, root: null };
  });

const forgeJson = nearest(".forge.json");
const mcpJson = nearest(".mcp.json");

/* Reported, never resolved: doctor names a `forge` server in a `.mcp.json` rather than leaving its
   owner to guess, because credentials that answer by directory are the account's in name only. */
export const mcpForgeIgnored = () => {
  const server = mcpJson().parsed?.mcpServers?.forge ?? null;
  if (!server) return null;
  return {
    root: mcpJson().root,
    credentials: Boolean(server.url || server.headers?.Authorization),
    slug: Boolean(server.headers?.["X-Forge-Project-Slug"]),
  };
};

const sourced = (from, value) => (value ? { value, from } : { value: null, from: null });

export const accountCredentials = once(() => {
  const saved = userConfig();
  return {
    url: sourced(CONFIG_PATH, saved.url),
    token: sourced(CONFIG_PATH, saved.token),
  };
});

export const settings = once(() => {
  const { url, token } = accountCredentials();
  if (!url.value || !token.value) {
    fail(
      "No Forge endpoint. Run `forge doctor --token <pat> --url <endpoint>` to save one in\n" +
        "~/.config/forge/config.json, the one place either is read from. Neither the environment\n" +
        "nor a `.mcp.json` is a source; `forge doctor` names a `.mcp.json` it finds.",
    );
  }
  const bearer = token.value.startsWith("Bearer ") ? token.value : `Bearer ${token.value}`;
  return { url: url.value, token: bearer };
});

export const projectScope = once(() => sourced(".forge.json", forgeJson().parsed?.slug));

/* Which paths, and which angles, are the checkout's answer: the account's covers every one. */
export const projectRecordPattern = () => sourced(".forge.json", forgeJson().parsed?.codex?.pathRe);
export const projectCodex = () => forgeJson().parsed?.codex ?? {};

/* The directory `.forge.json` sits in, else the checkout's. A caller reading a project file needs
   this and not the cwd: doctor runs anywhere, and walking up from a subdirectory eventually leaves
   the project. */
export const projectRoot = once(() => forgeJson().root ?? checkoutRoot());

/* The slug is a header when there is one, and an error only for a call needing a project id. */
export const slugIfAny = () => projectScope().value;

export const projectSlug = () => {
  const { value } = projectScope();
  if (!value) {
    fail(
      'This call is project-scoped and no project slug is set. Put `{ "slug": "<project>" }`\n' +
        "in a `.forge.json` at the root of the project, the one place it is read from — not\n" +
        "the environment, and not a `.mcp.json` header.",
    );
  }
  return value;
};

/* A property of the tracker, not the CLI. Off by default: a wrong-language issue cannot be
   deleted, and a missing translation is an edit. */
export const translateScope = once(() => {
  const chosen = sourced(".forge.json", forgeJson().parsed?.translate);
  const off = !chosen.value || chosen.value === "off" || chosen.value === "false";
  return off ? { value: null, from: chosen.from } : { value: String(chosen.value), from: chosen.from };
});

export const translateTo = () => translateScope().value;

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
