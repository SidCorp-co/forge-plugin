/* The project's own configuration: the two typed resources the tracker keeps per project, reported
   with the source each key was read from and written one key at a time. Whose the decision is, and
   why a key is never re-declared in a checkout: docs/cli/doctor.md. */
import { closeSync, openSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";

import { FROM_PROJECT, fail, projectFilePath, projectSlug } from "../resolve/settings.mjs";
import { FLOW_SLUGS, flowPinned, judgeOf, projectAsksOf, requiresOf } from "../guides/flow.mjs";
import { flowJudgeConflict, flowPolicyConflict } from "../flow/earned.mjs";
import { scoped, write } from "../tracker/rest.mjs";
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

/** Why the resource did not keep what was sent, or null where it did. Two writers read this same
 *  answer, and a second copy of it would be a second reading of what *kept* means. */
const notKept = (route, value, kept) =>
  (String(kept) === String(value) ? null
    : `${route.name}.${route.key} was sent as ${JSON.stringify(value)} and ${RESOURCES[route.name].said} `
      + `reads back ${JSON.stringify(kept ?? null)}. The tracker did not keep it — a key its own `
      + "schema does not declare is dropped on the way in, and this is that key.");

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
  const why = notKept(route, value, kept);
  if (why) fail(`--set: ${why}`);
  return [`${route.name}.${route.key}: ${shown(kept)}  ← ${resource.said}`];
};

/* One top-level key of the project's own file, set in that file's own text rather than in a
   document re-serialized from it: the file is written by hand and holds its owner's line breaks, so
   a rewrite through JSON.stringify lands a diff nobody asked for in somebody else's review. The
   scan tracks strings and nesting because a key of the same name inside another object is not this
   key, and a text it cannot walk answers with no span rather than with a guess. */
const SPACE = /\s/u;

const pastSpace = (text, at) => {
  let held = at;
  while (held < text.length && SPACE.test(text[held])) held += 1;
  return held;
};

const endOfString = (text, at) => {
  let held = at + 1;
  while (held < text.length) {
    if (text[held] === "\\") held += 2;
    else if (text[held] === `"`) return held + 1;
    else held += 1;
  }
  return -1;
};

const endOfValue = (text, at) => {
  if (text[at] === `"`) return endOfString(text, at);
  if (!"{[".includes(text[at])) {
    let held = at;
    while (held < text.length && !`,}]\r\n\t `.includes(text[held])) held += 1;
    return held;
  }
  let depth = 0;
  let held = at;
  while (held < text.length) {
    if (text[held] === `"`) {
      held = endOfString(text, held);
      if (held < 0) return -1;
      continue;
    }
    if ("{[".includes(text[held])) depth += 1;
    else if ("}]".includes(text[held]) && --depth === 0) return held + 1;
    held += 1;
  }
  return -1;
};

/** Where one top-level key's value sits in the text, or null where the document has no such key. */
const valueSpan = (text, key) => {
  let at = pastSpace(text, 0);
  if (text[at] !== "{") return null;
  at = pastSpace(text, at + 1);
  while (text[at] === `"`) {
    const nameEnd = endOfString(text, at);
    if (nameEnd < 0) return null;
    const colon = pastSpace(text, nameEnd);
    if (text[colon] !== ":") return null;
    const valueAt = pastSpace(text, colon + 1);
    const valueEnd = endOfValue(text, valueAt);
    if (valueEnd < 0) return null;
    if (JSON.parse(text.slice(at, nameEnd)) === key) return { at: valueAt, end: valueEnd };
    at = pastSpace(text, valueEnd);
    if (text[at] !== ",") return null;
    at = pastSpace(text, at + 1);
  }
  return null;
};

/** The file's text with one top-level key set to a value, every other byte of it as it was. */
export const withKey = (text, key, value) => {
  const held = valueSpan(text, key);
  const written = JSON.stringify(value);
  if (held) return `${text.slice(0, held.at)}${written}${text.slice(held.end)}`;
  const open = text.indexOf("{");
  const pair = `${JSON.stringify(key)}: ${written}`;
  const first = pastSpace(text, open + 1);
  return text[first] === "}"
    ? `${text.slice(0, open + 1)}\n  ${pair}\n${text.slice(first)}`
    : `${text.slice(0, open + 1)}\n  ${pair},${text.slice(open + 1)}`;
};

const FLOW_USAGE = "forge doctor --flow <slug>";
const READS_IT = "forge doctor";

