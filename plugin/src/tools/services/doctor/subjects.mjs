/* What `forge doctor` reports, one subject per thing it resolves, each with the flags that write it:
   docs/cli/the-subjects.md. */

/* A subject's own text is the whole of a 2,500-byte cap rather than a share of the verb's, which is
   what buys the nine flags the top-level help had no room to describe. Every flag is spelled as it
   is typed — on the verb, never on the subject — so a refusal naming one is still the command a
   caller types and the fifty routes out of a refusal across this tree stay correct. */
const MACHINE = [
  "Usage: forge doctor machine [--full]",
  "The endpoint, the credential, the session id this run holds, the scratch directory it writes",
  "under, and the gates switched off here.",
  "",
  "  forge doctor --token <pat>  the tracker credential, saved outside every repository at",
  "                              owner-only permissions. The row prints it masked; --full whole.",
  "  forge doctor --url <url>    the endpoint every call goes to. The REST base under `tracker` is",
  "                              derived from it, so there is no second setting for that.",
  "",
  "Both are typed on the verb rather than on this subject. A session id is not written here: a run",
  "that inherited the id of the session which dispatched it names a wave and not a run, and the row",
  "says which of the two this is.",
].join("\n");

const OFFER = [
  "Usage: forge doctor offer",
  "Which verbs and skills this machine offers, which it withholds, and the jobs this project",
  "declares. A verb can be unlisted for four reasons and the row names which, because a verb that",
  "has simply vanished from the usage list is the one thing a caller cannot act on.",
  "",
  "  forge doctor --job <name>   replace what this machine withholds with every verb and skill that",
  "                              job does not offer. Which jobs exist is the project's own file to",
  "                              declare; the row names them and the file they were read from.",
  "  forge doctor --job all      offer every verb and skill again, a hand-hidden verb included.",
  "  forge doctor --hide <verb>  drop one verb from the usage list; it still runs when it is typed.",
  "  forge doctor --show <verb>  list one again.",
  "",
  "Each writes this machine's own record and reaches every checkout on it, and each is typed on the",
  "verb rather than on this subject. A verb this credential may not call, and one whose channel the",
  "project turned off, are unlisted for reasons no flag here clears.",
].join("\n");

const PROJECT = [
  "Usage: forge doctor project",
  "The keys this project sets for itself, each with the value in force and where it was read, and",
  "the tracker's own record of the project: its branches, its deploys, each key of its pipeline, and",
  "what it counts.",
  "",
  "  forge doctor --set <key>=<value>  one key of the project's configuration, written through the",
  "                                    route of the resource holding it and read back off it before",
  "                                    it reports set. A key neither resource holds is refused;",
  "                                    `pipeline.<k>` and `fact.<k>` create one.",
  "  forge doctor --flow <slug>        the flow, into the project's own file, with every key that",
  "                                    flow asks the project for; either both land or the refusal",
  "                                    names the half that did not.",
  "  forge doctor --ship ready|self    how far a run in this checkout goes: `self` lands its own",
  "                                    change, `ready` stops at a pushed branch and a checkpoint.",
  "                                    It writes this project's record, so two projects on one",
  "                                    machine may answer differently.",
  "  forge doctor --adopt              take a project file this checkout still carries over into",
  "                                    this machine's record of it, whole. The report above names",
  "                                    that file; this refuses where a record already exists rather",
  "                                    than writing over it, and leaves the checkout's copy as it is.",
  "  forge doctor --credentials        the test credentials the deploy rows withhold, printed once.",
  "",
  "Each is typed on the verb rather than on this subject, and each writes one thing, so `--set`,",
  "`--flow` and `--ship` do not travel in one call: the first returns before the report and a second",
  "would be dropped in silence. The refusal says so.",
  "",
  "The project's own keys are kept per project under this machine's configuration directory rather",
  "than in the checkout, so one box may differ from another and setting a key is not a commit. The",
  "record is the repository's, so every linked worktree of one checkout reads and writes the same",
  "one.",
  "A key this machine owns outright is refused by `--set` with the route that writes it.",
].join("\n");

const BRIEF = [
  "Usage: forge doctor brief",
  "The brief a run reads instead of learning this repository by hand, its body numbered down the",
  "margin, and a `stale:` line naming which of the files it was read from have moved since.",
  "",
  "Nothing here writes its prose — no program reads a repository's dangers out of its README — so a",
  "stale line is judged by a run and closed by whichever of these it is:",
  "",
  "  forge doctor --confirm <source>  the lines naming that source were read against the file as it",
  "                                   now is and their prose still holds, so the digest alone is",
  "                                   re-stamped and the body goes back byte for byte. The lines it",
  "                                   covered are printed.",
  "  forge doctor --line <n> <text>   one line's prose, replaced, counting the body this subject",
  "                                   prints numbered. A source another line also reads is left",
  "                                   stale and is named.",
  "  forge doctor --was <prose>       what line <n> begins with now, and it must open that one line",
  "                                   alone: the store has no undo, and every other view of it",
  "                                   counts a different body.",
  "  forge doctor --refresh <body>    the whole brief, for one being rewritten on purpose. Its",
  "                                   digests are stamped from that same body in the same call.",
  "",
  "The entry is `forge knowledge`'s otherwise — slug `project-brief`, kind `overview`, injection",
  "`always` — and --title, --confidence and --meta mean there what they mean here. Injection is no",
  "flag: a brief a session has to ask for is the call this entry removes.",
].join("\n");

