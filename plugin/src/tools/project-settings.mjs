/* The project's own configuration: the two typed resources the tracker keeps per project, reported
   with the source each key was read from and written one key at a time. Whose the decision is, and
   why a key is never re-declared in a checkout: docs/cli/doctor.md. */
import { fail, projectSlug } from "../resolve/settings.mjs";
import { scoped, write } from "../tracker/rpc.mjs";
import { WITH_BODY, WRITES } from "../tracker/project-flags.mjs";
import {
  briefLines,
  confirmSource,
  projectRows,
  readBrief,
  refreshBrief,
  releasePolicy,
  replaceBriefLine,
  stagingDeploy,
} from "../tracker/project-config.mjs";

/* A nested value is its own width: a stage table printed whole is this report's longest line and
   says nothing a count of its keys does not. */
const shown = (value) => {
  if (value === null || value === undefined) return "unset";
  if (Array.isArray(value)) return `${value.length} entr${value.length === 1 ? "y" : "ies"}`;
  if (typeof value === "object") {
    const held = Object.keys(value);
    return held.length ? `${held.length} key(s): ${held.join(", ")}` : "none";
  }
  return String(value);
};

/* A fact is a guide a whole prompt carries, so its width and whether it is injected are what a
   reader acts on; the body itself is the tracker's to hand to an agent. */
const factShown = (text, key, answer) =>
  `${String(text ?? "").length} characters${answer?.projectFactsConfig?.[key]?.alwaysInject === true ? ", always-inject" : ""}`;

const RESOURCES = {
  pipeline: {
    said: "the tracker's pipeline configuration",
    read: "pipeline",
    written: "set_pipeline",
    keysIn: (answer) => answer?.pipelineConfig ?? {},
    bodyFor: (key, value) => ({ [key]: value }),
    typed: true,
    shown,
  },
  fact: {
    said: "the tracker's project facts",
    read: "facts",
    written: "set_facts",
    keysIn: (answer) => answer?.projectFacts ?? {},
    bodyFor: (key, value) => ({ projectFacts: { [key]: value } }),
    typed: false,
    shown: factShown,
  },
};

const NAMES = Object.keys(RESOURCES);

/* A pipeline key is typed and a fact is prose, so the coercion is the resource's: `enabled=false`
   arriving as the string "false" is a value the tracker's schema drops in silence. */
const valueFor = (resource, given) => {
  if (!resource.typed) return given;
  if (given === "true" || given === "false") return given === "true";
  return /^-?\d+$/u.test(given) ? Number(given) : given;
};

/** Every resource at once, and soft: one a credential cannot reach is a line saying so, never an
 *  empty key set that reads as a project having configured nothing. */
const readSettings = async () =>
  Object.fromEntries(await Promise.all(NAMES.map(async (name) =>
    [name, await scoped("forge_config", { action: RESOURCES[name].read }, true)])));

const settingRows = (read) => {
  const out = [];
  for (const name of NAMES) {
    const resource = RESOURCES[name];
    const answer = read[name];
    if (answer?.refused) {
      out.push({ level: "note", label: name, detail: `${resource.said} would not answer: ${answer.refused}` });
      continue;
    }
    const keys = resource.keysIn(answer);
    const held = Object.keys(keys).sort();
    if (!held.length) {
      out.push({ level: "ok", label: name, detail: `nothing set  ← ${resource.said}` });
      continue;
    }
    for (const key of held) {
      out.push({ level: "ok", label: `${name}.${key}`,
        detail: `${resource.shown(keys[key], key, answer)}  ← ${resource.said}` });
    }
  }
  return out;
};

const SET_USAGE = "forge doctor --set <key>=<value>";

const keySets = (read) =>
  NAMES.map((name) =>
    `${name}: ${Object.keys(RESOURCES[name].keysIn(read[name])).sort().join(", ") || "nothing set"}`);

