import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import Clientes from "./pages/Clientes";
import ClienteDetalhe from "./pages/ClienteDetalhe";
import Contratos from "./pages/Contratos";
import NovoContrato from "./pages/NovoContrato";
import Parcelas from "./pages/Parcelas";
import Caixa from "./pages/Caixa";
import Calendario from "./pages/Calendario";
import Relatorios from "./pages/Relatorios";
import Configuracoes from "./pages/Configuracoes";
import PortalCliente from "./pages/PortalCliente";
import DashboardLayout from "./components/DashboardLayout";
import Koletores from "./pages/Koletores";
import Reparcelamento from "./pages/Reparcelamento";

function Router() {
  return (
    <Switch>
      {/* Portal do cliente - sem layout de dashboard */}
      <Route path="/portal/:token" component={PortalCliente} />
      {/* Rotas autenticadas com DashboardLayout */}
      <Route path="/" component={() => <DashboardLayout><Dashboard /></DashboardLayout>} />
      <Route path="/clientes" component={() => <DashboardLayout><Clientes /></DashboardLayout>} />
      <Route path="/clientes/:id" component={() => <DashboardLayout><ClienteDetalhe /></DashboardLayout>} />
      <Route path="/contratos" component={() => <DashboardLayout><Contratos /></DashboardLayout>} />
      <Route path="/contratos/novo" component={() => <DashboardLayout><NovoContrato /></DashboardLayout>} />
      <Route path="/parcelas" component={() => <DashboardLayout><Parcelas /></DashboardLayout>} />
      <Route path="/caixa" component={() => <DashboardLayout><Caixa /></DashboardLayout>} />
      <Route path="/calendario" component={() => <DashboardLayout><Calendario /></DashboardLayout>} />
      <Route path="/relatorios" component={() => <DashboardLayout><Relatorios /></DashboardLayout>} />
      <Route path="/configuracoes" component={() => <DashboardLayout><Configuracoes /></DashboardLayout>} />
      <Route path="/koletores" component={() => <DashboardLayout><Koletores /></DashboardLayout>} />
      <Route path="/reparcelamento" component={() => <DashboardLayout><Reparcelamento /></DashboardLayout>} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster richColors theme="dark" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
