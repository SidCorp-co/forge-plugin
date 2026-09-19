/* README's Configuration section shows the project file, so that block claims its whole key set — a
   claim that held at five keys while the code read fifteen, the one a box must set among the ten it
   never named (ISS-1618). A route past the ones below would carry keys this walk cannot see, which
   reads like a section naming them all, so it is refused by name. */
const BY_NAME = /forgeJson\(\)\.parsed\?\.(\w+)/gu;
const AT_CALL = /\bwritten\("(\w+)"\)/gu;
const OFF_FILE = /projectFileAt\([^()]*\)\?\.(\w+)/gu;
const BOUND = /\bconst (\w+) = projectFileAt\(/gu;

const A_READ = /forgeJson\(\)\.parsed|projectFileAt\(/u;

/* The two reads taking the parse whole, keys elsewhere: the helper AT_CALL matches, and the accessor
   itself. Escaped, so this module's lines are prose about them rather than reads to explain. */
const WHOLE = [/^const parsed = forgeJson\(\)\.parsed;$/u, /^export const projectFileAt = /u];

const found = (text, pattern) => [...text.matchAll(pattern)].map((one) => one[1]);

/* Binding the parse to a local is legitimate; every USE of it has to name a key, since one
   recognised access is no evidence about the ones beside it. */
const DOTTED = (name) => new RegExp(String.raw`\b${name}\??\.(\w+)`, "gu");
/* Quoted and closed, so `file[key]` is refused rather than inventoried as the key `key`. */
const BRACKET = (name) => new RegExp(String.raw`\b${name}(?:\?\.)?\["(\w+)"\]`, "gu");
const bareOf = (name) => new RegExp(String.raw`\b${name}\b`, "gu");

const keysOff = (text, name) => found(text, DOTTED(name)).concat(found(text, BRACKET(name)));

const readIn = (text) => found(text, BY_NAME)
  .concat(found(text, AT_CALL), found(text, OFF_FILE),
    ...found(text, BOUND).map((name) => keysOff(text, name)));

const spent = (line, name) => line.match(bareOf(name))?.length ?? 0;

const REFUSAL = " reads the project file by a route this check does not know, so every key it takes"
  + " is checked by nothing. Read the key by name there, or teach"
  + " plugin/src/checks/docs/project-keys.mjs the route: ";

const unexplainedIn = (text, path) => {
  const names = found(text, BOUND);
  const out = [];
  text.split("\n").forEach((line, index) => {
    const at = `${path}:${index + 1}`;
    const said = `${at}${REFUSAL}${line.trim().slice(0, 80)}`;
    const binds = found(line, BOUND);
    if (A_READ.test(line) && !WHOLE.some((one) => one.test(line.trim()))
      && readIn(line).length === 0 && binds.length === 0) out.push(said);
    for (const name of names) {
      const opaque = spent(line, name) - keysOff(line, name).length
        - binds.filter((one) => one === name).length;
      if (opaque > 0) out.push(said);
    }
  });
  return out;
};

/** Every top-level key of the project file this code reads, and every read the walk could not
 *  account for. `sources` is `{ path, text }` per file, so the caller owns which tree is walked. */
export const keysRead = (sources) => {
  const keys = new Set();
  const unexplained = [];
  for (const { path, text } of sources) {
    for (const key of readIn(text)) keys.add(key);
    unexplained.push(...unexplainedIn(text, path));
  }
  return { keys: [...keys].sort(), unexplained, files: sources.length };
};

const SECTION = /^## Configuration$/mu;
const PROJECT = /^\*\*Project\*\*/mu;
const NEXT = /^#{2,3} /mu;
const BLOCK = /```json\n([\s\S]*?)```/u;
/* The form a retirement takes, so a key named in passing on that line is not read as one. */
const RETIRED = /`([a-z][A-Za-z0-9]*)` is retired\b/gu;

/** What that section names: the keys its example shows, and the ones it calls retired. Null where
 *  the section or its example is gone, which the caller reports rather than reads as no keys. */
export const keysDocumented = (readme) => {
  const opens = SECTION.exec(readme);
  if (!opens) return null;
  const after = readme.slice(opens.index + opens[0].length);
  const ends = NEXT.exec(after);
  const section = ends ? after.slice(0, ends.index) : after;
  const project = PROJECT.exec(section);
  if (!project) return null;
  const part = section.slice(project.index);
  const block = BLOCK.exec(part);
  if (!block) return null;
  let shown = null;
  try {
    shown = Object.keys(JSON.parse(block[1]));
  } catch {
    return null;
  }
  const retired = found(part, RETIRED);
  return { shown: shown.sort(), retired: [...new Set(retired)].sort() };
};

const WHERE = "README.md's Configuration section";
const ADD = "Add it to the JSON example under **Project** there, with what it decides and what its"
  + " absence means.";

const WRITTEN = "the table `forge doctor --set` writes this file through,"
  + " `PROJECT_KEYS` in plugin/src/tools/project-file.mjs";

/* The third side. A key read and not in that table is one the report names and no verb can set, which
   is the hand edit this whole route exists to end; a key in it and read nowhere writes a line into
   somebody's file that nothing will ever look at. */
const writableProblems = (read, written) => {
  const out = [];
  for (const key of read.keys) {
    if (!written.includes(key)) {
      out.push(`\`${key}\` is a project-file key this plugin reads and ${WRITTEN} does not name, so`
        + " nothing can write it and the report that prints it offers no route. Give it a row there,"
        + " with the paths under it a value may be written to and the reader that judges one");
    }
  }
  for (const key of written) {
    if (!read.keys.includes(key)) {
      out.push(`${WRITTEN} names \`${key}\` and this plugin reads no such key, so a value written`
        + " under it would be a line in somebody's project file that nothing ever looks at. Take the"
        + " row out, or name it where the code reads it");
    }
  }
  return out;
};

/** Every way the three sides can disagree, each naming the side to change. An empty walk is one of
 *  them: a check whose patterns went stale reports a clean repository and reads exactly like one. */
export const projectKeyProblems = ({ read, documented, written }) => {
  const out = [];
  if (!documented) {
    return [`${WHERE} carries no **Project** heading with a json example under it, so the keys this`
      + " plugin reads are compared with nothing. Put the example back, or move this check to"
      + " wherever that list now lives"];
  }
  if (read.keys.length === 0) {
    out.push(`plugin/src/checks/docs/project-keys.mjs matched no project key in ${read.files} source`
      + " file(s), so it is reporting a clean repository off an empty walk. Its patterns name a"
      + " route this code no longer takes — fix them before trusting this check again");
  }
  out.push(...read.unexplained, ...writableProblems(read, written ?? []));
  const named = [...documented.shown, ...documented.retired];
  for (const key of read.keys) {
    if (!named.includes(key)) {
      out.push(`\`${key}\` is a project-file key this plugin reads and ${WHERE} names nowhere.`
        + ` ${ADD}`);
    }
  }
  for (const key of documented.shown) {
    if (!read.keys.includes(key)) {
      out.push(`${WHERE} shows \`${key}\` in its example and this plugin reads no such key. Take it`
        + " out of the example, or name it where the code reads it");
    }
  }
  for (const key of documented.retired) {
    if (!read.keys.includes(key)) {
      out.push(`${WHERE} calls \`${key}\` retired and this plugin reads it nowhere at all, so the`
        + " sentence saying so is telling a reader about a key that never reaches anything. Cut the"
        + " sentence");
    }
  }
  return out;
};
