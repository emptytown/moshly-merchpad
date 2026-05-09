import { useEffect } from "react";

export default function AuthCallback() {
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      window.location.replace("/");
      return;
    }
    fetch("/api/auth/moshly-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((r) => {
        if (r.ok) {
          // Hard redirect so MoshlyAuthProvider remounts and re-fetches /api/auth/me
          // with the newly-set session cookie (client-side navigate won't re-trigger the effect).
          window.location.replace("/");
        } else {
          window.location.replace("/?auth_error=1");
        }
      })
      .catch(() => {
        window.location.replace("/?auth_error=1");
      });
  }, []);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        fontFamily: "Inter, sans-serif",
        color: "#E6E7EB",
        background: "#0E0F14",
        fontSize: "1rem",
        letterSpacing: "0.05em",
      }}
    >
      Signing in to MerchPad…
    </div>
  );
}
