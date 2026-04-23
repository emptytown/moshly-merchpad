import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { MerchPadProvider } from "./contexts/MerchPadContext";
import { ProjectProvider } from "./contexts/ProjectContext";
import AppShell from "./components/AppShell";
import MerchOffice from "./pages/MerchOffice";
import TallyCounter from "./pages/TallyCounter";
import DetailInfo from "./pages/DetailInfo";
import Settings from "./pages/Settings";
import EndSaleScreen from "./pages/EndSaleScreen";

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
              <Toaster
                theme="dark"
                toastOptions={{
                  style: {
                    background: '#1B1E2E',
                    border: '1px solid #2D3048',
                    color: '#E6E7EB',
                    fontFamily: 'Inter, sans-serif',
                  },
                }}
              />
              <Router />
            </TooltipProvider>
          </MerchPadProvider>
        </ProjectProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
