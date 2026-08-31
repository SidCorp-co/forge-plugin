// Assembling the Vietnamese style contract. The contract itself is ../vi-text.mjs.

import {
  BATCH_TASK,
  GLOSSARY_HEADER,
  GLOSSARY_KEEP,
  GLOSSARY_LINE,
  DOC_CONTEXT,
  DOC_KEY_CONTEXT,
  DOC_TASK,
  KEY_CONTEXT,
  PLACEHOLDER_RULE,
  REGIONS,
  REGISTERS,
  REVIEW_TASK,
  STYLE,
  UI_CONTEXT,
} from "../vi-text.mjs";

export { BATCH_TASK, DOC_TASK, REVIEW_TASK };

export const REGISTER_NAMES = Object.keys(REGISTERS);
export const REGION_NAMES = Object.keys(REGIONS);

export function systemPrompt(kind, { glossary, register, region, keyContext = false } = {}) {
  const parts = [STYLE, PLACEHOLDER_RULE];
  if (register && register in REGISTERS) parts.push(REGISTERS[register]);
  if (region && region in REGIONS) parts.push(REGIONS[region]);
  if (keyContext) parts.push(kind === "doc" ? DOC_KEY_CONTEXT : KEY_CONTEXT);
  if (kind === "ui") parts.push(UI_CONTEXT);
  else if (kind === "doc") parts.push(DOC_CONTEXT);
  if (glossary && glossary.size) {
    const lines = [GLOSSARY_HEADER];
    for (const [source, target] of glossary) {
      const rendered = target === null ? GLOSSARY_KEEP : `"${target}"`;
      lines.push(GLOSSARY_LINE.replace("%s", source).replace("%s", rendered));
    }
    parts.push(lines.join("\n"));
  }
  return parts.join("\n\n");
}
