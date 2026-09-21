/* The half `routes.mjs` cannot state about itself: which of the tracker's own column names a row
   shaper asks for, and which the tracker answers that no shaper asks for. Both halves are silent in
   the code — a name the tracker retired reads `undefined` and travels on as a null, a name it grew
   is dropped before a caller sees it — and the silence has cost three issues. docs/cli/the-name-join.md.

   Pure: every function here is handed the row it reads, so nothing in this module reaches the
   transport and no step of the gate sends a request for it. */

import { ROUTES, answersOf } from "./routes.mjs";

/** The two columns of the project row that hold a credential. Dropped from both directions by name
 *  and struck from every line the reporter renders, rather than left out by a shaper's silence: the
 *  moment a reader reports on names a shaper drops, exclusion-by-omission becomes a secret's name in
 *  a diagnostic row somebody pastes. Neither is a name this CLI has any reading for (ISS-1962). */
export const WITHHELD = ["webhookSecret", "apiKey"];

/* Short enough to collide with ordinary report text, so not struck out of it: blanking every
   occurrence of a three-character value would blank words a reader needs. That bound is safe only
   because no line here interpolates a row's value — the lines are built from the row's own key set
   and from fixed text — so the strike is the second guard and `heldAsName` below is the first: the
   one way a value can reach a line is by also being the name of a column, and a name reading as a
   value this row holds is withheld whatever its length. */
const TOO_SHORT = 6;

/** The values the row holds under those two names, whole, at any length. */
const secretsIn = (row) => WITHHELD
  .map((name) => row?.[name])
  .filter((held) => typeof held === "string" && held !== "");

/** Whether a name of this row may not be printed: one of the two, or one that reads as a value the
 *  row holds under one of them. Both are counted where they are not named. */
export const heldAsName = (row, name) =>
  WITHHELD.includes(name) || secretsIn(row).includes(name);

/** Every line the reporter renders passes this, so no reporting path can carry one of those names or
 *  a value the row held under one. Built from the row where there is one; a read that refused has no
 *  row and strikes the names alone. */
export const striking = (row) => {
  /* Values before names, and the longest value first. A value that carries its own column's name in
     it — a key written `apiKey-1234` — has that name struck out of it by a names-first pass, and then
     no longer matches the value the pass was about, so the rest of it survives; and a value that is a
     prefix of another leaves the other's tail behind for the same reason. */
  const values = secretsIn(row)
    .filter((held) => held.length > TOO_SHORT)
    .sort((one, other) => other.length - one.length);
  return (text) => [...values, ...WITHHELD]
    .reduce((held, one) => held.split(one).join("[withheld]"), String(text));
};

/** A stand-in for the row that records every top-level name a shaper asks it for. This is the whole
 *  of how the names a shaper reads are known, and it is why they are listed nowhere: a list is a
 *  second copy that goes stale, and reading the destructuring patterns off the source scores
 *  `configOf` wrong twice over — it spreads `agentConfig` after its eight names, so a nested value
 *  equal to one of them hides both, and an empty one hides itself. Asking is the read: `has` and the
 *  descriptor trap are here because `pick` asks with `Object.hasOwn` and never reads the property,
 *  and `ownKeys` is a shaper taking the row whole, which asks for every name there is. */
export const recording = (row) => {
  const asked = new Set();
  let whole = false;
  const note = (name) => {
    if (typeof name === "string") asked.add(name);
  };
  return {
    stand: new Proxy(row ?? {}, {
      get: (held, name, self) => {
        note(name);
        return Reflect.get(held, name, self);
      },
      has: (held, name) => {
        note(name);
        return Reflect.has(held, name);
      },
      getOwnPropertyDescriptor: (held, name) => {
        note(name);
        return Reflect.getOwnPropertyDescriptor(held, name);
      },
      ownKeys: (held) => {
        whole = true;
        return Reflect.ownKeys(held);
      },
    }),
    asked: () => ({ names: [...asked], whole }),
  };
};

