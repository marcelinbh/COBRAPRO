import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
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
import Usuarios from "./pages/Usuarios";
import Reparcelamento from "./pages/Reparcelamento";
import Simulador from "./pages/Simulador";
import ContasPagar from "./pages/ContasPagar";
import Vendas from "./pages/Vendas";
import Cheques from "./pages/Cheques";

function Router() {
  return (
    <Switch>
      {/* Portal do cliente - sem layout de dashboard */}
      <Route path="/portal/:token" component={PortalCliente} />
      {/* Landing page / Login */}
      <Route path="/" component={Home} />
      {/* Rotas autenticadas com DashboardLayout */}
      <Route path="/clientes" component={() => <DashboardLayout><Clientes /></DashboardLayout>} />
      <Route path="/clientes/:id" component={() => <DashboardLayout><ClienteDetalhe /></DashboardLayout>} />
      <Route path="/contratos" component={() => <DashboardLayout><Contratos /></DashboardLayout>} />
      <Route path="/contratos/novo" component={() => <DashboardLayout><NovoContrato /></DashboardLayout>} />
      <Route path="/parcelas" component={() => <DashboardLayout><Parcelas /></DashboardLayout>} />
      <Route path="/caixa" component={() => <DashboardLayout><Caixa /></DashboardLayout>} />
      <Route path="/calendario" component={() => <DashboardLayout><Calendario /></DashboardLayout>} />
      <Route path="/relatorios" component={() => <DashboardLayout><Relatorios /></DashboardLayout>} />
      <Route path="/configuracoes" component={() => <DashboardLayout><Configuracoes /></DashboardLayout>} />
      <Route path="/usuarios" component={() => <DashboardLayout><Usuarios /></DashboardLayout>} />
      <Route path="/koletores" component={() => <DashboardLayout><Usuarios /></DashboardLayout>} />
      <Route path="/reparcelamento" component={() => <DashboardLayout><Reparcelamento /></DashboardLayout>} />
      <Route path="/simulador" component={() => <DashboardLayout><Simulador /></DashboardLayout>} />
      <Route path="/contas-pagar" component={() => <DashboardLayout><ContasPagar /></DashboardLayout>} />
      <Route path="/vendas" component={() => <DashboardLayout><Vendas /></DashboardLayout>} />
      <Route path="/cheques" component={() => <DashboardLayout><Cheques /></DashboardLayout>} />
      <Route path="/dashboard" component={() => <DashboardLayout><Dashboard /></DashboardLayout>} />
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
