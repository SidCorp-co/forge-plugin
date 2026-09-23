/* A file of this plugin is reached from the one root plugin-copy.mjs exports, never by counting `..`
   off the module that wants it: four modules counting broke together when they moved one directory
   deeper, and nothing but the suite noticed (ISS-49, ISS-52). Reached: a line spelling a `..`
   segment that reads `import.meta.url`, or reads a name bound off it. */

export const ROOT_MODULE = "plugin/src/tools/plugin-copy.mjs";

const OWN = /\bimport\.meta\.url\b/u;
const BOUND = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=[^\n;]*\bimport\.meta\.url\b/gu;
const UP = /(["'`])\.\.(?:\/[^"'`\n]*)?\1/u;
/* A specifier is resolved by the loader, which refuses a wrong depth when the module loads. */
const SPECIFIER = /^\s*(?:import\b|export\b[^\n]*\bfrom\b|\}\s*from\b)/u;
const COMMENT = /^\s*(?:\/\/|\/\*|\*)/u;

const spelt = (name) => name.replace(/\$/gu, "\\$");

/** Every line of one file that counts up from its own location, as the message a developer reads. */
export const countedUp = ({ rel, text }) => {
  if (rel === ROOT_MODULE || !OWN.test(text)) return [];
  const names = [...text.matchAll(BOUND)].map((match) => spelt(match[1]));
  const reads = new RegExp(`\\bimport\\.meta\\.url\\b${names.map((one) => `|(?<![\\w$.])${one}(?![\\w$])`).join("")}`, "u");
  return text.split("\n").flatMap((line, index) =>
    (UP.test(line) && reads.test(line) && !SPECIFIER.test(line) && !COMMENT.test(line)
      ? [`${rel}:${index + 1} counts \`..\` off its own location to reach a file of the plugin — import`
        + ` PLUGIN_ROOT from ${ROOT_MODULE} and join from it, so moving this module moves nothing it reaches`]
      : []));
};

export const problems = (files) => files.flatMap(countedUp);
