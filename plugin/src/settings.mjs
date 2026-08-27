/* Where the endpoint, the credentials and the project slug come from — never from an argument.

   A slug typed into a command is the same hard-coded environment fact whether it sits in a script
   or in a shell history, so the project id is looked up from the slug at runtime instead. */
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

/* A linked worktree has no `.mcp.json` of its own — the file is git-ignored and belongs to the
   checkout it was created in. `--git-common-dir` names the main checkout's `.git`, whose parent
   holds it, and that is the only way in from a worktree kept outside the main tree. */
const sharedCheckout = (cwd) => {
  const common = git(["rev-parse", "--git-common-dir"], cwd);
  return common === null ? null : dirname(resolve(cwd, common));
};

const forgeServerIn = (root) => {
  try {
    const parsed = JSON.parse(readFileSync(join(root, ".mcp.json"), "utf8"));
    const forge = parsed.mcpServers?.forge;
    return forge?.url ? forge : null;
  } catch {
    return null;
  }
};

const fromMcpConfig = (cwd) => {
  const shared = sharedCheckout(cwd);
  for (const root of [...ancestors(cwd), ...(shared ? [shared] : [])]) {
    const forge = forgeServerIn(root);
    if (forge) return forge;
  }
  return null;
};

let resolved = null;

export const settings = () => {
  if (resolved) return resolved;
  const config = fromMcpConfig(process.cwd());
  const url = process.env.FORGE_MCP_URL ?? config?.url;
  const token = process.env.FORGE_TOKEN ?? config?.headers?.Authorization;
  const slug = process.env.FORGE_PROJECT_SLUG ?? config?.headers?.["X-Forge-Project-Slug"];
  if (!url || !token || !slug) {
    fail(
      "No Forge credentials. Set FORGE_MCP_URL, FORGE_TOKEN and FORGE_PROJECT_SLUG,\n" +
        "or give a `.mcp.json` at or above this directory a `forge` server carrying its url\n" +
        "and both headers. A worktree also inherits its main checkout's `.mcp.json`.",
    );
  }
  resolved = { url, token: token.startsWith("Bearer ") ? token : `Bearer ${token}`, slug };
  return resolved;
};
