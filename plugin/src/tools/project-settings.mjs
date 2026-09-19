/* The project's own configuration: the two typed resources the tracker keeps per project, reported
   with the source each key was read from and written one key at a time. Whose the decision is, and
   why a key is never re-declared in a checkout: docs/cli/doctor.md. */
import { accessSync, closeSync, constants, fchmodSync, openSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync }
  from "node:fs";
import { dirname } from "node:path";

import { FROM_PROJECT, Refusal, drainScope, fail, projectFilePath, projectSlug }
  from "../resolve/settings.mjs";
import { pairOf } from "../resolve/flags.mjs";
import { WITH_BODY, WRITES } from "./doctor-keys.mjs";
import {
  PROJECT_KEYS, readAt, readsProjectKey, settingTo, spelled, withKey, withoutKey, withPath,
  writableKey, writablePaths,
} from "./project-file.mjs";
import { FLOW_SLUGS, flowPinned, judgeOf, projectAsksOf, requiresOf } from "../guides/flow.mjs";
import { flowJudgeConflict, flowPolicyConflict } from "../flow/earned.mjs";
import { scoped, write } from "../tracker/rest.mjs";
import {
  briefLines,
  confirmSource,
  projectRows,
  readBrief,
  QA_MODES,
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
  /* This checkout's own file, its value printed as written: "3 entries" is what a read back cannot say. */
  project: {
    said: FROM_PROJECT,
    local: true,
    shown: (value) => JSON.stringify(value ?? null),
  },
};

const NAMES = Object.keys(RESOURCES);
const LOCAL = "project";
/* The two the tracker answers for: `forge doctor` already reports the third key by key. */
const TRACKED = NAMES.filter((name) => !RESOURCES[name].local);

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
  Object.fromEntries(await Promise.all(TRACKED.map(async (name) =>
    [name, await scoped("forge_config", { action: RESOURCES[name].read }, true)])));

