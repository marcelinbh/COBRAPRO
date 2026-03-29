import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";

// Pages
import Home from "./pages/Home";
import Login from "./pages/Login";
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
import Usuarios from "./pages/Usuarios";
import Reparcelamento from "./pages/Reparcelamento";
import Simulador from "./pages/Simulador";
import ContasPagar from "./pages/ContasPagar";
import Vendas from "./pages/Vendas";
import Cheques from "./pages/Cheques";

// ─── Stable wrapper components (avoid inline functions in Route) ──────────────
const DashboardPage = () => <DashboardLayout><Dashboard /></DashboardLayout>;
const ClientesPage = () => <DashboardLayout><Clientes /></DashboardLayout>;
const ClienteDetalhePage = () => <DashboardLayout><ClienteDetalhe /></DashboardLayout>;
const ContratosPage = () => <DashboardLayout><Contratos /></DashboardLayout>;
const NovoContratoPage = () => <DashboardLayout><NovoContrato /></DashboardLayout>;
const ParcelasPage = () => <DashboardLayout><Parcelas /></DashboardLayout>;
const CaixaPage = () => <DashboardLayout><Caixa /></DashboardLayout>;
const CalendarioPage = () => <DashboardLayout><Calendario /></DashboardLayout>;
const RelatoriosPage = () => <DashboardLayout><Relatorios /></DashboardLayout>;
const ConfiguracoesPage = () => <DashboardLayout><Configuracoes /></DashboardLayout>;
const UsuariosPage = () => <DashboardLayout><Usuarios /></DashboardLayout>;
const ReparcelamentoPage = () => <DashboardLayout><Reparcelamento /></DashboardLayout>;
const SimuladorPage = () => <DashboardLayout><Simulador /></DashboardLayout>;
const ContasPagarPage = () => <DashboardLayout><ContasPagar /></DashboardLayout>;
const VendasPage = () => <DashboardLayout><Vendas /></DashboardLayout>;
const ChequesPage = () => <DashboardLayout><Cheques /></DashboardLayout>;

function Router() {
  return (
    <Switch>
      {/* Portal do cliente - sem layout de dashboard */}
      <Route path="/portal/:token" component={PortalCliente} />

      {/* Landing page / Login */}
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />

      {/* Rotas autenticadas com DashboardLayout */}
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/clientes" component={ClientesPage} />
      <Route path="/clientes/:id" component={ClienteDetalhePage} />
      <Route path="/contratos" component={ContratosPage} />
      <Route path="/contratos/novo" component={NovoContratoPage} />
      <Route path="/parcelas" component={ParcelasPage} />
      <Route path="/caixa" component={CaixaPage} />
      <Route path="/calendario" component={CalendarioPage} />
      <Route path="/relatorios" component={RelatoriosPage} />
      <Route path="/configuracoes" component={ConfiguracoesPage} />
      <Route path="/usuarios" component={UsuariosPage} />
      <Route path="/koletores" component={UsuariosPage} />
      <Route path="/reparcelamento" component={ReparcelamentoPage} />
      <Route path="/simulador" component={SimuladorPage} />
      <Route path="/contas-pagar" component={ContasPagarPage} />
      <Route path="/vendas" component={VendasPage} />
      <Route path="/cheques" component={ChequesPage} />

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
