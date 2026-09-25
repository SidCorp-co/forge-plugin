/* Opening a login's consent address in the person's own browser, beside printing it. Only on a
   terminal, because a run with its output piped has nobody at a desktop to see the page; and only
   through the one opener each platform ships, looked for rather than assumed, so a headless box
   answers with the printed address alone. The opener is started and forgotten: whatever it does, the
   login goes on waiting for the redirect, which is the only thing that completes it. */
import { spawn } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { delimiter, join } from "node:path";

const onPath = (command, env) => (env.PATH ?? "").split(delimiter).filter(Boolean).some((dir) => {
  try {
    accessSync(join(dir, command), constants.X_OK);
    return true;
  } catch {
    return false;
  }
});

/* `start` is the command shell's own, so it is reached through that shell, and the address is quoted
   there because `&` separates commands in it. */
const windowsOpener = (url, env) => ({ command: env.ComSpec || "cmd.exe", args: ["/d", "/s", "/c", `start "" "${url}"`], verbatim: true });

/** The command this platform opens an address with, or null where the platform's own opener is absent. */
export const openerFor = (url, { platform = process.platform, env = process.env } = {}) => {
  if (platform === "win32") return windowsOpener(url, env);
  const command = platform === "darwin" ? "open" : "xdg-open";
  return onPath(command, env) ? { command, args: [url], verbatim: false } : null;
};

/**
 * Starts the opener on `url` where `terminal` and `wanted` both hold and an opener exists, and answers
 * the command it started, or null where it started none. Never throws and never waits on the opener.
 */
export const openAddress = (url, { terminal = Boolean(process.stdout.isTTY), wanted = true, platform, env = process.env } = {}) => {
  if (!terminal || !wanted) return null;
  const opener = openerFor(url, { platform, env });
  if (!opener) return null;
  try {
    const child = spawn(opener.command, opener.args, { cwd: process.cwd(), env, detached: true, stdio: "ignore",
      windowsVerbatimArguments: opener.verbatim });
    child.on("error", () => {});
    child.unref();
  } catch {
    return null;
  }
  return opener.command;
};
