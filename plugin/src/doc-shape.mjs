import { sentences } from "./duplication.mjs";

export const NARRATES =
  /```|\bthe (?:function|regex|loop|variable|implementation|call site)\b|\bimplemented in\b|\bunder the hood\b|\binternally\b|\bin `[\w./-]+\.(?:mjs|js|ts)`/iu;

export const prose = (text) => sentences(text.replace(/`[^`]*`/gu, " "));
