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
   main tree. */
const searchRoots = () => {
  const cwd = process.cwd();
  const common = git(["rev-parse", "--git-common-dir"], cwd);
  const shared = common === null ? null : dirname(resolve(cwd, common));
  return [...ancestors(cwd), ...(shared ? [shared] : [])];
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

const mcpForge = () => findUp(".mcp.json", (parsed) => parsed?.mcpServers?.forge ?? null);

let endpoint = null;

/* The account's half: url and token. Required by every call, so this fails loudly and early. */
export const settings = () => {
  if (endpoint) return endpoint;
  const config = mcpForge();
  const url = process.env.FORGE_MCP_URL ?? config?.url;
  const token = process.env.FORGE_TOKEN ?? config?.headers?.Authorization;
  if (!url || !token) {
    fail(
      "No Forge endpoint. Set FORGE_MCP_URL and FORGE_TOKEN,\n" +
        "or give a `.mcp.json` at or above this directory a `forge` server carrying its url\n" +
        "and an Authorization header. A worktree also inherits its main checkout's.",
    );
  }
  endpoint = { url, token: token.startsWith("Bearer ") ? token : `Bearer ${token}` };
  return endpoint;
};

/* The project's half. Every request carries the slug as a header when there is one — that is how
   the server scopes a call that takes no projectId — but its absence is only an error for a call
   that needs a project id, so this one answers null instead of exiting. */
export const slugIfAny = () =>
  process.env.FORGE_PROJECT_SLUG ??
  findUp(".forge.json", (parsed) => parsed?.slug ?? null) ??
  mcpForge()?.headers?.["X-Forge-Project-Slug"] ??
  null;

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