/** What the one failure this route cannot undo says. Exported so a case can read it: a write of a
 *  file that succeeds and a write of the same bytes back that does not is a pair no call through
 *  the CLI can be made to produce, and a state nobody is told about is the thing being avoided. */
export const restoreFailed = (path, slug, why) =>
  `--flow: ${path} was set to \`flow: ${slug}\` and putting its previous bytes back failed: ${why}. `
  + `That file holds the new flow now and nothing here changed it further — read it, then set the `
  + `flow this project wants with \`${FLOW_USAGE}\`.`;

const flowRead = (path) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"))?.flow ?? null;
  } catch {
    return null;
  }
};

/* Through a sibling and renamed into place, the install and the restore alike: a plain write opens
   the destination truncating, so one that fails part way leaves neither the bytes it replaced nor
   the ones it was writing — and a restore doing that would destroy the very state whose refusal is
   about to report it. The mode is carried over, this file being the repository's and not ours. */
const wroteWhole = (path, text) => {
  const temporary = `${path}.${process.pid}.tmp`;
  try {
    const handle = openSync(temporary, "w", statSync(path).mode & 0o777);
    try {
      writeFileSync(handle, text);
    } finally {
      closeSync(handle);
    }
    renameSync(temporary, path);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
};

/* Refused before a byte is written anywhere: an undeclared slug, a project file this process cannot
   read, parse or write, and — where the flow asks the tracker for anything — a checkout naming no
   project. What is left after these is the tracker, which is the half no check here can make. */
const flowFile = (slug) => {
  if (!FLOW_SLUGS.includes(slug)) {
    fail(`--flow: \`${slug}\` is no flow this copy serves — it serves ${FLOW_SLUGS.join(", ")}. `
      + `Nothing was sent: ${FLOW_USAGE}`);
  }
  const path = projectFilePath();
  if (!path) {
    fail(`--flow: \`flow\` is a key of ${FROM_PROJECT} and no such file was found on the way up from `
      + `here, so nothing was written and nothing was sent. Run this from a checkout that has one.`);
  }
  let held = null;
  let parsed = null;
  try {
    held = readFileSync(path, "utf8");
    parsed = JSON.parse(held);
  } catch (error) {
    fail(`--flow: ${path} is the file \`flow\` is a key of and this could not read it as JSON, so `
      + `that half is out of reach and nothing was sent: ${error.message}`);
  }
  /* A list and a bare string are JSON this parses and no document a key can be set in, and the
     resolver takes either: an insert made anyway would land a property in a file with no object to
     hold it, which is the one way this route can destroy a setting rather than fail to write one. */
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    fail(`--flow: ${path} holds ${Array.isArray(parsed) ? "a list" : JSON.stringify(parsed)} where a `
      + "JSON object with this project's keys in it belongs, and `flow` is a key of that object. "
      + "Nothing was written and nothing was sent.");
  }
  return { path, held };
};

/** The flow and everything that flow asks the project for, in one call. The checkout's file goes
 *  first because its undo is local and certain, and a tracker that says the setting did not land
 *  sends the previous bytes straight back; a tracker that says nothing leaves the flow standing,
 *  because putting it back would be a guess against the half that may well have landed.
 *  docs/cli/the-flow-axis.md. */
