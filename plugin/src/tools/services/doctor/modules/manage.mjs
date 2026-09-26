/* The three writes of `forge doctor modules` — add, edit, remove — each refused before it sends
   where it would strand an issue or a child, and read back after; and the subject's own parse.
   docs/cli/modules.md. */
import { fail } from "../../../../resolve/settings.mjs";
import { flags, partition } from "../../../../resolve/flags.mjs";
import { scoped, write } from "../../../../tracker/rest.mjs";
import { writeField } from "../../../../tracker/field-write.mjs";
import { UNSET } from "../../../../rank/weights.mjs";
import { MODULE, moduleNamed } from "../../../../tracker/modules/definition.mjs";
import { carriersOf, openCounts } from "../../../../tracker/modules/attribution.mjs";
import { SAYS } from "../subjects.mjs";
import { NONE, VERB, defined, moduleLines } from "./reading.mjs";

const WRITES = ["add", "edit", "remove"];

/* Which write each flag belongs to: a flag read by no write this call makes is refused, not dropped. */
const BELONGS = { parent: ["add", "edit"], description: ["add", "edit"], to: ["remove"] };

const named = (modules, name, what) => {
  const { found, refusal } = moduleNamed(modules, name, what);
  if (refusal) fail(`${VERB}: ${refusal} Nothing was sent.`);
  return found;
};

/* The two words a module may not be called: `none` is what --parent and --to take for no module, and
   `unset` is the rank's row for an issue carrying none, so a module under either name could be
   neither selected nor weighed as itself. */
const RESERVED = [NONE, UNSET];

/* `none` read as no module, and refused where the tracker holds a module by that name, which the
   word could then mean either way. */
const noneMeant = (modules, flag) => {
  if (modules.some((one) => one.name === NONE)) {
    fail(`${VERB}: ${flag} none means no module, and this project also defines a module named \`none\`, so the `
      + "word names both. Nothing was sent. Rename that module on the tracker's own screen, then send this again.");
  }
  return true;
};

/* The parent a write sends: `none` is the top, any other word a module this project defines. */
const parentFor = (modules, given) => (given === undefined ? undefined
  : given === NONE && noneMeant(modules, "--parent") ? null : named(modules, given, "--parent").id);

/* The module as the tracker now lists it, held to what the write posted — a project writing its
   prose in another language posts a rewrite of the description typed — since a field the tracker
   took and did not keep reads the same to a caller as one it kept, unless this says otherwise. */
const readBack = async (id, what, data) => {
  const found = (await defined()).find((one) => one.id === id);
  if (!found) fail(`${VERB}: the tracker answered the ${what} and a read of its labels holds no module ${id}.`);
  const differ = Object.keys(data).filter((key) => key !== "kind" && (found[key] ?? null) !== data[key]);
  if (differ.length) {
    fail(`${VERB}: the tracker answered the ${what}, and the module it lists does not hold the `
      + `${differ.join(" and ")} sent: ${differ.map((key) => `${key} ${JSON.stringify(found[key] ?? null)}`).join(", ")}.`);
  }
  return found;
};

const said = (module, modules) => `${module.name}, parent ${modules.find((one) => one.id === module.parentId)?.name
  ?? NONE}, ${module.description ? `described "${module.description}"` : "no description"}`;

const added = async (modules, asked) => {
  if (!asked.add.trim()) fail(`${VERB}: --add takes the module's name, not an empty word.`);
  if (RESERVED.includes(asked.add)) {
    fail(`${VERB}: \`${asked.add}\` is ${asked.add === NONE ? "what --parent and --to take for no module"
      : "the rank's row for an issue carrying no module"}, so a module by that name could not be told from it. `
      + "Nothing was sent: name it otherwise.");
  }
  if (modules.some((one) => one.name === asked.add)) {
    fail(`${VERB}: \`${asked.add}\` is a module of this project already. Nothing was sent: --edit changes it.`);
  }
  const data = { name: asked.add, kind: MODULE,
    ...(asked.parent === undefined ? {} : { parentId: parentFor(modules, asked.parent) }),
    ...(asked.description === undefined ? {} : { description: asked.description || null }) };
  let posted = data;
  const answer = await write("forge_labels", { action: "create", data }, (sent) => (posted = sent ?? data));
  const back = await readBack(answer?.id, "create", posted);
  return `Added ${said(back, await defined())}, read back off the tracker.`;
};

const edited = async (modules, asked) => {
  const module = named(modules, asked.edit, "--edit");
  if (asked.parent === undefined && asked.description === undefined) {
    fail(`${VERB}: --edit changes what --parent or --description gives it, and this call gives neither. Nothing was sent.`);
  }
  const data = { ...(asked.parent === undefined ? {} : { parentId: parentFor(modules, asked.parent) }),
    ...(asked.description === undefined ? {} : { description: asked.description || null }) };
  let posted = data;
  await write("forge_labels", { action: "update", labelId: module.id, data }, (sent) => (posted = sent ?? data));
  const back = await readBack(module.id, "edit", posted);
  return `Edited ${said(back, await defined())}, read back off the tracker.`;
};

