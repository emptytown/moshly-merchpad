/**
 * Browshly — the Moshly app frame (moshly.io/app?app=merchpad).
 *
 * Inside the frame, MerchPad must never navigate itself to moshly.io (the hub refuses
 * to be framed) and has no use for "Back to Moshly": the hub asks the frame to go home.
 */
const HUB_ORIGIN = new URL(import.meta.env.VITE_MOSHLY_HUB_URL ?? "https://moshly.io").origin;

export const inShell: boolean = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true; // cross-origin access to window.top threw: we are framed
  }
})();

/** Ask the Moshly frame to return to the launcher. */
export function goHome(): void {
  window.parent.postMessage({ type: "moshly:home" }, HUB_ORIGIN);
}

/** Links to moshly.io must leave the frame, otherwise the hub page is blocked inside it. */
export const hubLinkTarget: "_top" | undefined = inShell ? "_top" : undefined;