const ambiguous = (given, both) =>
  `--set: \`${given}\` is a key ${both.join(" and ")} both hold, so a bare name says nothing about `
  + `which one to write and nothing was sent. Name the resource: `
  + both.map((name) => `--set ${name}.${given}=<value>`).join(" or ");

const unknownKey = (given, read) =>
  `--set: \`${given}\` is no key either of this project's configuration resources holds, so nothing `
  + `was sent.\n  ${keySets(read).join("\n  ")}\n`
  + "Name the resource to write a key neither holds yet: "
  + NAMES.map((name) => `--set ${name}.${given}=<value>`).join(" or ");

/* A prefixed key names its resource outright and costs no read — the only way to write a key the
   project does not hold yet, and the only way to write one both hold, a bare key both answer with
   routing nowhere: one is a deploy switch, so picking for the caller is wrong half the time. */
const routeFor = async (given) => {
  const at = given.indexOf(".");
  const head = at > 0 ? given.slice(0, at) : null;
  if (head && NAMES.includes(head)) return { name: head, key: given.slice(at + 1) };
  const read = await readSettings();
  const refused = NAMES.filter((name) => read[name]?.refused);
  if (refused.length) {
    fail(`--set: ${refused.map((name) => RESOURCES[name].said).join(" and ")} would not answer, and a `
      + `key is routed by which resource holds it, so nothing was sent: ${read[refused[0]].refused}`);
  }
  const found = NAMES.filter((name) => Object.hasOwn(RESOURCES[name].keysIn(read[name]), given));
  if (found.length > 1) fail(ambiguous(given, found));
  if (!found.length) fail(unknownKey(given, read));
  return { name: found[0], key: given };
};

/** Read back off the resource's own route before it is reported set: this tracker's pipeline schema
 *  drops a key it does not declare, so a write that answered 200 and kept nothing would print as a
 *  setting that took. */
export const writeSetting = async (given) => {
  /* Before the read and before the write: a checkout naming no project has nowhere to send this. */
  projectSlug();
  const at = given.indexOf("=");
  if (at < 1) {
    fail(`--set takes one key and its value, joined by \`=\`, and \`${given}\` is not that pair. `
      + `Nothing was sent: ${SET_USAGE}`);
  }
  const asked = given.slice(0, at);
  const raw = given.slice(at + 1);
  const route = await routeFor(asked);
  if (!route.key) fail(`--set: \`${asked}\` names the resource and no key of it. ${SET_USAGE}`);
  const resource = RESOURCES[route.name];
  const value = valueFor(resource, raw);
  await write("forge_config", { action: resource.written, data: resource.bodyFor(route.key, value) });
  const now = await scoped("forge_config", { action: resource.read }, true);
  if (now?.refused) {
    fail(`--set: ${route.name}.${route.key} was sent and ${resource.said} would not answer the read `
      + `back, so nothing here can say what it now holds: ${now.refused}`);
  }
  const kept = resource.keysIn(now)[route.key];
  if (String(kept) !== String(value)) {
    fail(`--set: ${route.name}.${route.key} was sent as ${JSON.stringify(value)} and ${resource.said} `
      + `reads back ${JSON.stringify(kept ?? null)}. The tracker did not keep it — a key its own `
      + "schema does not declare is dropped on the way in, and this is that key.");
  }
  return [`${route.name}.${route.key}: ${shown(kept)}  ← ${resource.said}`];
};

/* The project's work as the tracker counts it, beside its configuration because both are the project's
   own record. The graph rides in from the capability probe that already asked for it rather than being
   asked twice, and its row says what the reading did not reach: the tracker answers this project
   truncated, so a count printed as if it were the whole graph would be a lie a reader cannot see. */
