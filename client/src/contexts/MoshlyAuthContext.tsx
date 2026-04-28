import React, { createContext, useContext, useEffect, useState } from "react";

export interface MoshlyUser {
  id: string;
  email: string;
  role: string;
  plan: string;
}

interface MoshlyAuthContextType {
  user: MoshlyUser | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const MoshlyAuthContext = createContext<MoshlyAuthContextType | undefined>(undefined);

export function MoshlyAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MoshlyUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setUser(data?.user ?? null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  };

  return (
    <MoshlyAuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </MoshlyAuthContext.Provider>
  );
}

export function useMoshlyAuth() {
  const ctx = useContext(MoshlyAuthContext);
  if (!ctx) throw new Error("useMoshlyAuth must be used inside MoshlyAuthProvider");
  return ctx;
}
