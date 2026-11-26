/**
 * MoshlyShell — talk to Browshly, the Moshly app frame (https://moshly.io/app?app=<slug>).
 *
 * Browshly shows each Moshly app in an iframe under its own bar (app icon menu, credits,
 * notifications). Inside the frame an app must never navigate itself to moshly.io (the hub
 * refuses to be framed): it asks the frame instead. Outside the frame everything works as
 * before. No dependencies, browser only.
 *
 * Source of truth: emptytown/moshly-modules (modules/MoshlyShell). Copy, do not edit the copy.
 */

export type MoshlyShellOptions = {
  /** The app's slug in the Moshly catalog, e.g. "run". */
  app: string;
  /** moshly.io base URL; default https://moshly.io. */
  hubUrl?: string;
};

export type MoshlyShell = {
  /** True when the app runs inside Browshly (or any frame). */
  inShell: boolean;
  /** Back to the Moshly launcher. */
  goHome(): void;
  /** Open the Browshly app menu; outside the frame, open this app in Browshly with the menu open. */
  openSwitcher(): void;
  /**
   * The app's session is missing or expired. Inside the frame Browshly issues a fresh sign-in
   * and reloads the app; outside it the browser goes to `fallbackUrl` (the app's usual redirect).
   */
  reauth(fallbackUrl: string): void;
  /** Tell Browshly the user's credits changed (after an AI call or PDF export). */
  quotaChanged(): void;
  /** `target` for links to moshly.io: "_top" inside the frame so they leave it. */
  hubLinkTarget: "_top" | undefined;
};

export function createMoshlyShell(options: MoshlyShellOptions): MoshlyShell {
  const hubUrl = (options.hubUrl || "https://moshly.io").replace(/\/+$/, "");
  const hubOrigin = new URL(hubUrl).origin;

  let inShell = false;
  try {
    inShell = typeof window !== "undefined" && window.self !== window.top;
  } catch {
    inShell = true; // reading window.top threw: we are inside a cross-origin frame
  }

  const send = (type: string) => window.parent.postMessage({ type }, hubOrigin);

  return {
    inShell,
    goHome() {
      if (inShell) send("moshly:home");
      else window.location.href = `${hubUrl}/launcher`;
    },
    openSwitcher() {
      if (inShell) send("moshly:switcher");
      else window.location.href = `${hubUrl}/app?app=${encodeURIComponent(options.app)}&switcher=1`;
    },
    reauth(fallbackUrl: string) {
      if (inShell) send("moshly:reauth");
      else window.location.href = fallbackUrl;
    },
    quotaChanged() {
      if (inShell) send("moshly:quota-changed");
    },
    hubLinkTarget: inShell ? "_top" : undefined,
  };
}
