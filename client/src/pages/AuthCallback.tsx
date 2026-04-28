import { useEffect } from "react";
import { useLocation } from "wouter";

export default function AuthCallback() {
  const [, navigate] = useLocation();

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      navigate("/");
      return;
    }
    fetch("/api/auth/moshly-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((r) => {
        if (r.ok) {
          navigate("/");
        } else {
          console.error("SSO callback failed:", r.status);
          navigate("/?auth_error=1");
        }
      })
      .catch((err) => {
        console.error("SSO callback error:", err);
        navigate("/?auth_error=1");
      });
  }, [navigate]);

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
