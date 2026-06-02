"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Fish, LayoutDashboard, Package, Tags, MapPin, BarChart2,
  LogOut, Menu, X, Tag, Banknote, Settings,
  ChefHat, Moon, Sun, UserRound,
} from "lucide-react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useCollection, orderBy } from "@/hooks/useFirestore";
import { isPedidoAberto } from "@/lib/comanda";
import { bootstrapAdminIfNeeded, canAccessAdmin, fetchUsuario } from "@/lib/usuarios";
import type { Pedido } from "@/types";
import toast from "react-hot-toast";

const NAV_ITEMS = [
  { href: "/admin/dashboard",     label: "Dashboard",     icon: LayoutDashboard },
  { href: "/admin/caixa",         label: "Caixa",         icon: Banknote },
  { href: "/admin/cozinha",       label: "Cozinha",       icon: ChefHat },
  { href: "/admin/produtos",      label: "Produtos",      icon: Package },
  { href: "/admin/categorias",    label: "Categorias",    icon: Tags },
  { href: "/admin/piques",        label: "Mesas",         icon: MapPin },
  { href: "/admin/promocoes",     label: "Promoções",     icon: Tag },
  { href: "/admin/relatorios",    label: "Relatórios",    icon: BarChart2 },
  { href: "/admin/atendentes",    label: "Atendentes",    icon: UserRound },
  { href: "/admin/configuracoes", label: "Configurações", icon: Settings },
];

/* ── Theme hook ─────────────────────────────────────────── */
function useTheme() {
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("theme") === "dark";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  return { dark, toggle };
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const { dark, toggle } = useTheme();
  const [authed, setAuthed]           = useState<boolean | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: pedidos } = useCollection<Pedido>("pedidos", [orderBy("criadoEm", "desc")]);

  const comandasAbertas = new Set(
    pedidos.filter((p) => isPedidoAberto(p.status)).map((p) => p.piqueId)
  ).size;

  const navBadges: Record<string, number> = {
    "/admin/cozinha": pedidos.filter((p) => p.status === "novo").length,
    "/admin/caixa": comandasAbertas,
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (pathname.includes("/login")) {
        setAuthed(user ? true : false);
        return;
      }

      if (!user) {
        setAuthed(false);
        router.replace("/admin/login");
        return;
      }

      try {
        let profile = await fetchUsuario(user.uid);
        if (!profile) {
          profile = await bootstrapAdminIfNeeded(user.uid, user.email);
        }
        if (!canAccessAdmin(profile)) {
          await signOut(auth);
          setAuthed(false);
          toast.error("Esta conta não tem acesso ao painel administrativo.");
          router.replace("/admin/login");
          return;
        }
        setAuthed(true);
      } catch {
        await signOut(auth);
        setAuthed(false);
        toast.error("Não foi possível validar seu perfil de administrador.");
        router.replace("/admin/login");
      }
    });
    return unsub;
  }, [pathname, router]);

  if (pathname.includes("/login")) return <>{children}</>;
  if (authed === null) return <AdminLoadingScreen />;
  if (!authed) return null;

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/admin/login");
    toast.success("Sessão encerrada.");
  };

  return (
    <div className="min-h-dvh flex bg-forest-50 dark:bg-forest-950">
      {/* ── Desktop Sidebar ──────────────────────────── */}
      <aside
        className="hidden lg:flex flex-col w-60 shrink-0 sticky top-0 h-dvh"
        style={{ background: "#0F172A" }}
      >
        <SidebarContent
          pathname={pathname}
          dark={dark}
          navBadges={navBadges}
          onToggleTheme={toggle}
          onLogout={handleLogout}
        />
      </aside>

      {/* ── Mobile overlay ───────────────────────────── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.aside
              key="drawer"
              initial={{ x: -256 }}
              animate={{ x: 0 }}
              exit={{ x: -256 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="lg:hidden fixed left-0 top-0 h-dvh w-60 z-50 flex flex-col"
              style={{ background: "#0F172A" }}
            >
              <button
                onClick={() => setSidebarOpen(false)}
                className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <SidebarContent
                pathname={pathname}
                dark={dark}
                navBadges={navBadges}
                onToggleTheme={toggle}
                onLogout={handleLogout}
                onNavClick={() => setSidebarOpen(false)}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile topbar */}
        <header className="lg:hidden sticky top-0 z-30 border-b border-forest-200 dark:border-forest-700 bg-white dark:bg-forest-900 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-forest-600 dark:text-forest-300 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <div className="w-6 h-6 rounded-md flex items-center justify-center bg-gold-600">
              <Fish className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-sm text-forest-900 dark:text-forest-50">
              WillTech
            </span>
          </div>
          <button
            onClick={toggle}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-forest-500 dark:text-forest-300 transition-colors"
            title={dark ? "Modo claro" : "Modo escuro"}
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  pathname,
  dark,
  navBadges,
  onToggleTheme,
  onLogout,
  onNavClick,
}: {
  pathname: string;
  dark: boolean;
  navBadges: Record<string, number>;
  onToggleTheme: () => void;
  onLogout: () => void;
  onNavClick?: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-5 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#0F766E" }}>
            <Fish className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm leading-none">WillTech</p>
            <p className="text-slate-300 text-[11px] mt-0.5">Pesqueiros</p>
          </div>
          {/* Theme toggle in sidebar */}
          <button
            onClick={onToggleTheme}
            className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title={dark ? "Modo claro" : "Modo escuro"}
          >
            {dark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          const badge = navBadges[href] ?? 0;
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavClick}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group"
              style={{
                background: active ? "rgba(13,148,136,0.15)" : undefined,
                color: active ? "#FFFFFF" : "#CBD5E1",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                  e.currentTarget.style.color = "#FFFFFF";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "";
                  e.currentTarget.style.color = "#CBD5E1";
                }
              }}
            >
              <Icon
                className="w-4 h-4 shrink-0"
                style={{ color: active ? "#2DD4BF" : undefined }}
              />
              <span className="text-sm font-medium flex-1">{label}</span>
              {badge > 0 && (
                <span
                  className="min-w-5 h-5 rounded-full px-1.5 text-[11px] font-bold flex items-center justify-center"
                  style={{
                    background: active ? "#F59E0B" : "rgba(245,158,11,0.2)",
                    color: active ? "#0F172A" : "#FCD34D",
                  }}
                >
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
              {active && <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#2DD4BF" }} />}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all text-sm"
        >
          <LogOut className="w-4 h-4" />
          <span className="font-medium">Sair</span>
        </button>
      </div>
    </div>
  );
}

function AdminLoadingScreen() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-forest-50 dark:bg-forest-950">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gold-600">
          <Fish className="w-5 h-5 text-white animate-float" />
        </div>
        <p className="text-forest-500 dark:text-forest-300 text-sm font-medium">Carregando...</p>
      </div>
    </div>
  );
}
