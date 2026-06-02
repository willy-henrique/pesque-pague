"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Fish, LayoutDashboard, Package, Tags, MapPin, BarChart2,
  LogOut, Menu, X, Tag, Banknote, Settings,
  ChefHat, Moon, Sun,
} from "lucide-react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
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
  { href: "/admin/configuracoes", label: "Configurações", icon: Settings },
];

/* ── Theme hook ─────────────────────────────────────────── */
function useTheme() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const isDark = stored === "dark";
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

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

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user && !pathname.includes("/login")) {
        router.replace("/admin/login");
      } else {
        setAuthed(!!user);
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
    <div className="min-h-dvh flex" style={{ background: dark ? "#0F172A" : "#F8FAFC" }}>
      {/* ── Desktop Sidebar ──────────────────────────── */}
      <aside
        className="hidden lg:flex flex-col w-60 shrink-0 sticky top-0 h-dvh"
        style={{ background: "#0F172A" }}
      >
        <SidebarContent
          pathname={pathname}
          dark={dark}
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
        <header
          className="lg:hidden sticky top-0 z-30 border-b px-4 py-3 flex items-center gap-3"
          style={{
            background: dark ? "#1E293B" : "#FFFFFF",
            borderColor: dark ? "#334155" : "#E2E8F0",
          }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: dark ? "#94A3B8" : "#475569" }}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: "#0F766E" }}>
              <Fish className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-sm" style={{ color: dark ? "#F1F5F9" : "#0F172A" }}>
              WillTech
            </span>
          </div>
          <button
            onClick={toggle}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: dark ? "#94A3B8" : "#64748B" }}
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
  onToggleTheme,
  onLogout,
  onNavClick,
}: {
  pathname: string;
  dark: boolean;
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
            <p className="text-slate-400 text-[11px] mt-0.5">Pesqueiros</p>
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
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavClick}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group"
              style={{
                background: active ? "rgba(13,148,136,0.15)" : undefined,
                color: active ? "#FFFFFF" : "#94A3B8",
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
                  e.currentTarget.style.color = "#94A3B8";
                }
              }}
            >
              <Icon
                className="w-4 h-4 shrink-0"
                style={{ color: active ? "#2DD4BF" : undefined }}
              />
              <span className="text-sm font-medium flex-1">{label}</span>
              {active && <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#2DD4BF" }} />}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all text-sm"
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
    <div className="min-h-dvh flex items-center justify-center" style={{ background: "#F8FAFC" }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#0F766E" }}>
          <Fish className="w-5 h-5 text-white animate-float" />
        </div>
        <p className="text-slate-500 text-sm font-medium">Carregando...</p>
      </div>
    </div>
  );
}
