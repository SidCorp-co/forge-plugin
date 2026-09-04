/* How Claude Code calls a gate. Unwrapping the answer stays each suite's: `deny()` and `block()` do
   not answer alike, and the git rules need a tree with work to lose. */
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const callHook = (hook, event, env = process.env) =>
  spawnSync(process.execPath, [hook], { input: JSON.stringify(event), encoding: "utf8", env });

/* A child awaited rather than waited on: anything that asks a server the test itself is running
   deadlocks under `spawnSync`, which holds the loop that would answer it. */
export const ranAsync = (command, argv, env = process.env) =>
  new Promise((done) => {
    const child = spawn(command, argv, { env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (status) => done({ stdout, stderr, status }));
    child.stdin.end();
  });

export const callHookAsync = (hook, event, env = process.env) =>
  new Promise((done) => {
    const child = spawn(process.execPath, [hook], { env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (status) => done({ stdout, stderr, status }));
    child.stdin.end(JSON.stringify(event));
  });

/* The suite has left thousands of these behind (ISS-42) and filled the mount a shell needed. The
   removal is registered here, where no caller can forget it, and handed back so a case proves it. */
export const tempHome = (name) => {
  const path = mkdtempSync(join(tmpdir(), `${name}-home-`));
  const remove = () => rmSync(path, { recursive: true, force: true });
  process.on("exit", remove);
  return { path, remove };
};

export const homeEnv = (name) => ({
  ...process.env,
  XDG_CONFIG_HOME: mkdtempSync(join(tmpdir(), `${name}-home-`)),
});

const git = (room, ...args) =>
  spawnSync("git", ["-C", room, "-c", "user.email=t@t", "-c", "user.name=t", ...args], { encoding: "utf8" });

export const dirtyRepo = () => {
  const room = mkdtempSync(join(tmpdir(), "dirty-repo-"));
  spawnSync("git", ["init", "-q", room], { encoding: "utf8" });
  writeFileSync(join(room, "tracked.txt"), "committed\n");
  git(room, "add", "tracked.txt");
  git(room, "commit", "-qm", "base");
  writeFileSync(join(room, "tracked.txt"), "changed, and never committed\n");
  return room;
};

const DECLARED = ["forge_issues", "forge_comments", "forge_projects.list", "forge_uploads",
  "forge_projects.get", "forge_config"];
/* `scoped` reads the schema to know whether to send the project id, so a tool declared with no
   properties is one a verb calls unscoped — which is a real call the tracker would refuse. Both of
   these declare one, so the id lookup runs, and the listing that answers it is served below from
   this repository's own slug rather than left for every suite to stub. */
const TAKES_PROJECT = ["forge_projects.get", "forge_config"];
const OWN = { id: "1e1c1a1e-0000-4000-8000-0000000000ff" };
const ownSlug = () =>
  JSON.parse(readFileSync(join(import.meta.dirname, "..", "..", ".forge.json"), "utf8")).slug;
const declaration = (name) => ({
  name,
  inputSchema: { properties: TAKES_PROJECT.includes(name) ? { projectId: { type: "string" } } : {} },
});

/** A tracker a verb can be spawned against, answering out of `state` at request time so a case that
 *  changes the state changes the answer. `state.calls` collects every call for a case to assert on;
 *  a handler in `state.answer` keyed by tool takes precedence over the defaults below. */
export const fakeTracker = async (state) => {
  const body = (request) =>
    new Promise((done) => {
      let text = "";
      request.on("data", (chunk) => {
        text += chunk;
      });
      request.on("end", () => done(JSON.parse(text)));
    });
  /* `state.hidden` is what lies past the page the list returns: a search reaches it, a listing
     does not, which is the seam a duplicate check with no cursor has to answer for. */
  const listed = (filters = {}) => {
    const wanted = String(filters.search ?? "").toLowerCase();
    const pool = wanted ? [...(state.issues ?? []), ...(state.hidden ?? [])] : (state.issues ?? []);
    const rows = pool.filter((one) => !wanted || JSON.stringify(one).toLowerCase().includes(wanted));
    return { issues: rows, returned: rows.length, hasMore: false };
  };
  const issues = (args) => {
    if (args.action === "list") return listed(args.filters);
    if (args.action === "get") return (state.issues ?? []).find((one) => one.documentId === args.documentId) ?? {};
    if (args.action === "create") return { documentId: state.mint ?? "filed-uuid", ...args.data };
    return { documentId: args.documentId, ...(args.data ?? {}) };
  };
  const comments = (args) => {
    if (args.action !== "list") return { documentId: "comment-uuid", ...(args.data ?? {}) };
    const held = (state.comments ?? {})[args.filters?.issue] ?? [];
    return { comments: held, returned: held.length, hasMore: false };
  };
  const served = createServer(async (request, response) => {
    const call = await body(request);
    const name = call.params?.name;
    const args = call.params?.arguments ?? {};
    (state.calls ??= []).push({ name, args });
    let result = { tools: DECLARED.map(declaration) };
    const own = (state.answer ?? {})[name];
    /* A handler answering `{ refused }` is the tool's own refusal, which the transport reads from
       `isError` and no structured content: the shape a verb's way out is reached by. */
    if (own) {
      const answered = own(args);
      result = answered?.refused
        ? { isError: true, content: [{ type: "text", text: answered.refused }] }
        : { structuredContent: answered };
    }
    else if (name === "forge_issues") result = { structuredContent: issues(args) };
    else if (name === "forge_comments") result = { structuredContent: comments(args) };
    else if (name === "forge_projects.list") {
      result = { structuredContent: { projects: [{ ...OWN, slug: ownSlug() }] } };
    }
    else if (name) result = { structuredContent: {} };
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ jsonrpc: "2.0", id: call.id ?? 1, result }));
  });
  await new Promise((ready) => served.listen(0, "127.0.0.1", ready));
  const home = tempHome("tracker");
  mkdirSync(join(home.path, "forge"), { recursive: true });
  const url = `http://127.0.0.1:${served.address().port}/mcp`;
  writeFileSync(join(home.path, "forge", "config.json"), JSON.stringify({ url, token: "t" }));
  return { url, env: { ...process.env, XDG_CONFIG_HOME: home.path }, close: () => served.close() };
};
