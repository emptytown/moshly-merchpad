import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Fast edit: tapping a numeric field selects its current value, so typing replaces it
// (10 → type 15 gives 15, not 1510/1015). Tap again to place the cursor and edit instead.
document.addEventListener("focusin", (e) => {
  const el = e.target;
  if (!(el instanceof HTMLInputElement) || el.readOnly || el.disabled) return;
  const mode = el.inputMode;
  if (el.type !== "number" && mode !== "numeric" && mode !== "decimal") return;
  // Defer: mobile browsers place the caret after focus, which would undo an immediate select()
  setTimeout(() => { if (document.activeElement === el) el.select(); }, 0);
  // The mouseup of the same tap would otherwise collapse the selection to a caret
  el.addEventListener("mouseup", (ev) => ev.preventDefault(), { once: true });
});

createRoot(document.getElementById("root")!).render(<App />);