const UNDECIDED = [
  "Usage: forge doctor undecided",
  "Every key of this project's own configuration file it has not set, and the brief it has not",
  "stored, each with the one call that writes it. The keys come off the same table the writes are",
  "read from, so one added there appears here and one removed leaves.",
  "",
  "This is the second question the report answers. The first is what value is in force, and a key",
  "nobody decided stays out of that one: a default printed as a decision is a decision nobody made.",
  "It is named in this one, because a project never told what it may declare cannot declare it.",
  "",
  "No flag writes any of it. Each row carries the call that writes its own key, spelled as it is",
  "typed, so the reading is the route rather than a pointer to one.",
  "",
  "Not in a bare reading, and nothing here is a fault: a project that decided nothing has decided",
  "nothing, which is no finding about the box. A bare call prints no row of this subject at all and",
  "names this call for the whole of it.",
].join("\n");

const COPY = [
  "Usage: forge doctor copy",
  "Which copy of this plugin answers a call from here, which copy the gates run, what a session",
  "keeps until it restarts whatever those two say, and the newest version released.",
  "",
  "No flag writes any of it: a copy is installed by `claude plugin update` and a release is the",
  "project's own to make. The rows are the whole of this subject.",
  "",
  "The newest release is read off the tags origin holds, asked for before the report's local checks",
  "and read after them, so the round trip overlaps work the report was going to do anyway. A call",
  "that prints no row of this subject does not ask at all.",
].join("\n");

const SERVES = [
  "Usage: forge doctor serves",
  "The roles this copy ships to dispatch through, the contract it states, every declared flow and",
  "which stages of the ladder its parts answer, the skill stubs a session loads, and this CLI's",
  "guide table against what the tracker now serves.",
  "",
  "No flag writes any of it. Which flow this project runs is the `project` subject's to pin; the",
  "rows here say what each declared flow answers once it is pinned.",
  "",
  "Not in a bare reading. A bare call prints the faults alone — a contract copy missing its parts, a",
  "role the loaded copy lacks, a guide slug the tracker has retired — and names this call for the",
  "rest.",
].join("\n");

const SERVICES = [
  "Usage: forge doctor services [--full]",
  "The hosts the harness calls and which of their keys this machine holds — the Vietnamese gateway,",
  "Cloudflare, Coolify, the model that reviews a turn, the ChatGPT endpoint, and the endpoint that",
  "counts a Claude token — one row per key, each naming the file that answered for it.",
  "",
  "  forge doctor --codex-url <url>        where a consult is sent",
  "  forge doctor --codex-key <key>        its credential, which the row prints masked",
  "  forge doctor --vi-url <url>           where Vietnamese prose is written",
  "  forge doctor --vi-key <key>           its credential, masked in the row too",
  "  forge doctor --vi-model <id>          which model of that gateway writes it",
  "  forge doctor --chatgpt-url <url>      where one ChatGPT turn is sent",
  "  forge doctor --chatgpt-key <key>      its credential, masked as the two above are",
  "  forge doctor --chatgpt-prefix <text>  the framing every picture ask carries, which is a",
  "                                        direction to build toward and never a screenshot of",
  "                                        something already built",
  "  forge doctor --anthropic-key <key>    the key `forge stats surface` counts tokens under,",
  "                                        masked in the row",
  "  forge doctor --anthropic-url <url>    where that count is asked, Anthropic's own origin unset",
  "  forge doctor --coolify-route <mode>   which of the two ways to the deployment platform the",
  "                                        `coolify` verb takes: `tracker` for this project's own",
  "                                        bindings on the credential already held, `instance` for",
  "                                        the instance `coolify login` saved",
  "",
  "Each is typed on the verb rather than on this subject. This machine's own configuration is the",
  "source for every one of them; the reviewer's gateway profile and the file `vi-natural login`",
  "writes answer where a key here is unset, and the row says which of the two did. Cloudflare and",
  "Coolify have their own login verbs, and none of these gates anything but its own verb.",
].join("\n");

const REPO = [
  "Usage: forge doctor repo",
  "This checkout's own health: whether every package its manifest declares resolves under",
  "node_modules, and what its CLAUDE.md claims — a path, a script, a `-h`, a ref or an identifier",
  "that has stopped being real, a rule a checker already states, and the sentences a guide or a",
  "comment already owns, each scored against the pair it overlaps.",
  "",
  "No flag writes any of it, and nothing here installs or edits anything: a claim is corrected in",
  "the file it is about, and the row names that file and the line.",
  "",
  "Not in a bare reading. A bare call prints the faults and the notes and leaves the scored pairs",
  "here, this being the reading that carries what to do about each.",
].join("\n");