/* The label set an issue is written back with: the removed module swapped for the target, keeping
   whether it was primary, or dropped where the target is none. A label is sent by id, and only a
   module that is primary as the object that says so. */
export const movedLabels = (labels, removed, target) => {
  const was = labels.find((one) => one.id === removed);
  const kept = labels.filter((one) => one.id !== removed);
  const already = target && kept.find((one) => one.id === target);
  const next = target && !already
    ? [...kept, { id: target, isPrimary: Boolean(was?.isPrimary) }]
    : kept.map((one) => (one.id === target && was?.isPrimary ? { ...one, isPrimary: true } : one));
  return next.map((one) => (one.isPrimary ? { labelId: one.id, isPrimary: true } : one.id));
};

/* One carrier moved through the one writer of an issue's fields, which reads the set back and refuses
   a set that did not land; the module is then not deleted, and the same call again moves the rest. */
const moveOne = async (row, module, target) => {
  const labels = (await scoped("forge_issues", { action: "get", documentId: row.documentId, fields: [] }))?.labels ?? [];
  await writeField(row.documentId, "labels", movedLabels(labels, module.id, target?.id ?? null), {
    ref: row.issueId,
    refuse: (said) => fail(`${VERB}: ${row.issueId} did not move off ${module.name}: ${said} So ${module.name} `
      + "was not deleted. The same call again moves the issues still carrying it."),
  });
};

const removed = async (modules, asked) => {
  const module = named(modules, asked.remove, "--remove");
  const children = modules.filter((one) => one.parentId === module.id);
  if (children.length) {
    fail(`${VERB}: ${module.name} holds ${children.length} child module(s), which the tracker would move to `
      + `the top unsaid. Nothing was sent. Move each first: ${children.map((one) =>
        `\`forge doctor modules --edit ${one.name} --parent <module|none>\``).join(", ")}.`);
  }
  const target = asked.to === undefined || (asked.to === NONE && noneMeant(modules, "--to"))
    ? null : named(modules, asked.to, "--to");
  if (target?.id === module.id) fail(`${VERB}: --to names the module being removed. Nothing was sent.`);
  const carriers = await carriersOf(module.id);
  if (!carriers.whole) fail(`${VERB}: the walk of the issues carrying ${module.name} stopped short, so which issues it would strand is unknown. Nothing was sent.`);
  if (carriers.rows.length && asked.to === undefined) {
    fail(`${VERB}: ${carriers.rows.length} issue(s) carry ${module.name}, and the tracker refuses a delete `
      + "while any does. Nothing was sent. Say where they go: `forge doctor modules --remove "
      + `${module.name} --to <module>\` keeps each on that module, primary where it was, or \`--to none\` takes it off them.`);
  }
  for (const row of carriers.rows) await moveOne(row, module, target);
  const left = await carriersOf(module.id);
  if (left.rows.length || !left.whole) fail(`${VERB}: ${module.name} is still carried after the moves, so it was not deleted.`);
  await write("forge_labels", { action: "delete", labelId: module.id });
  if ((await defined()).some((one) => one.id === module.id)) {
    fail(`${VERB}: the tracker answered the delete and still lists ${module.name}.`);
  }
  const moved = carriers.rows.length
    ? ` ${carriers.rows.length} issue(s) moved ${target ? `to ${target.name}` : "off it"}, each read back.`
    : asked.to === undefined ? "" : " No issue carried it, so --to moved nothing.";
  return `Removed ${module.name}, read back gone off the tracker.${moved}`;
};

const ACTS = { add: added, edit: edited, remove: removed };

/** `forge doctor modules [...]`, handed everything after the subject's name. */
export const modulesSubject = async (argv) => {
  const usage = SAYS.modules;
  const { positionals } = partition(argv, [], { verb: VERB, usage });
  if (positionals.length) fail(`${VERB}: \`${positionals[0]}\` names no flag. ${usage.split("\n")[0]}`);
  const asked = flags(argv, VERB, [], { usage });
  const writes = WRITES.filter((one) => asked[one] !== undefined);
  if (writes.length > 1) {
    fail(`${VERB}: --${writes[0]} and --${writes[1]} are two writes, and a call makes one. Nothing was sent.`);
  }
  for (const [flag, owners] of Object.entries(BELONGS)) {
    if (asked[flag] !== undefined && !owners.includes(writes[0])) {
      fail(`${VERB}: --${flag} belongs to ${owners.map((one) => `--${one}`).join(" or ")}, and this call `
        + `${writes[0] ? `makes --${writes[0]}` : "writes nothing"}. Nothing was sent.`);
    }
  }
  const modules = await defined();
  if (writes[0]) console.log(await ACTS[writes[0]](modules, asked));
  const now = writes[0] ? await defined() : modules;
  for (const line of moduleLines(now, await openCounts())) console.log(line);
};
