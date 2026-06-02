"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Fish, LayoutDashboard, Package, Tags, MapPin, BarChart2,
  LogOut, Menu, X, ChevronRight, Tag, Banknote, Settings,
  ChefHat,
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

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [authed, setAuthed]   = useState<boolean | null>(null);
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
    <div className="min-h-dvh flex" style={{ background: "#061208" }}>
      {/* Desktop Sidebar */}
      <aside
        className="hidden lg:flex flex-col w-64 glass border-r border-white/[0.06] sticky top-0 h-dvh"
      >
        <SidebarContent pathname={pathname} onLogout={handleLogout} />
      </aside>

      {/* Mobile overlay */}
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
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="lg:hidden fixed left-0 top-0 h-dvh w-64 z-50 flex flex-col"
              style={{ background: "#0d1f16", borderRight: "1px solid rgba(255,255,255,0.08)" }}
            >
              <button
                onClick={() => setSidebarOpen(false)}
                className="absolute top-4 right-4 btn-ghost p-2 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
              <SidebarContent pathname={pathname} onLogout={handleLogout} onNavClick={() => setSidebarOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile topbar */}
        <header className="lg:hidden glass border-b border-white/[0.06] px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="btn-ghost p-2 rounded-xl">
            <Menu className="w-5 h-5" />
          </button>
          <Fish className="w-5 h-5 text-gold-500" />
          <span className="font-display font-semibold text-gold-400 text-sm">WillTech Pesqueiros</span>
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
  onLogout,
  onNavClick,
}: {
  pathname: string;
  onLogout: () => void;
  onNavClick?: () => void;
}) {
  return (
    <>
      {/* Brand */}
      <div className="p-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, #1a3a2a, #2d6a4f)", boxShadow: "0 0 20px rgba(45,106,79,0.3)" }}
          >
            <Fish className="w-5 h-5 text-gold-500" />
          </div>
          <div>
            <p className="font-display font-bold text-gold-400 text-sm leading-none">WillTech</p>
            <p className="text-forest-500 text-xs">Pesqueiros</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavClick}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                active
                  ? "bg-gradient-to-r from-forest-700/60 to-forest-600/30 text-gold-400 border border-forest-500/30"
                  : "text-forest-400 hover:bg-forest-900/60 hover:text-forest-100"
              }`}
            >
              <Icon className={`w-5 h-5 shrink-0 ${active ? "text-gold-500" : "text-forest-600 group-hover:text-forest-400"}`} />
              <span className="text-sm font-medium flex-1">{label}</span>
              {active && <ChevronRight className="w-3.5 h-3.5 text-gold-600" />}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-white/[0.06]">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-forest-500 hover:text-red-400 hover:bg-red-500/5 transition-all text-sm"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </>
  );
}

function AdminLoadingScreen() {
  return (
    <div className="min-h-dvh flex items-center justify-center" style={{ background: "#061208" }}>
      <div className="flex flex-col items-center gap-4">
        <Fish className="w-10 h-10 text-gold-500 animate-float" />
        <p className="text-forest-400 text-sm">Carregando...</p>
      </div>
    </div>
  );
}
