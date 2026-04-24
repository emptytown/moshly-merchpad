import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { MerchPadProvider } from "./contexts/MerchPadContext";
import { ProjectProvider } from "./contexts/ProjectContext";
import AppShell from "./components/AppShell";
import MerchOffice from "./pages/MerchOffice";
import TallyCounter from "./pages/TallyCounter";
import DetailInfo from "./pages/DetailInfo";
import Settings from "./pages/Settings";
import EndSaleScreen from "./pages/EndSaleScreen";

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
  );
}

function App() {
  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}

export default App;