/* One reason, nine names: the project reading is the one a caller asking about the project gets, and
   the configuration reading answers what a run needs to work inside a checkout. A column the first
   carries and the second does not is not a blind spot of the second unless something working in a
   checkout wants it. */
const THE_OTHER_READING = "the project reading carries it, and this one answers what a run working "
  + "inside a checkout needs";

/* Chosen, per shaper, each with the reason somebody chose it — the name half of the `differs` table
   in the route test, which declares a chosen difference of value. A name here the shaper turns out
   to ask for fails there, and so does one the dated capture's row does not carry: a declaration
   nobody re-reads is how a difference gets forgotten. The two withheld names are on neither list
   because they are struck before either direction is read, so nothing is left for a reason to
   explain. */
export const CHOSEN = {
  "forge_projects.get": {
    agentConfig: "the configuration reading is this document's reader, and a row answering both the "
      + "columns and the document would give two readings of one setting",
    repoUrl: "a checkout's remote is git's answer here and never the tracker's; nothing clones from "
      + "this CLI",
    issuePrefix: "every key this CLI prints arrives on the row already spelled, so nothing derives one",
    orgRole: "the role on the project is what a refusal is read against, and this is the role in the "
      + "organisation above it",
    members: "no verb of this CLI addresses a person: work is taken under a lease and never assigned",
    labels: "the project's own vocabulary, where an issue arrives carrying the labels it has; nothing "
      + "here offers a label to choose from",
    devicePool: "what the runner load answers about, one row of the project reading already",
  },
  "forge_config.get": {
    orgId: THE_OTHER_READING,
    createdBy: THE_OTHER_READING,
    createdAt: THE_OTHER_READING,
    description: THE_OTHER_READING,
    role: THE_OTHER_READING,
    archivedAt: THE_OTHER_READING,
    workspaceSetup: THE_OTHER_READING,
    defaultDeviceId: THE_OTHER_READING,
    environments: THE_OTHER_READING,
    repoUrl: "a checkout's remote is git's answer here and never the tracker's",
    issuePrefix: "every key this CLI prints arrives on the row already spelled",
    orgRole: "the role on the project is what a refusal is read against",
    members: "no verb of this CLI addresses a person",
    labels: "the project's own vocabulary, and an issue arrives carrying its own labels",
    devicePool: "what the runner load answers about",
  },
};

/** The two shapers this reads, and the one route both of them project: they build the identical path,
 *  so one reading of the row answers for both. A third shaper is one row here. */
export const SUBJECTS = Object.keys(CHOSEN);

/** What one shaper asked the row for, and what the row answered that it never asked for. Neither
 *  direction is inferred from the shape of the answer: the first is the names asked for that the row
 *  does not carry, the second the names the row carries that were not asked for. */
export const joined = (key, row, declared = CHOSEN[key] ?? {}) => {
  const held = recording(row);
  answersOf(ROUTES[key])({ page: held.stand }, {});
  const { names, whole } = held.asked();
  const carried = Object.keys(row ?? {}).filter((name) => !heldAsName(row, name));
  const asked = names.filter((name) => !heldAsName(row, name));
  const dropped = whole ? [] : carried.filter((name) => !asked.includes(name));
  return {
    key,
    unserved: asked.filter((name) => !Object.hasOwn(row ?? {}, name)),
    undeclared: dropped.filter((name) => !Object.hasOwn(declared, name)),
    declared: dropped.filter((name) => Object.hasOwn(declared, name)),
    read: asked.filter((name) => Object.hasOwn(row ?? {}, name)),
    withheld: Object.keys(row ?? {}).filter((name) => heldAsName(row, name)).length,
  };
};

/* Taken by hand: no verb of this CLI and no script of this repository writes a wire capture, which
   is ISS-2100's subject. Until one does, the refusal below names the file and the route rather than a
   command, because a command that does not do it is worse than prose that does. */
