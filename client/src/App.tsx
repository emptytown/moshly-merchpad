import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { MerchPadProvider } from "./contexts/MerchPadContext";
import { ProjectProvider } from "./contexts/ProjectContext";
import { MoshlyAuthProvider, useMoshlyAuth } from "./contexts/MoshlyAuthContext";
import AppShell from "./components/AppShell";
import MerchOffice from "./pages/MerchOffice";
import TallyCounter from "./pages/TallyCounter";
import DetailInfo from "./pages/DetailInfo";
import Settings from "./pages/Settings";
import EndSaleScreen from "./pages/EndSaleScreen";
import AuthCallback from "./pages/AuthCallback";

const HUB_URL = import.meta.env.VITE_MOSHLY_HUB_URL ?? "https://moshly.io";

function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#0E0F14]">
      <span className="font-bold text-xl tracking-tight mb-6" style={{ fontFamily: "Inter, sans-serif" }}>
        <span style={{ background: "linear-gradient(135deg,#6B5CFF,#C026D3)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Merch</span>
        <span className="text-[#E6E7EB]">Pad</span>
      </span>
      <div className="w-6 h-6 rounded-full border-2 border-[#6B5CFF] border-t-transparent animate-spin" />
    </div>
  );
}

function GateScreen() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#0E0F14] px-8">
      <div className="w-full max-w-[340px] flex flex-col items-center gap-6 text-center">
        {/* Wordmark */}
        <span className="font-black text-3xl tracking-tight" style={{ fontFamily: "Inter, sans-serif", letterSpacing: "-0.03em" }}>
          <span style={{ background: "linear-gradient(135deg,#6B5CFF,#C026D3)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Merch</span>
          <span className="text-[#E6E7EB]">Pad</span>
        </span>

        <div className="w-full h-px" style={{ background: "linear-gradient(90deg, transparent, #2D3048, transparent)" }} />

        {/* Message */}
        <div className="flex flex-col gap-1.5">
          <p className="text-base font-bold text-[#E6E7EB]">No active session found.</p>
          <p className="text-sm text-[#7B7F93]">Please log in or sign up to continue.</p>
        </div>

        {/* CTAs */}
        <div className="w-full flex flex-col gap-3">
          <a
            href="https://moshly.io/login"
            className="w-full py-3 rounded-xl text-sm font-bold text-white text-center"
            style={{ background: "linear-gradient(135deg,#6B5CFF 0%,#C026D3 100%)" }}>
            Log In
          </a>
          <a
            href="https://moshly.io/join"
            className="w-full py-3 rounded-xl text-sm font-bold text-center"
            style={{ border: "1px solid #6B5CFF", color: "#9B8FFF" }}>
            Sign Up
          </a>
          <a
            href={HUB_URL}
            className="text-xs text-[#7B7F93] hover:text-[#A4A7B5] transition-colors pt-1">
            Visit Moshly.io
          </a>
        </div>

        <p className="text-[10px] text-[#3D4060] mt-2">MerchPad is part of the Moshly ecosystem</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useMoshlyAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <GateScreen />;
  return <>{children}</>;
}

function ThemedToaster() {
  const { mode, skin } = useTheme();
  const isDark = mode === 'dark';
  const isMono = skin === 'mono';
  return (
    <Toaster
      theme={isDark ? 'dark' : 'light'}
      toastOptions={{
        style: {
          background: isDark ? (isMono ? '#141414' : '#1B1E2E') : (isMono ? '#F5F5F5' : '#FFFFFF'),
          border: `1px solid ${isDark ? (isMono ? '#2A2A2A' : '#2D3048') : (isMono ? '#E0E0E0' : '#D8D8E8')}`,
          color: isDark ? (isMono ? '#F0F0F0' : '#E6E7EB') : '#0A0A0A',
          fontFamily: 'Inter, sans-serif',
        },
      }}
    />
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/auth/callback" component={AuthCallback} />
      <Route>
        <ProtectedRoute>
        <AppShell>
          <Switch>
            <Route path="/" component={MerchOffice} />
            <Route path="/tally" component={TallyCounter} />
            <Route path="/end-sale" component={EndSaleScreen} />
            <Route path="/detail" component={DetailInfo} />
            <Route path="/settings" component={Settings} />
            <Route path="/404" component={NotFound} />
            <Route component={NotFound} />
          </Switch>
        </AppShell>
        </ProtectedRoute>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <MoshlyAuthProvider>
        <ThemeProvider defaultTheme="dark">
          <ProjectProvider>
            <MerchPadProvider>
              <TooltipProvider>
                <ThemedToaster />
                <Router />
              </TooltipProvider>
            </MerchPadProvider>
          </ProjectProvider>
        </ThemeProvider>
      </MoshlyAuthProvider>
    </ErrorBoundary>
  );
}

export default App;
