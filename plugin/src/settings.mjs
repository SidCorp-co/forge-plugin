/* Where the endpoint, the credentials and the project slug come from — never from an argument.

   Two scopes, and they are not the same scope. The url and the token are the *account's*: one
   Forge instance, one PAT, every project. The slug is the *project's*, and it is the only thing
   here that changes when you cd somewhere else — so it is demanded lazily, by the call that
   actually needs a project id, and `tools`, `schema` and `guide` never ask for it at all.

   The project id itself is never configured. It is looked up from the slug at runtime, because an
   id pasted into a command is the same hard-coded environment fact whether it sits in a script or
   in a shell history. */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { userConfig } from "./config.mjs";

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
   main tree.

   Memoised: every request asks for the slug, and unmemoised this spawned `git rev-parse` nine
   times for one `forge issues`. The cwd does not move inside a run. */
let roots = null;
const searchRoots = () => {
  if (roots) return roots;
  const cwd = process.cwd();
  const common = git(["rev-parse", "--git-common-dir"], cwd);
  const shared = common === null ? null : dirname(resolve(cwd, common));
  roots = [...ancestors(cwd), ...(shared ? [shared] : [])];
  return roots;
};

const readJson = (root, name) => {
  try {
    return JSON.parse(readFileSync(join(root, name), "utf8"));
  } catch {
    return null;
  }
};

const findUp = (name, pick) => {
  for (const root of searchRoots()) {
    const found = pick(readJson(root, name));
    if (found) return found;
  }
  return null;
};

let mcp;
const mcpForge = () => {
  if (mcp === undefined) mcp = findUp(".mcp.json", (parsed) => parsed?.mcpServers?.forge ?? null);
  return mcp;
};

/* The account's half, and where each part came from — `doctor` reports the source, so the lookup
   answers with it rather than repeating the precedence in a second place. */
export const accountCredentials = () => {
  const saved = userConfig();
  const mcpServer = mcpForge();
  const pick = (env, fromConfig, fromMcp) =>
    (process.env[env] && { value: process.env[env], from: `$${env}` }) ||
    (fromConfig && { value: fromConfig, from: "~/.config/forge/config.json" }) ||
    (fromMcp && { value: fromMcp, from: ".mcp.json" }) ||
    null;
  const url = pick("FORGE_MCP_URL", saved.url, mcpServer?.url);
  const token = pick("FORGE_TOKEN", saved.token, mcpServer?.headers?.Authorization);
  return { url: url?.value, urlFrom: url?.from, token: token?.value, tokenFrom: token?.from };
};

let endpoint = null;

/* Required by every call, so this fails loudly and early. */
export const settings = () => {
  if (endpoint) return endpoint;
  const { url, token } = accountCredentials();
  if (!url || !token) {
    fail(
      "No Forge endpoint. Run `forge doctor --token <pat> --url <endpoint>` to save one,\n" +
        "or set FORGE_MCP_URL and FORGE_TOKEN, or give a `.mcp.json` at or above this\n" +
        "directory a `forge` server carrying both. `forge doctor` says which of these it found.",
    );
  }
  endpoint = { url, token: token.startsWith("Bearer ") ? token : `Bearer ${token}` };
  return endpoint;
};

/* The project's half. Every request carries the slug as a header when there is one — that is how
   the server scopes a call that takes no projectId — but its absence is only an error for a call
   that needs a project id, so this one answers null instead of exiting. */
export const projectScope = () => {
  if (process.env.FORGE_PROJECT_SLUG) {
    return { slug: process.env.FORGE_PROJECT_SLUG, from: "$FORGE_PROJECT_SLUG" };
  }
  const fromFile = findUp(".forge.json", (parsed) => parsed?.slug ?? null);
  if (fromFile) return { slug: fromFile, from: ".forge.json" };
  const fromMcp = mcpForge()?.headers?.["X-Forge-Project-Slug"];
  return fromMcp ? { slug: fromMcp, from: ".mcp.json" } : { slug: null, from: null };
};

let scope;
export const slugIfAny = () => (scope ??= projectScope()).slug;

/* Nothing calls this until a tool's own schema says it takes a projectId, so an account-level
   verb works in a directory that belongs to no project. */
export const projectSlug = () => {
  const found = slugIfAny();
  if (!found) {
    fail(
      "This call is project-scoped and no project slug is set. Export FORGE_PROJECT_SLUG,\n" +
        'or put `{ "slug": "<project>" }` in a `.forge.json` at the root of the project,\n' +
        "or give the `forge` server in `.mcp.json` an X-Forge-Project-Slug header.",
    );
  }
  return found;
};