const pmRows = (snapshot, load, graph) => {
  /* A refusal read as an answer prints zeros, which is a measurement this never made. */
  const refused = [snapshot, load, graph].map((one) => one?.refused).find(Boolean);
  if (refused) return [{ level: "note", label: "project pm", detail: `not read: ${refused}` }];
  const counts = Object.entries(snapshot?.countsByStatus ?? {})
    .filter(([, held]) => held)
    .map(([status, held]) => `${held} ${status}`)
    .join(", ");
  const stalled = (snapshot?.stalledIssues ?? []).length;
  const runners = (load?.runners ?? []).length;
  const reached = `${(graph?.edges ?? []).length} edge(s) over ${(graph?.nodes ?? []).length} `
    + `issue(s) at depth ${graph?.depth ?? "unstated"}`;
  return [
    { level: snapshot?.countsByStatus ? "ok" : "note",
      label: "issue counts",
      detail: snapshot?.countsByStatus
        ? (counts || "no issue in any status")
        : "the tracker named no counts, so this is not a reading of an empty project" },
    { level: stalled ? "note" : "ok",
      label: "work queue",
      detail: `${snapshot?.queuedCount ?? 0} queued, ${(snapshot?.activeJobs ?? []).length} active, `
        + `${stalled} stalled, ${(snapshot?.recentFailures ?? []).length} recent failure(s)` },
    { level: "ok",
      label: "runner load",
      detail: runners ? `${runners} runner(s) registered` : "no runner registered here" },
    { level: graph?.truncated ? "note" : "ok",
      label: "dependency graph",
      detail: graph?.truncated
        ? `${reached}, and ${graph?.remainingNodes ?? 0} issue(s) it did not reach`
        : reached },
  ];
};

/** Every level of the project's own record in one reading: the branches and the deploy, then each
 *  key of the two configuration resources, the work the tracker counts, then the brief as prose. The
 *  reads go together — one report is one round trip's worth of waiting, not six. */
export const projectReport = async ({ credentials, graph = null } = {}) => {
  const [policy, deploy, settings, brief, snapshot, load] = await Promise.all([
    releasePolicy(), stagingDeploy(), readSettings(), readBrief(),
    scoped("forge_project_pm.snapshot", {}, true), scoped("forge_project_pm.runner_load", {}, true),
  ]);
  return {
    rows: [...projectRows({ policy, deploy, credentials }), ...settingRows(settings),
      ...pmRows(snapshot, load, graph)],
    brief: briefLines(brief),
  };
};

/* Silently preferring a route would leave the caller reading a success about the write they did not
   ask for, so the body's fields are refused beside any write that takes no body rather than
   dropped — a caller told a field was set that nothing stored has been told the wrong thing. */
export const briefAsked = (asked) => WRITES.some((one) => asked[one] !== undefined);

export const refuseCarried = (asked, pairs, said) => {
  const carried = [...WITH_BODY.filter((one) => asked[one] !== undefined), ...(pairs.length ? ["meta"] : [])];
  if (carried.length) {
    fail(`doctor: ${carried.map((one) => `--${one}`).join(" and ")} are written with a body, so they `
      + `belong to --refresh. ${said}`);
  }
};

export const briefRoute = async (asked, pairs, positionals) => {
  const asks = WRITES.filter((one) => asked[one] !== undefined);
  if (asks.length > 1) {
    fail(`doctor: ${asks.map((one) => `--${one}`).join(" and ")} each write the brief a different `
      + "way and one call takes one — --refresh the whole body, --confirm one source's digest, "
      + "--line one line's prose.");
  }
  if (asks.length && asks[0] !== "refresh") {
    refuseCarried(asked, pairs, `--${asks[0]} carries the stored entry's forward untouched.`);
  }
  if (asked.line !== undefined && positionals.length !== 1) {
    fail("doctor: --line takes the line's number and the one line of prose replacing it, so quote "
      + `that prose as a single argument: forge doctor --line <n> <text>${positionals.length
        ? ` — ${positionals.length} arrived after it` : ""}`);
  }
  if (asked.confirm !== undefined) return confirmSource(asked.confirm);
  if (asked.line !== undefined) return replaceBriefLine(asked.line, positionals[0]);
  return refreshBrief(asked.refresh, { ...asked, pairs });
};
