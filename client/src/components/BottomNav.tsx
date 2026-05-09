import { useLocation } from "wouter";
import {
  LayoutDashboard,
  DollarSign,
  CreditCard,
  Users,
  MoreHorizontal,
} from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  FileText,
  Wallet,
  CalendarDays,
  BarChart3,
  Settings,
  UserCog,
  RefreshCw,
  Calculator,
  Receipt,
  ShoppingBag,
  FileCheck,
  Star,
  Car,
  Database,
  AlertTriangle,
  Smartphone,
  Tv2,
  MessageCircle,
  LogOut,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const primaryNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: DollarSign, label: "Empréstimos", path: "/emprestimos" },
  { icon: CreditCard, label: "Parcelas", path: "/parcelas" },
  { icon: Users, label: "Clientes", path: "/clientes" },
];

const allMenuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: Users, label: "Clientes", path: "/clientes" },
  { icon: DollarSign, label: "Empréstimos", path: "/emprestimos" },
  { icon: Star, label: "Score de Clientes", path: "/scores" },
  { icon: Car, label: "Veículos", path: "/veiculos" },
  { icon: Smartphone, label: "Venda de Telefone", path: "/vendas-telefone" },
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
  { icon: Tv2, label: "Assinaturas", path: "/assinaturas" },
  { icon: MessageCircle, label: "WhatsApp QR", path: "/whatsapp" },
  { icon: Database, label: "Backup", path: "/backup" },
  { icon: Settings, label: "Configurações", path: "/configuracoes" },
];

export function BottomNav({ menuItems }: { menuItems: any[] }) {
  const [location, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-t border-border"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
          {primaryNavItems.map((item) => {
            const isActive = location === item.path;
            return (
              <button
                key={item.path}
                onClick={() => setLocation(item.path)}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full rounded-lg transition-all touch-manipulation ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <item.icon className={`h-5 w-5 ${isActive ? "stroke-[2.5]" : ""}`} />
                <span className={`text-[10px] font-medium leading-tight ${isActive ? "font-semibold" : ""}`}>
                  {item.label}
                </span>
                {isActive && (
                  <span className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />
                )}
              </button>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full rounded-lg transition-all touch-manipulation text-muted-foreground hover:text-foreground"
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-[10px] font-medium leading-tight">Mais</span>
          </button>
        </div>
      </nav>

      {/* Full menu drawer */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl p-0">
          <SheetHeader className="px-4 pt-4 pb-2 border-b border-border">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-base font-semibold">Menu</SheetTitle>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent transition-colors">
                    <Avatar className="h-7 w-7 border">
                      <AvatarFallback className="text-xs font-medium">
                        {user?.name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-left">
                      <p className="text-xs font-medium leading-none">{user?.name || "-"}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{user?.email || "-"}</p>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => { logout(); setOpen(false); }}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sair</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </SheetHeader>

          <div className="overflow-y-auto h-full pb-4">
            <div className="grid grid-cols-3 gap-1 p-3">
              {allMenuItems.map((item) => {
                const isActive = location === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => {
                      setLocation(item.path);
                      setOpen(false);
                    }}
                    className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl transition-all touch-manipulation ${
                      isActive
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    <item.icon className={`h-5 w-5 ${isActive ? "stroke-[2.5]" : ""}`} />
                    <span className="text-[10px] font-medium text-center leading-tight">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Botão de Logout — visível e acessível */}
            <div className="px-3 pb-6">
              <button
                onClick={() => { logout(); setOpen(false); }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-all touch-manipulation font-medium text-sm"
              >
                <LogOut className="h-4 w-4" />
                Sair da Conta
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
