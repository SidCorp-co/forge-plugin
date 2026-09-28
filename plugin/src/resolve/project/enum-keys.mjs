/* The project keys that take one word out of a closed set, each declared once: its values with what
   each means to a run, what an absent or unlisted word falls back to, and — where the fallback is no
   value at all — what that reads as and what the report says of an absent key. The reader, the
   write's judge, the report's row and a key's own `forge doctor` flag are all derived from a row
   here, so a key added is one row, and a value added is one entry. What a key means to a project:
   README.md's Configuration. */

/** A fallback of `null` is no value rather than a default nobody chose: a run that cannot read which
 *  of the values it is standing in is owed silence. `flag` is what the key's own `forge doctor
 *  --<key>` writes, said as the report's usage says it, where the key has one. */
export const ENUM_KEYS = {
  /* What kind of project a checkout belongs to, which decides where work is exercised. Declared and
     never inferred — every reader before this one guessed it from whether the tracker happened to
     hold a preview environment, and two runs in one checkout reached opposite answers (ISS-2190). */
  shape: {
    values: {
      storefront: "no repository here; the store is its own source of truth",
      staged: "a preview deployment somebody opens, then live",
      direct: "live only, so work is exercised on this box and preview is localhost",
    },
    fallback: null,
    reads: "no shape at all",
    unset: "unset, so nothing here says whether work is exercised on a deployment or on this box",
  },
  /* Where the merge sits relative to the judging. Absent, the branches on the tracker's record
     derive it, which is `landingRoute` in tracker/project-config.mjs. */
  landing: {
    values: {
      "after-merge": "the change merges first and is judged where it landed",
      "before-merge": "the change is judged on its branch and merges once it passes",
    },
    fallback: null,
    reads: "the derived route",
    unset: "unset, so the branches on the tracker's record derive where the merge sits",
  },
  /* What a landing does with a set its combined gate refused. The first is the default because a
     red batch then costs a gate per round rather than one per member (ISS-2480). */
  redBatch: {
    values: {
      "attribute-then-split": "a red combined gate hands back the members its failing cases name, "
        + "halves the rest and lands the others as one candidate",
      "one-by-one": "a red combined gate lands every member alone",
    },
    fallback: "attribute-then-split",
  },
  /* Whether a run lands its own change or stops ready for another actor to land it. The PROJECT's,
     beside `landing` and `drainedBy`: one value in the machine's own file answered for every
     checkout on the box at once (ISS-2174). */
  ship: {
    values: {
      self: "a run lands its own change",
      ready: "a run stops at a pushed branch and a landing checkpoint, and the landing is another actor's",
    },
    fallback: "self",
    flag: "how far a run in this checkout goes",
  },
  /* Whether a question this project's sessions declare reversible may be decided without the owner.
     `off` where unset or unreadable, because this plugin runs in repositories whose owners have not
     decided: plugin/hooks/how/ask-decide.md. */
  "asks.mode": {
    values: {
      off: "every question a session asks goes to the owner",
      decide: "a question declared reversible may be answered from the owner's own earlier answers",
    },
    fallback: "off",
  },
  /* Whether a change goes out without a person's look. Absent here is not `manual`: `releaseFrom`
     in tracker/project-config.mjs decides what an absence resolves to, one level down, so a project
     which has not spoken is moved by no upgrade of this plugin (ISS-2190). */
  release: {
    values: {
      auto: "a user-facing change ships without a person's look",
      manual: "a user-facing change waits for a person's look",
    },
    fallback: null,
    reads: "the tracker's own pipeline setting",
    unset: "unset, so the tracker's own pipeline setting says whether a change waits for a person's look",
  },
  /* Whether this project's session starts write the harness report: docs/cli/stats.md. */
  report: {
    values: {
      off: "no session start or release writes the harness report",
      daily: "a session start writes yesterday's page, and the acts `reportOn` names rewrite the current report",
    },
    fallback: "off",
  },
};

/** The words a key takes, in the order the report lists them. */
export const valuesOf = (key) => Object.keys(ENUM_KEYS[key].values);

/** What one value means to a run, as the report and the flag's own line say it. */
export const meaningOf = (key, value) => ENUM_KEYS[key].values[value];

/** Where the key sits in a project record: `asks.mode` is `mode` inside the `asks` table. */
export const pathOf = (key) => key.split(".");

/** The keys with a `forge doctor --<key>` of their own. */
export const ENUM_FLAGS = Object.keys(ENUM_KEYS).filter((key) => ENUM_KEYS[key].flag);
