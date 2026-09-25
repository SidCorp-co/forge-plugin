/* Opening a login's consent address in the person's own browser, beside printing it. Only on a
   terminal, because a run with its output piped has nobody at a desktop to see the page; and only
   through the one opener each platform ships, so a headless box without one answers with the printed
   address alone. Whether the opener exists is what starting it says, rather than a search of the
   path ahead of it. Once started it is forgotten: whatever it does, the login goes on waiting for the
   redirect, which is the only thing that completes it. */
import { spawn } from "node:child_process";

/** The command and arguments this platform opens an address with. `start` is the command shell's
 *  own, so it is reached through that shell, and the address is quoted there because `&` separates
 *  commands in it. */
export const openerFor = (url, platform = process.platform) => {
  if (platform === "win32") return { command: "cmd.exe", args: ["/d", "/s", "/c", `start "" "${url}"`], verbatim: true };
  return { command: platform === "darwin" ? "open" : "xdg-open", args: [url], verbatim: false };
};

/**
 * Starts the opener on `url` where `terminal` and `wanted` both hold, and answers the command once it
 * has started, or null where none was started or it could not be. Never rejects and never waits for
 * the opener to finish. `env` is the child's environment, the parent's where none is given.
 */
export const openAddress = (url, { terminal = Boolean(process.stdout.isTTY), wanted = true, platform, env } = {}) => {
  if (!terminal || !wanted) return Promise.resolve(null);
  const opener = openerFor(url, platform);
  return new Promise((done) => {
    try {
      const child = spawn(opener.command, opener.args, { cwd: process.cwd(), detached: true, stdio: "ignore",
        windowsVerbatimArguments: opener.verbatim, ...(env ? { env } : {}) });
      child.once("spawn", () => done(opener.command));
      child.on("error", () => done(null));
      child.unref();
    } catch {
      done(null);
    }
  });
};