const settingRows = (read) => {
  const out = [];
  for (const name of TRACKED) {
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
  NAMES.map((name) => `${name}: ${name === LOCAL
    ? writablePaths().join(", ")
    : Object.keys(RESOURCES[name].keysIn(read[name])).sort().join(", ") || "nothing set"}`);

const ambiguous = (given, both) =>
  `--set: \`${given}\` is a key ${both.join(" and ")} both hold, so a bare name says nothing about `
  + `which one to write and nothing was sent. Name the resource: `
  + both.map((name) => `--set ${name}.${given}=<value>`).join(" or ");

/* No prefix for the project's row: a route offered for a key nothing reads recommends a second refusal. */
const unknownKey = (given, read) =>
  `--set: \`${given}\` is no key any of this project's configuration resources holds, so nothing was `
  + `sent.\n  ${keySets(read).join("\n  ")}\n`
  + "Name the resource to write a key the tracker does not hold yet: "
  + TRACKED.map((name) => `--set ${name}.${given}=<value>`).join(" or ");

/* What this plugin declares it reads out of the project file is known before any call goes out, so a
   bare key of that set is that file's and the tracker is not read for it, which is also the only way
   `slug` is settable in a checkout that names no project yet. docs/cli/doctor.md. */
const projectRoute = (key) => {
  const declared = writableKey(key);
  if (!declared) {
    fail(`--set: \`${key}\` is no key this plugin reads out of ${FROM_PROJECT}, so a value written `
      + `under it would be a line in that file nothing reads. Nothing was written. That file holds:`
      + `\n  ${writablePaths().join(", ")}`);
  }
  if (declared.routed) {
    fail(`--set: \`${key}\` is written by ${declared.routed}. Nothing was written.`);
  }
  return { name: LOCAL, key, ...declared };
};

/* A prefixed key names its resource outright and costs no read — the only way to write a key the
   project does not hold yet, and the only way to write one both hold, a bare key both answer with
   routing nowhere: one is a deploy switch, so picking for the caller is wrong half the time. */
const routeFor = async (given) => {
  const at = given.indexOf(".");
  const head = at > 0 ? given.slice(0, at) : null;
  if (head === LOCAL) return projectRoute(given.slice(at + 1));
  if (head && NAMES.includes(head)) return { name: head, key: given.slice(at + 1) };
  if (readsProjectKey(given)) return projectRoute(given);
  const read = await readSettings();
  const refused = NAMES.filter((name) => read[name]?.refused);
  if (refused.length) {
    fail(`--set: ${refused.map((name) => RESOURCES[name].said).join(" and ")} would not answer, and a `
      + `key is routed by which resource holds it, so nothing was sent: ${read[refused[0]].refused}`);
  }
  const found = TRACKED.filter((name) => Object.hasOwn(RESOURCES[name].keysIn(read[name]), given));
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

const DRAIN_KEY = "drainedBy";
const [INDEPENDENT] = QA_MODES;

/* The one write that moves the judgement the drain key answers to, and therefore the one that clears
   it: the two live in different stores and there is one undo between them. docs/cli/doctor.md. */
const clearsDrain = (route, value) =>
  route.name === "pipeline" && route.key === "qa" && String(value) !== INDEPENDENT
  && drainScope().declared;

const DRAIN_SAID = `\`${DRAIN_KEY}\` in ${FROM_PROJECT}, which names the master that claims this `
  + "project's issues at developed";

/* Proved rewritable before the tracker is sent anything: a judgement that lands over a file this
   could not have rewritten leaves exactly the orphaned drain the pair is cleared together to stop. */
const drainFile = () => {
  const named = projectFilePath();
  if (!named) {
    fail(`--set: this would clear ${DRAIN_SAID}, and no such file was found on the way up from here. `
      + "Nothing was sent. Run this from the checkout that declares it.");
  }
  try {
    const path = realpathSync(named);
    const held = readFileSync(path, "utf8");
    /* The directory too: the replacement writes a sibling and renames it, so a writable file under
       a directory that is not passes a check of the file alone and fails after the tracker write. */
    accessSync(path, constants.W_OK);
    accessSync(dirname(path), constants.W_OK);
    return { path, held };
  } catch (error) {
    return fail(`--set: this would clear ${DRAIN_SAID}, and ${named} could not be read and rewritten, `
      + `so that half is out of reach and nothing was sent: ${error.message}`);
  }
};

/* After the tracker has confirmed and not before: the judgement is the fact the key answers to, so a
   file cleared over a write that never landed would drop a declaration still in force. */
const clearedDrain = (file, kept) => {
  if (!file) return [];
  const at = `pipeline.qa is ${JSON.stringify(kept ?? null)} on the tracker now and ${file.path}`;
  /* Re-read rather than written from the snapshot: this call held those bytes across a network
     round trip, and writing them back would replace whatever another session put there meanwhile.
     Inside the same guard as the replacement, a read that throws leaving the caller exactly as
     uninformed as a write that does. */
  try {
    if (readFileSync(file.path, "utf8") !== file.held) {
      fail(`--set: ${at} changed while that write was in flight, so clearing ${DRAIN_SAID} from the `
        + "bytes this call is holding would put back what another session has already replaced. "
        + `That file was not written — read what it holds and send this again: ${READS_IT}`);
    }
    wroteWhole(file.path, withoutKey(file.held, DRAIN_KEY));
  } catch (error) {
    if (error instanceof Refusal) throw error;
    fail(`--set: ${at} could not be read back and written, so it still sets ${DRAIN_SAID} — a master `
      + `named for a judgement nobody asked for: ${error.message}. Send the same command again once `
      + `that file can be written: ${SET_USAGE}`);
  }
  return [`${DRAIN_KEY}: cleared, the judgement it named a master for having moved  ← ${file.path}`];
};

/* Soft only where the pair is in play, the hard send being every other key's as it was: a send that
   ends the process carries the transport and nothing about the local half it left standing, and
   whether that send landed is exactly what nobody can say afterwards. `writeFlow` sends the same way
   for the same reason. */
const sent = async (resource, route, value, file) => {
  const data = resource.bodyFor(route.key, value);
  if (!file) return write("forge_config", { action: resource.written, data });
  const said = await write("forge_config", { action: resource.written, data }, undefined, true)
    .catch((error) => ({ refused: error.message }));
  if (said?.refused) {
    fail(`--set: ${route.name}.${route.key} was sent as ${JSON.stringify(value)} and the send did `
      + `not answer, so nothing here can say whether the tracker took it: ${said.refused} `
      + `${file.path} is untouched and still sets ${DRAIN_SAID}. Read which judgement the tracker `
      + `holds and send this again against that: ${READS_IT}`);
  }
  return said;
};

const projectFile = (key) => {
  const named = projectFilePath();
  if (!named) {
    fail(`--set: \`${key}\` is a key of ${FROM_PROJECT} and no such file was found on the way up from `
      + "here, so nothing was written. Run this from a checkout that has one.");
  }
  let path = named;
  try {
    path = realpathSync(named);
    const held = readFileSync(path, "utf8");
    const parsed = JSON.parse(held);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      fail(`--set: ${path} holds ${Array.isArray(parsed) ? "a list" : JSON.stringify(parsed)} where a `
        + `JSON object with this project's keys in it belongs, and \`${key}\` is a key of that object. `
        + "Nothing was written.");
    }
    return { path, held, parsed };
  } catch (error) {
    if (error instanceof Refusal) throw error;
    return fail(`--set: ${path} is the file \`${key}\` is a key of and this could not read it as JSON, `
      + `so nothing was written: ${error.message}`);
  }
};

/** The one key written into the file's own text and read back off it, judged between the two by the
 *  reader that already reads it: what this took and that reader refuses would fail later instead. */
const projectWrite = (route, value) => {
  const { path, held, parsed } = projectFile(route.key);
  const would = settingTo(parsed, route.segments, value);
  if (would.blocked) {
    fail(`--set: \`${route.key}\` goes inside \`${would.blocked}\`, which this file holds as `
      + `${JSON.stringify(would.holds)} rather than as a table. Nothing was written: ${path}`);
  }
  const refusal = PROJECT_KEYS[route.top].judge(would.parsed[route.top]);
  if (refusal) fail(`--set: ${refusal} Nothing was written: ${path} is as it was.`);
  const text = withPath(held, route.segments, value);
  if (text === null) {
    fail(`--set: ${path} parses as JSON and this could not find where \`${route.key}\` sits in its `
      + "text, so writing it would mean re-serializing the whole document and reflowing every key "
      + `beside it. Nothing was written — set this one by hand: ${READS_IT} prints what it holds.`);
  }
  try {
    wroteWhole(path, text);
  } catch (error) {
    fail(`--set: ${path} is the file \`${route.key}\` is a key of and this could not write it, so `
      + `nothing was written: ${error.message}`);
  }
  /* Off the disk, never off the text this call composed: a document declaring one key twice parses to
     the last of them, so an edit to the first would report set a value nothing reads. */
  const back = projectFile(route.key);
  const kept = readAt(back.parsed, route.segments);
  if (JSON.stringify(kept) !== JSON.stringify(value)) {
    wroteWhole(path, held);
    fail(`--set: ${route.key} was written as ${JSON.stringify(value)} and ${path} reads back `
      + `${JSON.stringify(kept ?? null)}, so that file declares the key somewhere this write did not `
      + `reach. It is back as it was — read what it holds and set that key by hand: ${READS_IT}`);
  }
  return [`${route.name}.${route.key}: ${RESOURCES[LOCAL].shown(kept)}  ← ${path}`];
};

/** Read back off the resource's own route before it is reported set: this tracker's pipeline schema
 *  drops a key it does not declare, so a write that answered 200 and kept nothing would print as a
 *  setting that took. */
export const writeSetting = async (given) => {
  /* The split is the shared one, this verb adding only where to look the pair up (ISS-1449). */
  const { key: asked, value: raw } = pairOf(given, "--set", {
    refusing: (said) => fail(`${said} Nothing was sent: ${SET_USAGE}`),
  });
  const route = await routeFor(asked);
  if (!route.key) fail(`--set: \`${asked}\` names the resource and no key of it. ${SET_USAGE}`);
  const resource = RESOURCES[route.name];
  if (resource.local) return projectWrite(route, spelled(route.takes, raw));
  /* After the routing: the file above is the one resource that answers without a slug. */
  projectSlug();
  const value = valueFor(resource, raw);
  const file = clearsDrain(route, value) ? drainFile() : null;
  await sent(resource, route, value, file);
  const now = await scoped("forge_config", { action: resource.read }, true);
  if (now?.refused) {
    fail(`--set: ${route.name}.${route.key} was sent and ${resource.said} would not answer the read `
      + `back, so nothing here can say what it now holds: ${now.refused}`
      + (file ? `. ${file.path} still sets ${DRAIN_SAID}, and whether that now names a master for a `
        + `judgement nobody asked for is what the read would have said: ${READS_IT}` : ""));
  }
  const kept = resource.keysIn(now)[route.key];
  const why = notKept(route, value, kept);
  if (why) {
    fail(`--set: ${why}`
      + (file ? ` ${file.path} is untouched and still sets ${DRAIN_SAID}, which is right where the `
        + `read back is the tracker's own word and wrong where it is not: ${READS_IT}` : ""));
  }
  return [`${route.name}.${route.key}: ${shown(kept)}  ← ${resource.said}`, ...clearedDrain(file, kept)];
};

const FLOW_USAGE = "forge doctor --flow <slug>";
const READS_IT = "forge doctor";

/** What the one failure this route cannot undo says. Exported so a case can read it: a write of a file that succeeds and a write of the same bytes back that does not is a pair no call through the CLI can be made to produce, and a state nobody is told about is the thing being avoided. */
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

/* Through a sibling and renamed into place, the install and the restore alike: a plain write opens the destination truncating, so one that fails part way leaves neither the bytes it replaced nor the ones it was writing, and a restore doing that would destroy the very state its refusal is about to report. The mode is set on the handle rather than asked for at creation, a umask otherwise narrowing a file this project shares. */
const wroteWhole = (path, text) => {
  const temporary = `${path}.${process.pid}.tmp`;
  try {
    const mode = statSync(path).mode & 0o777;
    const handle = openSync(temporary, "w", mode);
    try {
      fchmodSync(handle, mode);
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

/* Refused before a byte is written anywhere: an undeclared slug, and a project file this process cannot read or parse. What is left after these is the tracker, the half no check here can make. */
const flowFile = (slug) => {
  if (!FLOW_SLUGS.includes(slug)) {
    fail(`--flow: \`${slug}\` is no flow this copy serves — it serves ${FLOW_SLUGS.join(", ")}. `
      + `Nothing was sent: ${FLOW_USAGE}`);
  }
  const named = projectFilePath();
  if (!named) {
    fail(`--flow: \`flow\` is a key of ${FROM_PROJECT} and no such file was found on the way up from `
      + `here, so nothing was written and nothing was sent. Run this from a checkout that has one.`);
  }
  /* The file the link points at and not the link: the resolver read through it, and a rename onto
     the name would put a regular file where the link was and leave what it pointed at untouched. */
  let path = named;
  let held = null;
  let parsed = null;
  try {
    path = realpathSync(named);
    held = readFileSync(path, "utf8");
    parsed = JSON.parse(held);
  } catch (error) {
    fail(`--flow: ${path} is the file \`flow\` is a key of and this could not read it as JSON, so `
      + `that half is out of reach and nothing was sent: ${error.message}`);
  }
  /* A list and a bare string are JSON this parses and no document a key can be set in, and the resolver takes either: an insert made anyway lands a property in a file with no object to hold it, which is the one way this route destroys a setting rather than failing to write one. */
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    fail(`--flow: ${path} holds ${Array.isArray(parsed) ? "a list" : JSON.stringify(parsed)} where a `
      + "JSON object with this project's keys in it belongs, and `flow` is a key of that object. "
      + "Nothing was written and nothing was sent.");
  }
  return { path, held };
};

/** The flow and everything that flow asks the project for, in one call. The checkout's file goes first because its undo is local and certain, and a tracker that says the setting did not land sends the previous bytes straight back; one that says nothing leaves the flow standing, putting it back being a guess against the half that may well have landed. docs/cli/the-flow-axis.md. */
export const writeFlow = async (slug) => {
  const { path, held } = flowFile(slug);
  const asks = projectAsksOf(slug);
  /* After the file, the slug being a key of that same file: a checkout without one is told about the file it has not got rather than about a key of a file nobody would find. */
  if (asks.length) projectSlug();
  try {
    wroteWhole(path, withKey(held, "flow", slug));
  } catch (error) {
    fail(`--flow: ${path} is the file \`flow\` is a key of and this could not write it, so that half `
      + `is out of reach and nothing was sent: ${error.message}`);
  }
  /* Registered the moment the file is written, the refusals below this line being other modules' and a refusal ending the process where it is raised: a catch here reaches the ones that throw and none of the ones that exit, and both leave the same half-written file. Taken off again at the one outcome that keeps the write and at the end of a call that kept it. */
  const onExit = () => {
    try {
      wroteWhole(path, held);
    } catch {
      /* The exit is under way and there is nowhere left to say this; the explicit restore below reports a failure, and it runs first on every route but a crash. */
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
    /* Every way the send can fail, not only the one the soft flag catches: the payload guard throws before the call goes out, and a throw walking past here would leave the file written. */
    const sent = await write("forge_config",
      { action: resource.written, data: resource.bodyFor(route.key, ask.value) }, undefined, true)
      .catch((error) => ({ refused: error.message }));
    /* Read back even where the send said it failed, and decide on the read: a write whose response was lost is reported exactly as one the tracker declined, and restoring on that word alone would put the flow back over a judgement that did land. */
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
    const why = notKept(route, ask.value, kept);
    if (why) {
      putBack(`flow ${slug} asks this project for ${ask.said}, and ${sent?.refused
        ? `${resource.said} declined the write: ${sent.refused}. ${ask.key} reads back `
          + `${JSON.stringify(kept ?? null)}.`
        : why}`);
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
