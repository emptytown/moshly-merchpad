import { createMoshlyShell } from "./moshlyShell";

/** Browshly (moshly.io/app?app=merchpad): see moshlyShell.ts. */
export const shell = createMoshlyShell({
  app: "merchpad",
  hubUrl: import.meta.env.VITE_MOSHLY_HUB_URL as string | undefined,
});

export const inShell = shell.inShell;
export const goHome = () => shell.goHome();
export const hubLinkTarget = shell.hubLinkTarget;