const CAPTURE = "plugin/test/fixtures/rest/projects-get.json";

/** A declaration that stopped being true, for the suite to fail on. Two shapes: a name the shaper
 *  does ask for, and a name the capture cannot prove either way because its row never carried one. */
export const staleDeclarations = (row, taken, chosen = CHOSEN) =>
  Object.keys(chosen).flatMap((key) => {
    const { declared, read } = joined(key, row, chosen[key]);
    return Object.keys(chosen[key]).flatMap((name) => {
      if (read.includes(name)) {
        return [`${key} declares ${name} as a chosen drop and the shaper asks the row for it`
          + " — drop the declaration, the shaper having grown a reader for it"];
      }
      if (!declared.includes(name)) {
        return [`${key} declares ${name} as a chosen drop and the capture taken ${taken} carries no`
          + " such column, so nothing here can tell a chosen drop from a column the tracker retired"
          + ` — re-take ${CAPTURE} from GET /projects/:id through this CLI's own transport, with both`
          + " credential columns deleted before the body reaches disk and `taken` set to the day, or"
          + " drop the declaration"];
      }
      return [];
    });
  });

/* One route, both shapers: they build the identical path, so the row is read once. */
const ROUTE = "GET /projects/:id";

/* Printed rather than left to a reader, on the same reasoning the row below it is: a reader told
   nothing cannot tell a reading that covered the nested shape from one that never looked. Nineteen of
   this credential's thirty-two projects answer null for a configured blob, and a null carries no
   names on the day it is read (ISS-1970, comment 2). */
const THE_BOUND = "the row's own columns and nothing inside any of them, so a blob the row answers "
  + "null for says nothing here about its own keys";

const WHY_UNSERVED = "each reads undefined on every project and travels on as a null, which is what "
  + "a retired column does — delete it from the shaper, or ask the tracker which name took over";

const WHY_UNDECLARED = "each is either a difference somebody chose, and then it is declared with its "
  + "reason in `CHOSEN` of plugin/src/tracker/name-join.mjs, or a blind spot nobody chose";

/* The count and never the names: a reader is owed the knowledge that two columns of this row are
   never reported on, and nothing beyond it. The row it sits on is the one that always prints, the
   withheld being a property of the reading rather than of a shaper that happened to come out clean. */
const withheld = (held) => (held ? `, ${held} withheld unnamed` : "");

/** The rows, given a reading of the row and the day it was read on. The reader is passed in rather
 *  than reached for, so the count of readings is a thing a case can hold this to. */
export const nameJoinRows = async (read, today) => {
  const got = await read();
  const strike = striking(got?.parts?.page);
  const said = (level, detail) => ({ level, label: "name join", detail: strike(detail) });
  if (got?.refused) {
    return [said("note", `${ROUTE} did not answer, so neither direction of the name join was read `
      + "— not a reading that passed. The endpoint and the credential are `forge doctor machine`'s")];
  }
  const row = got?.parts?.page;
  const shapers = SUBJECTS.map((key) => joined(key, row));
  const rows = [said("ok", `read ${today} off ${ROUTE}${withheld(shapers[0].withheld)}, reaching `
    + THE_BOUND)];
  for (const held of shapers) {
    const key = held.key;
    if (held.unserved.length) {
      rows.push(said("miss", `${key} asks the row for ${held.unserved.join(", ")}, which it does not `
        + `carry: ${WHY_UNSERVED}`));
    }
    if (held.undeclared.length) {
      rows.push(said("miss", `${key} never asks for ${held.undeclared.join(", ")}, which the row `
        + `carries: ${WHY_UNDECLARED}`));
    }
    if (!held.unserved.length && !held.undeclared.length) {
      rows.push(said("ok", `${key}: ${held.read.length} asked for, `
        + `${held.declared.length} dropped by declaration`));
    }
  }
  return rows;
};
