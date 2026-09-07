/* Where every setting comes from — never from an argument. Two scopes: the url and token are the
   ACCOUNT's, the slug and prose language the PROJECT's, so the slug is demanded lazily. Each
   resolves to `{ value, from }`, because provenance is what doctor reports. docs/cli/settings.md. */
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";

import { configPath, once, readJson, userConfig } from "./config.mjs";

/* Registered by a caller holding something no exit may lose — a body that arrived on stdin. */
let kept = null;

export const keepOnFailure = (text) => {
  kept = text;
};

/** What `fail` throws inside `refusing`, where there is no process of this CLI's own to end — the
 *  release script files an issue mid-release, and an exit there leaves one half done. */
export class Refusal extends Error {}

let embedded = 0;

export const refusing = async (run) => {
  embedded += 1;
  try {
    return await run();
  } finally {
    embedded -= 1;
  }
};

export const fail = (message) => {
  if (embedded) throw new Refusal(message);
  console.error(message);
  if (kept) console.error(kept);
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
    url: sourced(configPath(), saved.url),
    token: sourced(configPath(), saved.token),
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

/* Where a project-scoped call GOES and in whose prose — the target's, not the caller's: docs/cli/feedback.md. */
let aimed = null;

export const useProject = ({ slug, from }) => {
  aimed = { value: slug, from };
};

export const projectTarget = () => aimed ?? projectScope();

/* Which paths, and which angles, are the checkout's answer: the account's covers every one. */
export const projectRecordPattern = () => sourced(".forge.json", forgeJson().parsed?.codex?.pathRe);
export const projectCodex = () => forgeJson().parsed?.codex ?? {};

/* The directory `.forge.json` sits in, else the checkout's. A caller reading a project file needs
   this and not the cwd: doctor runs anywhere, and walking up from a subdirectory eventually leaves
   the project. */
export const projectRoot = once(() => forgeJson().root ?? checkoutRoot());

/* The slug is a header when there is one, and an error only for a call needing a project id. */
export const slugIfAny = () => projectTarget().value;

export const projectSlug = () => {
  const { value } = projectTarget();
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
  return { value: off ? null : String(chosen.value), from: chosen.from };
});

export const translateTarget = () =>
  (aimed ? { value: null, from: aimed.from } : translateScope());

export const translateTo = () => translateTarget().value;

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

export const rankConvention = once(() => sourced(".forge.json", forgeJson().parsed?.rank));

export const projectReview = () => forgeJson().parsed?.review ?? {};
export const projectStop = () => forgeJson().parsed?.stop ?? {};

const FROM_PROJECT = ".forge.json";
export const PLUGIN_DEFAULT = "the plugin's default";

const chosen = (given, allowed, fallback) => {
  if (given === undefined || given === null) return { value: fallback, from: PLUGIN_DEFAULT };
  const held = String(given);
  return allowed.includes(held)
    ? { value: held, from: FROM_PROJECT }
    : { value: fallback, from: PLUGIN_DEFAULT, unknown: held };
};

export const FEEDBACK_CHANNELS = ["off", "bugs", "all"];
const FEEDBACK_DEFAULTS = { plugin: "bugs", project: "all" };

/** Each channel defaults on its own: a project naming one says nothing about the other. */
export const feedbackScope = once(() => Object.fromEntries(
  Object.entries(FEEDBACK_DEFAULTS).map(([which, fallback]) =>
    [which, chosen(forgeJson().parsed?.feedback?.[which], FEEDBACK_CHANNELS, fallback)]),
));

/** The key as written, or none: the versions are the plugin's, so `methodPinned` applies the default. */
export const methodScope = once(() => {
  const given = forgeJson().parsed?.method;
  if (given === undefined || given === null) return { value: null, from: PLUGIN_DEFAULT };
  const held = Number(given);
  return Number.isInteger(held) && held > 0
    ? { value: held, from: FROM_PROJECT }
    : { value: null, from: PLUGIN_DEFAULT, unknown: String(given) };
});

export const LANDING_ROUTES = ["after-merge", "before-merge"];

export const landingScope = once(() => {
  const given = forgeJson().parsed?.landing;
  if (given === undefined || given === null) return { value: null, from: null };
  const held = String(given);
  return LANDING_ROUTES.includes(held)
    ? { value: held, from: FROM_PROJECT }
    : { value: null, from: null, unknown: held };
});

export const SHIP_MODES = ["self", "ready"];

/** Unmemoised: `forge doctor --ship` writes the option and reports it in the same process. */
export const shipMode = () => {
  const held = userConfig().ship;
  if (SHIP_MODES.includes(held)) return { value: held, from: CONFIG_PATH };
  const [fallback] = SHIP_MODES;
  return held === undefined || held === null
    ? { value: fallback, from: PLUGIN_DEFAULT }
    : { value: fallback, from: PLUGIN_DEFAULT, unknown: String(held) };
};