const TRACKER = [
  "Usage: forge doctor tracker [--full]",
  "What the tracker answers for this project: the REST base derived from the endpoint, the routes",
  "this CLI declares over the tools it holds, the project id resolved from the slug, this device's",
  "offset from the tracker's own clock, and which declared capabilities this credential may call.",
  "",
  "No flag writes any of it. The endpoint and the credential are `machine`'s and the slug is the",
  "project's own file's; `--full` prints the project id rather than saying it resolved.",
  "",
  "A declared capability that refuses is recorded with the date it refused on, and the usage list",
  "then withholds every verb that spends one: declared is not callable.",
  "",
  "Then the name join: what the project row's shapers ask that row for and it does not carry, and",
  "what it carries that they never ask for and nothing declares. It names the day it was read, it",
  "reaches the row's own columns and nothing inside any of them, and it never names either of the",
  "two columns holding a credential.",
  "",
  "Not in a bare reading. A bare call prints what refused here and nothing that answered.",
].join("\n");

/** Every subject in the order the report prints it: the slug, the line the verb's own help gives it,
 *  whether a bare call reads it, and its own text. `bare` false is the reading a bare call prints
 *  only the faults of — the repository's health, the plugin's internals, the tracker's own. */
export const SUBJECTS = [
  { slug: "machine", bare: true, full: true, says: "the endpoint, the credential, the session id and the gates off here", text: MACHINE },
  { slug: "offer", bare: true, says: "which verbs and skills this machine offers, and the jobs declared here", text: OFFER },
  { slug: "project", bare: true, says: "the keys this project sets, and the tracker's own record of it", text: PROJECT },
  { slug: "brief", bare: true, says: "the brief read instead of the repository, and the sources of it that moved", text: BRIEF },
  { slug: "undecided", bare: false, says: "the keys this project has not set, and the brief it has not stored", text: UNDECIDED },
  { slug: "copy", bare: true, says: "which copy answers a call, which the gates run, and the newest released", text: COPY },
  { slug: "serves", bare: false, says: "the roles, the contract, the flows and the stubs this copy serves", text: SERVES },
  { slug: "services", bare: true, full: true, says: "the hosts the harness calls, and which of their keys are held", text: SERVICES },
  { slug: "repo", bare: false, says: "this checkout's own health: what it declares, and what CLAUDE.md claims", text: REPO },
  { slug: "tracker", bare: false, full: true, says: "what the tracker answers for: its routes, its clock, its capabilities", text: TRACKER },
];

export const SUBJECT_SLUGS = SUBJECTS.map((one) => one.slug);

/** The subjects `--full` widens: a value a row masks, and the project id it prints rather than says
 *  resolved. A reading holding none of them is a reading that flag does nothing to. */
export const WIDENED = SUBJECTS.filter((one) => one.full).map((one) => one.slug);

/* One text per subject, which is the set its own call answers help with, so neither can move
   alone — the same shape `forge stats` declares for its subjects. */
export const SAYS = Object.fromEntries(SUBJECTS.map((one) => [one.slug, one.text]));

/** The subjects a bare call reads whole. What is not here still prints its findings there. */
export const IN_BARE = new Set(SUBJECTS.filter((one) => one.bare).map((one) => one.slug));

/** What the withheld subjects are called and what each holds, for the line a bare reading closes
 *  on: a layer that cannot carry something says which layer does rather than going quiet. */
export const heldSaid = (slugs) => {
  const held = SUBJECTS.filter((one) => slugs.includes(one.slug));
  if (!held.length) return [];
  return ["", `${held.length} subject(s) printed only their findings above. Each whole, rows and detail:`,
    ...held.map((one) => `  forge doctor ${one.slug.padEnd(10)} ${one.says}`)];
};

/* The body alone: the usage line over it is the verb's own row, which `forge -h` reads too. */
export const USAGE = [
  "What resolves here, and from where. A bare call reads the configuration and its sources; a",
  "subject reads that subject alone, its rows and its detail. Each subject's own flags, spelled as",
  "the calls that write them: `forge doctor <subject> -h`.",
  "",
  ...SUBJECTS.map((one) => `  ${one.slug.padEnd(10)} ${one.says}`),
  "",
  "  --full     the value behind a masked one, the project id, and the file the machine's keys are in",
  "",
  `Not in a bare reading: ${SUBJECTS.filter((one) => !one.bare).map((one) => one.slug).join(", ")}.`,
  "A bare call prints their findings and names the call that prints each whole, so a fault reaches",
  "the first command a session runs and the rest waits to be asked for.",
].join("\n");
