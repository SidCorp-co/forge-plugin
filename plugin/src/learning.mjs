/* Two entry points ask one question — before a write, and after one no check could read. */
import { basename } from "node:path";

export const GUARDED = /\/memory\/|\/skills\//;
export const FILE_TYPES = ["user", "feedback", "project", "reference"];
export const SKILL_CATEGORIES = ["trap", "method", "invariant", "discovery", "boundary"];
export const FORGE_SOURCES = ["note", "knowledge", "decision", "policy"];

export const BRIEF =
  "Record only what cost a cycle, will recur, fails silently, and is not already written. Most "
  + "rounds record nothing.";

export const guarded = (path) =>
  GUARDED.test(path) && path.endsWith(".md") && basename(path) !== "MEMORY.md";