export const writeFlow = async (slug) => {
  const { path, held } = flowFile(slug);
  const asks = projectAsksOf(slug);
  /* After the file, because the slug is a key of that same file: a checkout without one is told
     about the file it has not got rather than about a key of a file nobody would find. */
  if (asks.length) projectSlug();
  try {
    wroteWhole(path, withKey(held, "flow", slug));
  } catch (error) {
    fail(`--flow: ${path} is the file \`flow\` is a key of and this could not write it, so that half `
      + `is out of reach and nothing was sent: ${error.message}`);
  }
  /* Registered the moment the file is written, because the refusals below this line are other
     modules' and a refusal ends the process where it is raised: a catch here reaches the ones that
     throw and none of the ones that exit, and both leave the same half-written file behind. It is
     taken off again at the one outcome that keeps the write and at the end of a call that kept it. */
  const onExit = () => {
    try {
      wroteWhole(path, held);
    } catch {
      /* The exit is already under way and there is nowhere left to say this; the explicit restore
         below is the path that reports a failure, and it runs first on every route but a crash. */
    }
  };
  process.on("exit", onExit);
  const keepWrite = () => process.off("exit", onExit);
  const putBack = (why) => {
    keepWrite();
    try {
      wroteWhole(path, held);
    } catch (error) {
      fail(restoreFailed(path, slug, error.message));
    }
    fail(`--flow: ${why} The project file is as it was, so this project is on the flow it had.`);
  };
  const back = flowRead(path);
  if (back !== slug) {
    putBack(`${path} was written and reads back \`flow: ${JSON.stringify(back)}\` rather than `
      + `\`${slug}\`, so nothing was sent.`);
  }
  const said = [`flow: ${back}  ← ${path}`];
  for (const ask of asks) {
    const route = { name: ask.key.slice(0, ask.key.indexOf(".")), key: ask.key.slice(ask.key.indexOf(".") + 1) };
    const resource = RESOURCES[route.name];
    /* Every way the send can fail, not only the one the soft flag catches: the payload guard throws
       before the call goes out, and a throw that walked past here would leave the file written. */
    /* Every way the send can fail, not only the one the soft flag catches: the payload guard throws
       before the call goes out, and a throw that walked past here would leave the file written. */
    const sent = await write("forge_config",
      { action: resource.written, data: resource.bodyFor(route.key, ask.value) }, undefined, true)
      .catch((error) => ({ refused: error.message }));
    /* Read back even where the send said it failed, and decide on the read: a write whose response
       was lost is reported the same way as one the tracker declined, and restoring on that word
       alone would put the flow back over a judgement that did land. */
    const now = await scoped("forge_config", { action: resource.read }, true)
      .catch((error) => ({ refused: error.message }));
    const declined = sent?.refused ? ` ${resource.said} said of the write: ${sent.refused}.` : "";
    if (now?.refused) {
      keepWrite();
      fail(`--flow: ${ask.key} was sent as ${JSON.stringify(ask.value)} and ${resource.said} would `
        + `not say what it now holds, so this setting is unconfirmed: ${now.refused}.${declined} `
        + `${path} sets \`flow: ${slug}\` and is left that way, the write having as likely landed as `
        + `not — read what it holds with \`${READS_IT}\`.`);
    }
    const kept = resource.keysIn(now)[route.key];
    if (notKept(route, ask.value, kept)) {
      putBack(`flow ${slug} asks this project for ${ask.said}, and ${sent?.refused
        ? `${resource.said} declined the write: ${sent.refused}. ${ask.key} reads back `
          + `${JSON.stringify(kept ?? null)}.`
        : notKept(route, ask.value, kept)}`);
    }
    said.push(`${ask.key}: ${shown(kept)}  ← ${resource.said}`);
  }
  if (!asks.length) said.push(`flow ${slug} asks this project for nothing further`);
  keepWrite();
  return said;
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
  const flow = flowPinned().value;
  const clashes = flow === null ? [] : [
    flowPolicyConflict(flow, requiresOf(flow), policy),
    flowJudgeConflict(flow, judgeOf(flow), policy),
  ].filter(Boolean);
  return {
    rows: [...projectRows({ policy, deploy, credentials }),
      ...clashes.map((detail) => ({ level: "miss", label: "flow", detail })),
      ...settingRows(settings), ...pmRows(snapshot, load, graph)],
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

/* The number is checked against the prose before the store is read, because a number is all a
   caller can be wrong about here and a line replaced is gone: this entry has no revision and no
   conditional write, so the only repair is retyping from a scrollback the next session has not got. */
export const refuseUnchecked = (asked) => {
  if (asked.line !== undefined && asked.was === undefined) {
    fail("doctor: --line replaces a line of a store with no undo, so it names the prose that line "
      + "begins with: forge doctor --line <n> <text> --was <the line as it stands>. `forge doctor` "
      + "prints the brief with the numbers <n> counts down its margin.");
  }
  if (asked.was !== undefined && asked.line === undefined) {
    fail("doctor: --was names the prose the line --line replaces begins with, and no --line was "
      + "given. Nothing was sent: forge doctor --line <n> <text> --was <the line as it stands>");
  }
  if (asked.was !== undefined && !asked.was.trim()) {
    fail("doctor: --was is the prose the replaced line begins with, and every line begins with an "
      + "empty one, so this checks nothing. Quote enough of the line to name it alone.");
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
  if (asked.line !== undefined) return replaceBriefLine(asked.line, positionals[0], asked.was);
  return refreshBrief(asked.refresh, { ...asked, pairs });
};
