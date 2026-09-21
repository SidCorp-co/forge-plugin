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

/* Short enough to collide with ordinary report text, so not struck: a value of that length is no
   credential and blanking it would blank a sentence. Nothing here interpolates a row's value in the
   first place — this is the second guard, not the first. */
const TOO_SHORT = 6;

/** Every line the reporter renders passes this, so no reporting path can carry one of those names or
 *  a value the row held under one. Built from the row where there is one; a read that refused has no
 *  row and strikes the names alone. */
export const striking = (row) => {
  const values = WITHHELD
    .map((name) => row?.[name])
    .filter((held) => typeof held === "string" && held.length > TOO_SHORT);
  return (text) => [...WITHHELD, ...values]
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
  const carried = Object.keys(row ?? {}).filter((name) => !WITHHELD.includes(name));
  const asked = names.filter((name) => !WITHHELD.includes(name));
  const dropped = whole ? [] : carried.filter((name) => !asked.includes(name));
  return {
    key,
    unserved: asked.filter((name) => !Object.hasOwn(row ?? {}, name)),
    undeclared: dropped.filter((name) => !Object.hasOwn(declared, name)),
    declared: dropped.filter((name) => Object.hasOwn(declared, name)),
    read: asked.filter((name) => Object.hasOwn(row ?? {}, name)),
    withheld: WITHHELD.filter((name) => Object.hasOwn(row ?? {}, name)).length,
  };
};

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
          + " — re-take the capture with `node tools/run.mjs` and the credential columns scrubbed"
          + " before it reaches disk, or drop the declaration"];
      }
      return [];
    });
  });
