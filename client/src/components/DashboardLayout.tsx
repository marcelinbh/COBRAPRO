import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import { LanguageSwitcher } from "./LanguageSwitcher";
import {
  LayoutDashboard,
  LogOut,
  PanelLeft,
  Users,
  FileText,
  CreditCard,
  Wallet,
  CalendarDays,
  BarChart3,
  Settings,
  TrendingUp,
  TrendingDown,
  UserCog,
  RefreshCw,
  Calculator,
  Receipt,
  ShoppingBag,
  FileCheck,
  DollarSign,
  Star,
  Car,
  Database,
  AlertTriangle,
  Smartphone,
  Tv2,
  MessageCircle,
  User,
  ClipboardList,
  Bell,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { trpc } from "@/lib/trpc";
import { BottomNav } from "./BottomNav";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: User, label: "Meu Perfil", path: "/perfil" },
  { icon: Users, label: "Clientes", path: "/clientes" },
  { icon: DollarSign, label: "Empréstimos", path: "/emprestimos" },
  { icon: Star, label: "Score de Clientes", path: "/scores" },
  { icon: Car, label: "Veículos", path: "/veiculos" },
  { icon: Smartphone, label: "Venda de Telefone", path: "/vendas-telefone" },
  { icon: Database, label: "Backup", path: "/backup" },
  { icon: AlertTriangle, label: "Análise de Risco", path: "/analise-risco" },
  { icon: FileText, label: "Contratos", path: "/contratos" },
  { icon: CreditCard, label: "Parcelas", path: "/parcelas" },
  { icon: RefreshCw, label: "Reparcelamento", path: "/reparcelamento" },
  { icon: Calculator, label: "Simulador", path: "/simulador" },
  { icon: Receipt, label: "Contas a Pagar", path: "/contas-pagar" },
  { icon: ShoppingBag, label: "Vendas", path: "/vendas" },
  { icon: FileCheck, label: "Cheques", path: "/cheques" },
  { icon: Wallet, label: "Caixa", path: "/caixa" },
  { icon: CalendarDays, label: "Calendário", path: "/calendario" },
  { icon: BarChart3, label: "Relatórios", path: "/relatorios" },
  { icon: UserCog, label: "Cobradores", path: "/cobradores" },
  { icon: Settings, label: "Configurações", path: "/configuracoes" },
  { icon: Tv2, label: "Assinaturas", path: "/assinaturas" },
  { icon: MessageCircle, label: "WhatsApp QR", path: "/whatsapp" },
  { icon: ClipboardList, label: "Relatório Diário", path: "/relatorio-diario" },
  { icon: TrendingDown, label: "Inadimplência", path: "/inadimplencia" },
  { icon: Bell, label: "Mensagens Auto", path: "/notificacoes-automaticas" },
  { icon: Smartphone, label: "Instalar App", path: "/install" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();
  const isMobile = useIsMobile();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  const [location, setLocation] = useLocation();

  // Redirecionar para a landing page quando não autenticado
  useEffect(() => {
    if (!loading && !user) {
      setLocation("/");
    }
  }, [loading, user, setLocation]);

  if (loading || !user) {
    return <DashboardLayoutSkeleton />;
  }

  // Mobile: layout sem sidebar, com bottom nav
  if (isMobile) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <MobileHeader />
        <main
          className="flex-1 overflow-y-auto"
          style={{ paddingBottom: "calc(4rem + env(safe-area-inset-bottom))" }}
        >
          <div className="p-4">
            {children}
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

function MobileHeader() {
  const [location] = useLocation();
  const activeItem = menuItems.find(item => item.path === location);

  return (
    <header
      className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border flex items-center justify-between px-4 h-14"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <img
        src="https://d2xsxph8kpxj0f.cloudfront.net/310519663380431118/BkqW4WQ4ndZHJQHLtTMfxv/cobrapro-logo_ca1f0d34.webp"
        alt="CobraPro"
        className="h-8 w-auto object-contain"
      />
      <span className="text-sm font-medium text-muted-foreground">
        {activeItem?.label ?? "CobraPro"}
      </span>
    </header>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [myPerfil, setMyPerfil] = useState<string | null>(null);
  const { data: myKoletor } = (trpc as any).cobradores?.me?.useQuery?.() ?? { data: null };
  
  useEffect(() => {
    if (myKoletor?.perfil) setMyPerfil(myKoletor.perfil);
  }, [myKoletor]);
  
  // Filtrar menu para cobradores
  const filteredMenuItems = menuItems.filter(item => {
    if (myPerfil === 'koletor') {
      const allowedPaths = ['/dashboard', '/clientes', '/emprestimos', '/parcelas', '/calendario', '/whatsapp', '/configuracoes'];
      return allowedPaths.includes(item.path);
    }
    return true;
  });
  
  const activeMenuItem = filteredMenuItems.find(item => item.path === location);

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center border-b border-sidebar-border">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center min-w-0">
                  <img
                    src="https://d2xsxph8kpxj0f.cloudfront.net/310519663380431118/BkqW4WQ4ndZHJQHLtTMfxv/cobrapro-logo_ca1f0d34.webp"
                    alt="CobraPro"
                    className="h-10 w-auto object-contain"
                  />
                </div>
              ) : (
                <img
                  src="https://d2xsxph8kpxj0f.cloudfront.net/310519663380431118/BkqW4WQ4ndZHJQHLtTMfxv/cobrapro-logo_ca1f0d34.webp"
                  alt="CobraPro"
                  className="h-7 w-7 object-contain rounded"
                />
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {filteredMenuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-10 transition-all font-normal`}
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3 space-y-2">
            <LanguageSwitcher />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => setLocation('/perfil')}
                  className="cursor-pointer"
                >
                  <User className="mr-2 h-4 w-4" />
                  <span>Meu Perfil</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </>
  );
}
