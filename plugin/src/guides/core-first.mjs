import { coreFirstFor, localGuide } from "./guides.mjs";
import { hasBody, referencesOf, sectionLines } from "./skill-guides.mjs";

const NOT_SERVED = 404;

const readCore = async (slug) => {
  const { accountCredentials } = await import("../resolve/settings.mjs");
  const { url, token } = accountCredentials();
  if (!url.value || !token.value) return { unanswered: "no Forge endpoint is saved on this machine" };
  const { isGated } = await import("../resolve/visibility.mjs");
  if (isGated("forge_guide")) return { unanswered: "this credential is withheld the tracker's guides" };
  const { scoped } = await import("../tracker/rest.mjs");
  const answer = await scoped("forge_guide", { action: "get", slug }, true);
  if (answer?.refused) {
    return answer.status === NOT_SERVED ? { missing: true } : { unanswered: answer.refused.split("\n")[0] };
  }
  const body = answer?.guide?.body;
  if (typeof body !== "string") return { unanswered: "the tracker answered with no page body" };
  return { body, version: answer.guide.version ?? null };
};

const coreSaid = (slug, version) => {
  const named = `core's served guide \`${slug}\`${version ? `, version ${version}` : ""}`;
  const sections = referencesOf(slug).length
    ? `; the sections listed at its foot are this plugin's CLI mechanics, each \`forge guide ${slug} <section>\``
    : "";
  return `This is ${named}, read from the tracker now${sections}.`;
};

const fallbackSaid = (slug, why) =>
  `Core's guide \`${slug}\` did not answer (${why}), so what follows is the copy bundled with this`
  + " plugin: a fallback, and it may be stale.";

const missingSaid = (slug) =>
  `The tracker serves no guide named \`${slug}\`, and this one is this plugin's own: \`forge guide ${slug}\` prints it.`;

export const coreFirst = async (slug, { strict = false, read = readCore } = {}) => {
  const got = await read(slug);
  if (typeof got.body === "string") {
    return { lines: [coreSaid(slug, got.version), "", got.body.replace(/\s+$/u, ""), ...sectionLines(slug)] };
  }
  if (strict) return { refusal: got.missing ? missingSaid(slug) : `core's guide \`${slug}\` did not answer: ${got.unanswered}` };
  const own = localGuide(slug)({});
  if (own.refusal || got.missing) return own;
  const bundled = hasBody(slug) ? ["", ...own.lines] : sectionLines(slug);
  return { lines: [fallbackSaid(slug, got.unanswered), ...bundled] };
};

export const listingRows = (ownRows, coreRows) => {
  const core = new Map(coreRows.map((one) => [one.slug, one]));
  const own = ownRows.map(({ slug, row }) => {
    const twin = coreFirstFor(slug) ? core.get(slug) : null;
    if (!twin) return row;
    return `${slug}\n  core's: ${twin.summary}\n  \`forge guide ${slug}\` prints core's page, and`
      + ` \`forge guide ${slug} <section>\` one of this plugin's ${referencesOf(slug).length} section(s)`;
  });
  const mine = new Set(ownRows.map((one) => one.slug));
  return [...own, ...coreRows.filter((one) => !mine.has(one.slug)).map((one) => `${one.slug}\n  ${one.summary}`)];
};
