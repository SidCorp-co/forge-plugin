import type { ESLint, Linter } from "eslint";

export declare const DEFAULT_MAX_FILE_CODE_LINES: number;
export declare const DEFAULT_MAX_FUNCTION_CODE_LINES: number;
export declare const DEFAULT_TEST_GLOBS: string[];

export interface GodFilesOptions {
  maxFileCodeLines?: number;
  maxFunctionCodeLines?: number;
  testGlobs?: string[];
  severity?: "error" | "warn" | "off";
}

export declare function godFilesConfig(options?: GodFilesOptions): Linter.Config[];

declare const plugin: ESLint.Plugin;

export default plugin;
export const configs: NonNullable<ESLint.Plugin["configs"]>;
export const rules: NonNullable<ESLint.Plugin["rules"]>;
