"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Terminal, Shield, UserPlus, Trash2, Eye, EyeOff,
  CheckCircle2, XCircle, RefreshCw, Lock, LogOut, AlertTriangle,
  BarChart3, Users, Activity, ChefHat, GlassWater, Fish,
  Banknote, TableProperties, Zap, Clock,
} from "lucide-react";
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged, type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

const DEV_EMAIL = "willydev01@gmail.com";

/* ── Types ─────────────────────────────────────────────── */
type Tab = "overview" | "admins" | "atendentes" | "logs";

interface AdminUser { id: string; nome: string; email: string; ativo: boolean; criadoEm: string | null }
interface AtendenteUser { id: string; nome: string; email: string; ativo: boolean; setores?: string[]; criadoEm: string | null }
interface Stats {
  pedidosHoje: number; receitaHoje: number; taxaHoje: number;
  pedidosAtivos: number; admins: number; atendentes: number;
  piquesTotal: number; piquesOcupados: number;
  recentLogs: LogItem[];
}
interface LogItem { id: string; tipo: string; mensagem: string; ator: string; criadoEm: string | null }

/* ── API helper ─────────────────────────────────────────── */
async function devApi(user: User, path: string, init?: RequestInit) {
  const idToken = await user.getIdToken();
  return fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
}

/* ── Formatters ─────────────────────────────────────────── */
const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function relTime(iso: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "agora";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min atrás`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h atrás`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

const LOG_COLORS: Record<string, string> = {
  admin_criado:           "text-[#3FB950]",
  admin_removido:         "text-red-400",
  admin_ativado:          "text-[#3FB950]",
  admin_desativado:       "text-amber-400",
  atendente_criado:       "text-[#58A6FF]",
  atendente_removido:     "text-red-400",
  atendente_ativado:      "text-[#58A6FF]",
  atendente_desativado:   "text-amber-400",
  dev_login:              "text-purple-400",
  info:                   "text-[#8B949E]",
};

/* ══════════════════════════════════════════════════════════
   Main page
══════════════════════════════════════════════════════════ */
export default function WillyDevPage() {
  const [user, setUser]           = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab]             = useState<Tab>("overview");

  // Login form
  const [emailInput, setEmailInput] = useState(DEV_EMAIL);
  const [senhaInput, setSenhaInput] = useState("");
  const [showSenha, setShowSenha]   = useState(false);
  const [authError, setAuthError]   = useState("");
  const [logging, setLogging]       = useState(false);
  const [initializing, setInitializing] = useState(false);

  // Data
  const [stats, setStats]               = useState<Stats | null>(null);
  const [admins, setAdmins]             = useState<AdminUser[]>([]);
  const [atendentes, setAtendentes]     = useState<AtendenteUser[]>([]);
  const [logs, setLogs]                 = useState<LogItem[]>([]);

  // Loading
  const [loadingStats, setLoadingStats]         = useState(false);
  const [loadingAdmins, setLoadingAdmins]       = useState(false);
  const [loadingAtendentes, setLoadingAtendentes] = useState(false);
  const [loadingLogs, setLoadingLogs]           = useState(false);

  // Admin form
  const [adminForm, setAdminForm]   = useState({ nome: "", email: "", senha: "" });
  const [adminFormShow, setAdminFormShow] = useState(false);
  const [adminSenhaVis, setAdminSenhaVis] = useState(false);
  const [adminErr, setAdminErr]     = useState("");
  const [adminOk, setAdminOk]       = useState("");
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [togglingAdmin, setTogglingAdmin] = useState<string | null>(null);
  const [deletingAdmin, setDeletingAdmin] = useState<string | null>(null);
  const [confirmDeleteAdmin, setConfirmDeleteAdmin] = useState<AdminUser | null>(null);

  // Atendente form
  const [atForm, setAtForm]         = useState({ nome: "", email: "", senha: "", setores: ["cozinha", "bar"] as string[] });
  const [atFormShow, setAtFormShow] = useState(false);
  const [atSenhaVis, setAtSenhaVis] = useState(false);
  const [atErr, setAtErr]           = useState("");
  const [atOk, setAtOk]             = useState("");
  const [savingAt, setSavingAt]     = useState(false);
  const [togglingAt, setTogglingAt] = useState<string | null>(null);
  const [deletingAt, setDeletingAt] = useState<string | null>(null);
  const [confirmDeleteAt, setConfirmDeleteAt] = useState<AtendenteUser | null>(null);

  const loadedTabs = useRef(new Set<Tab>());

  /* ── Auth state ───────────────────────────────────────── */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u && u.email === DEV_EMAIL) {
        setUser(u);
        // Log login
        void devApi(u, "/api/dev/logs", {
          method: "POST",
          body: JSON.stringify({ tipo: "dev_login", mensagem: "Login no painel de desenvolvedor.", ator: DEV_EMAIL }),
        });
      } else {
        if (u) await signOut(auth); // wrong account
        setUser(null);
      }
      setAuthChecked(true);
    });
    return unsub;
  }, []);

  /* ── Data loaders ─────────────────────────────────────── */
  const loadStats = useCallback(async (u: User) => {
    setLoadingStats(true);
    try {
      const res  = await devApi(u, "/api/dev/stats");
      const data = await res.json() as Stats;
      setStats(data);
    } finally { setLoadingStats(false); }
  }, []);

  const loadAdmins = useCallback(async (u: User) => {
    setLoadingAdmins(true);
    try {
      const res  = await devApi(u, "/api/dev/admins");
      const data = await res.json() as { admins: AdminUser[] };
      setAdmins(data.admins ?? []);
    } finally { setLoadingAdmins(false); }
  }, []);

  const loadAtendentes = useCallback(async (u: User) => {
    setLoadingAtendentes(true);
    try {
      const res  = await devApi(u, "/api/dev/atendentes");
      const data = await res.json() as { atendentes: AtendenteUser[] };
      setAtendentes(data.atendentes ?? []);
    } finally { setLoadingAtendentes(false); }
  }, []);

  const loadLogs = useCallback(async (u: User) => {
    setLoadingLogs(true);
    try {
      const res  = await devApi(u, "/api/dev/logs");
      const data = await res.json() as { logs: LogItem[] };
      setLogs(data.logs ?? []);
    } finally { setLoadingLogs(false); }
  }, []);

  // Load data when tab changes
  useEffect(() => {
    if (!user) return;
    if (loadedTabs.current.has(tab)) return;
    loadedTabs.current.add(tab);

    if (tab === "overview")    loadStats(user);
    if (tab === "admins")      loadAdmins(user);
    if (tab === "atendentes")  loadAtendentes(user);
    if (tab === "logs")        loadLogs(user);
  }, [tab, user, loadStats, loadAdmins, loadAtendentes, loadLogs]);

  // Auto-load overview on login
  useEffect(() => {
    if (user) {
      loadedTabs.current.add("overview");
      loadStats(user);
    }
  }, [user, loadStats]);

  /* ── Login ────────────────────────────────────────────── */
  const handleInit = async () => {
    setInitializing(true);
    try {
      await fetch("/api/dev/init", { method: "POST" });
    } finally { setInitializing(false); }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    if (emailInput !== DEV_EMAIL) {
      setAuthError("Acesso permitido apenas para a conta de desenvolvedor.");
      return;
    }
    setLogging(true);
    try {
      await signInWithEmailAndPassword(auth, emailInput, senhaInput);
      // onAuthStateChanged handles the rest
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "auth/user-not-found" || code === "auth/invalid-credential") {
        setAuthError("Conta não encontrada. Clique em Inicializar primeiro.");
      } else if (code === "auth/wrong-password" || code === "auth/invalid-login-credentials") {
        setAuthError("Senha incorreta.");
      } else {
        setAuthError("Erro ao entrar. Tente novamente.");
      }
    } finally { setLogging(false); }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    loadedTabs.current.clear();
    setStats(null); setAdmins([]); setAtendentes([]); setLogs([]);
  };

  /* ── Admin CRUD ───────────────────────────────────────── */
  const criarAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setAdminErr(""); setAdminOk(""); setSavingAdmin(true);
    try {
      const res  = await devApi(user, "/api/dev/admins", { method: "POST", body: JSON.stringify(adminForm) });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { setAdminErr(data.error ?? "Erro."); return; }
      setAdminOk(`Admin "${adminForm.nome}" criado.`);
      setAdminForm({ nome: "", email: "", senha: "" });
      setAdminFormShow(false);
      await loadAdmins(user);
    } finally { setSavingAdmin(false); }
  };

  const toggleAdmin = async (admin: AdminUser) => {
    if (!user) return;
    setTogglingAdmin(admin.id);
    try {
      const res = await devApi(user, `/api/dev/admins/${admin.id}`, { method: "PATCH", body: JSON.stringify({ ativo: !admin.ativo }) });
      if (res.ok) setAdmins((p) => p.map((a) => a.id === admin.id ? { ...a, ativo: !a.ativo } : a));
    } finally { setTogglingAdmin(null); }
  };

  const deletarAdmin = async (admin: AdminUser) => {
    if (!user) return;
    setDeletingAdmin(admin.id); setConfirmDeleteAdmin(null);
    try {
      const res = await devApi(user, `/api/dev/admins/${admin.id}`, { method: "DELETE" });
      if (res.ok) setAdmins((p) => p.filter((a) => a.id !== admin.id));
    } finally { setDeletingAdmin(null); }
  };

  /* ── Atendente CRUD ───────────────────────────────────── */
  const toggleSetorAt = (setor: string) => {
    setAtForm((prev) => {
      const has = prev.setores.includes(setor);
      if (has && prev.setores.length === 1) return prev; // minimum 1
      return { ...prev, setores: has ? prev.setores.filter((s) => s !== setor) : [...prev.setores, setor] };
    });
  };

  const criarAtendente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setAtErr(""); setAtOk(""); setSavingAt(true);
    try {
      // Uses the existing admin atendentes endpoint with fixed admin token
      const res  = await fetch("/api/admin/atendentes", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": "WILLTECH_ADMIN_FIXED_TOKEN" },
        body: JSON.stringify({ nome: atForm.nome, email: atForm.email, senha: atForm.senha, setores: atForm.setores }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { setAtErr(data.error ?? "Erro."); return; }
      setAtOk(`Atendente "${atForm.nome}" criado.`);
      setAtForm({ nome: "", email: "", senha: "", setores: ["cozinha", "bar"] });
      setAtFormShow(false);
      await loadAtendentes(user);
      // Write log
      await devApi(user, "/api/dev/logs", {
        method: "POST",
        body: JSON.stringify({ tipo: "atendente_criado", mensagem: `Atendente "${atForm.nome}" criado via dev panel.`, ator: DEV_EMAIL }),
      });
    } finally { setSavingAt(false); }
  };

  const toggleAtendente = async (at: AtendenteUser) => {
    if (!user) return;
    setTogglingAt(at.id);
    try {
      const res = await fetch(`/api/admin/atendentes/${at.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": "WILLTECH_ADMIN_FIXED_TOKEN" },
        body: JSON.stringify({ ativo: !at.ativo }),
      });
      if (res.ok) {
        setAtendentes((p) => p.map((a) => a.id === at.id ? { ...a, ativo: !a.ativo } : a));
        await devApi(user, "/api/dev/logs", {
          method: "POST",
          body: JSON.stringify({ tipo: at.ativo ? "atendente_desativado" : "atendente_ativado", mensagem: `Atendente ${at.email} ${at.ativo ? "desativado" : "ativado"}.`, ator: DEV_EMAIL }),
        });
      }
    } finally { setTogglingAt(null); }
  };

  const deletarAtendente = async (at: AtendenteUser) => {
    if (!user) return;
    setDeletingAt(at.id); setConfirmDeleteAt(null);
    try {
      const res = await fetch(`/api/admin/atendentes/${at.id}`, {
        method: "DELETE",
        headers: { "x-admin-token": "WILLTECH_ADMIN_FIXED_TOKEN" },
      });
      if (res.ok) {
        setAtendentes((p) => p.filter((a) => a.id !== at.id));
        await devApi(user, "/api/dev/logs", {
          method: "POST",
          body: JSON.stringify({ tipo: "atendente_removido", mensagem: `Atendente ${at.email} removido.`, ator: DEV_EMAIL }),
        });
      }
    } finally { setDeletingAt(null); }
  };

  /* ── Render helpers ───────────────────────────────────── */
  const refreshTab = () => {
    if (!user) return;
    loadedTabs.current.delete(tab);
    if (tab === "overview")   loadStats(user);
    if (tab === "admins")     loadAdmins(user);
    if (tab === "atendentes") loadAtendentes(user);
    if (tab === "logs")       loadLogs(user);
    loadedTabs.current.add(tab);
  };

  /* ════════════════════════════════════════════════════════
     LOGIN SCREEN
  ════════════════════════════════════════════════════════ */
  if (!authChecked) {
    return (
      <main className="min-h-dvh bg-[#0D1117] flex items-center justify-center">
        <RefreshCw className="w-6 h-6 text-[#58A6FF] animate-spin" />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-dvh bg-[#0D1117] flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          {/* Brand */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-[#161B22] border border-[#30363D] flex items-center justify-center">
              <Terminal className="w-5 h-5 text-[#58A6FF]" />
            </div>
            <div>
              <p className="text-white font-mono font-bold">WillyDev</p>
              <p className="text-[#8B949E] font-mono text-xs">painel de desenvolvedores</p>
            </div>
          </div>

          <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Lock className="w-4 h-4 text-[#F0883E]" />
              <p className="text-[#E6EDF3] font-semibold text-sm">Acesso restrito</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <label className="text-[#8B949E] text-xs font-medium block mb-1">E-mail</label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl px-3 py-2.5 text-[#E6EDF3] font-mono text-sm placeholder-[#484F58] outline-none focus:border-[#58A6FF] transition-colors"
                />
              </div>
              <div className="relative">
                <label className="text-[#8B949E] text-xs font-medium block mb-1">Senha</label>
                <input
                  type={showSenha ? "text" : "password"}
                  value={senhaInput}
                  onChange={(e) => setSenhaInput(e.target.value)}
                  placeholder="••••••••"
                  autoFocus
                  className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl px-3 py-2.5 pr-10 text-[#E6EDF3] text-sm placeholder-[#484F58] outline-none focus:border-[#58A6FF] transition-colors"
                />
                <button type="button" onClick={() => setShowSenha((v) => !v)}
                  className="absolute right-3 bottom-2.5 text-[#8B949E] hover:text-[#E6EDF3]">
                  {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {authError && (
                <p className="text-red-400 text-xs flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5 shrink-0" /> {authError}
                </p>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleInit}
                  disabled={initializing}
                  className="py-2.5 rounded-xl border border-[#30363D] text-[#8B949E] hover:text-[#E6EDF3] text-xs font-medium transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {initializing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  {initializing ? "Inicializando..." : "Inicializar conta"}
                </button>
                <button
                  type="submit"
                  disabled={!senhaInput || logging}
                  className="py-2.5 rounded-xl bg-[#238636] hover:bg-[#2EA043] text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {logging ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                  {logging ? "Entrando..." : "Entrar"}
                </button>
              </div>
            </form>
          </div>

          <p className="text-center text-[#484F58] text-xs mt-5 font-mono">
            sistema-pesquepague · WillTech
          </p>
        </motion.div>
      </main>
    );
  }

  /* ════════════════════════════════════════════════════════
     MAIN PANEL
  ════════════════════════════════════════════════════════ */
  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "overview",   label: "Visão Geral",  icon: BarChart3    },
    { id: "admins",     label: "Admins",        icon: Shield       },
    { id: "atendentes", label: "Atendentes",    icon: Users        },
    { id: "logs",       label: "Logs",          icon: Activity     },
  ];

  return (
    <main className="min-h-dvh bg-[#0D1117]">
      {/* Header */}
      <header className="border-b border-[#21262D] bg-[#161B22] sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Terminal className="w-5 h-5 text-[#58A6FF] shrink-0" />
          <span className="text-[#E6EDF3] font-mono font-bold text-sm">WillyDev</span>
          <span className="text-[#484F58] font-mono text-sm">/</span>
          <span className="text-[#8B949E] font-mono text-sm hidden sm:block">sistema-pesquepague</span>

          {/* Tabs */}
          <nav className="flex items-center gap-1 ml-4 overflow-x-auto">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  tab === id
                    ? "bg-[#0D1117] text-[#58A6FF] border border-[#30363D]"
                    : "text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#0D1117]/60"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button onClick={refreshTab} className="p-1.5 rounded-lg text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#0D1117]/60 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[#8B949E] hover:text-red-400 hover:bg-red-400/10 transition-colors text-xs border border-[#30363D]"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {/* ── OVERVIEW ─────────────────────────────────── */}
          {tab === "overview" && (
            <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <h2 className="text-[#E6EDF3] font-semibold">Visão Geral do Sistema</h2>

              {loadingStats ? (
                <div className="flex justify-center py-16"><RefreshCw className="w-6 h-6 text-[#58A6FF] animate-spin" /></div>
              ) : stats ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatCard icon={Banknote}       label="Pedidos hoje"     value={String(stats.pedidosHoje)}      accent="text-[#3FB950]" />
                    <StatCard icon={Banknote}       label="Receita hoje"     value={brl(stats.receitaHoje)}         accent="text-[#3FB950]" highlight />
                    <StatCard icon={Clock}          label="Pedidos ativos"   value={String(stats.pedidosAtivos)}    accent="text-amber-400" />
                    <StatCard icon={Banknote}       label="Taxa de serviço"  value={brl(stats.taxaHoje)}            accent="text-[#58A6FF]" />
                    <StatCard icon={Shield}         label="Administradores"  value={String(stats.admins)}           accent="text-purple-400" />
                    <StatCard icon={Users}          label="Atendentes"       value={String(stats.atendentes)}       accent="text-[#58A6FF]" />
                    <StatCard icon={TableProperties} label="Mesas ativas"    value={String(stats.piquesTotal)}      accent="text-[#8B949E]" />
                    <StatCard icon={Fish}           label="Mesas ocupadas"   value={String(stats.piquesOcupados)}   accent="text-amber-400" />
                  </div>

                  {stats.recentLogs.length > 0 && (
                    <div className="bg-[#161B22] border border-[#30363D] rounded-2xl overflow-hidden">
                      <p className="text-[#8B949E] text-xs font-semibold uppercase tracking-widest px-5 py-3 border-b border-[#21262D]">
                        Atividade recente
                      </p>
                      <div className="divide-y divide-[#21262D]">
                        {stats.recentLogs.map((log) => (
                          <div key={log.id} className="flex items-start gap-3 px-5 py-3">
                            <span className={`text-[10px] font-mono font-bold shrink-0 mt-0.5 ${LOG_COLORS[log.tipo] ?? "text-[#8B949E]"}`}>
                              {log.tipo}
                            </span>
                            <p className="text-[#E6EDF3] text-xs flex-1">{log.mensagem}</p>
                            <span className="text-[#484F58] text-[10px] shrink-0">{relTime(log.criadoEm)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-[#8B949E] text-sm">Nenhum dado disponível.</p>
              )}
            </motion.div>
          )}

          {/* ── ADMINS ───────────────────────────────────── */}
          {tab === "admins" && (
            <motion.div key="admins" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="flex items-center gap-3">
                <h2 className="text-[#E6EDF3] font-semibold flex-1">Administradores</h2>
                <button
                  onClick={() => { setAdminFormShow((v) => !v); setAdminErr(""); setAdminOk(""); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#238636] hover:bg-[#2EA043] text-white text-xs font-semibold transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Novo admin
                </button>
              </div>

              <AnimatePresence>
                {adminFormShow && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="bg-[#161B22] border border-[#30363D] rounded-2xl overflow-hidden">
                    <form onSubmit={criarAdmin} className="p-5 space-y-3">
                      <div className="grid sm:grid-cols-2 gap-3">
                        <DevInput label="Nome" value={adminForm.nome} onChange={(v) => setAdminForm({ ...adminForm, nome: v })} placeholder="João Gerente" />
                        <DevInput label="E-mail" type="email" value={adminForm.email} onChange={(v) => setAdminForm({ ...adminForm, email: v })} placeholder="admin@pesqueiro.com" />
                      </div>
                      <DevInput label="Senha" type={adminSenhaVis ? "text" : "password"} value={adminForm.senha}
                        onChange={(v) => setAdminForm({ ...adminForm, senha: v })} placeholder="mín. 6 caracteres"
                        action={<button type="button" onClick={() => setAdminSenhaVis((v) => !v)} className="text-[#8B949E] hover:text-[#E6EDF3]">
                          {adminSenhaVis ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>} />
                      {adminErr && <p className="text-red-400 text-xs flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" />{adminErr}</p>}
                      {adminOk  && <p className="text-[#3FB950] text-xs flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" />{adminOk}</p>}
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setAdminFormShow(false)} className="flex-1 py-2 rounded-xl border border-[#30363D] text-[#8B949E] text-sm">Cancelar</button>
                        <button type="submit" disabled={savingAdmin} className="flex-1 py-2 rounded-xl bg-[#238636] hover:bg-[#2EA043] text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                          {savingAdmin ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                          Criar
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              <UserList
                items={admins}
                loading={loadingAdmins}
                emptyText="Nenhum administrador cadastrado"
                togglingId={togglingAdmin}
                deletingId={deletingAdmin}
                onToggle={toggleAdmin}
                onDelete={(a) => setConfirmDeleteAdmin(a as AdminUser)}
                renderBadge={() => <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-semibold">admin</span>}
              />
            </motion.div>
          )}

          {/* ── ATENDENTES ───────────────────────────────── */}
          {tab === "atendentes" && (
            <motion.div key="atendentes" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="flex items-center gap-3">
                <h2 className="text-[#E6EDF3] font-semibold flex-1">Atendentes</h2>
                <button
                  onClick={() => { setAtFormShow((v) => !v); setAtErr(""); setAtOk(""); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#238636] hover:bg-[#2EA043] text-white text-xs font-semibold transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Novo atendente
                </button>
              </div>

              <AnimatePresence>
                {atFormShow && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="bg-[#161B22] border border-[#30363D] rounded-2xl overflow-hidden">
                    <form onSubmit={criarAtendente} className="p-5 space-y-3">
                      <div className="grid sm:grid-cols-2 gap-3">
                        <DevInput label="Nome" value={atForm.nome} onChange={(v) => setAtForm({ ...atForm, nome: v })} placeholder="Maria Atendente" />
                        <DevInput label="E-mail" type="email" value={atForm.email} onChange={(v) => setAtForm({ ...atForm, email: v })} placeholder="atendente@pesqueiro.com" />
                      </div>
                      <DevInput label="Senha" type={atSenhaVis ? "text" : "password"} value={atForm.senha}
                        onChange={(v) => setAtForm({ ...atForm, senha: v })} placeholder="mín. 6 caracteres"
                        action={<button type="button" onClick={() => setAtSenhaVis((v) => !v)} className="text-[#8B949E] hover:text-[#E6EDF3]">
                          {atSenhaVis ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>} />

                      <div>
                        <p className="text-[#8B949E] text-xs font-medium mb-1.5">Setores de atuação</p>
                        <div className="flex gap-2">
                          {(["cozinha", "bar"] as const).map((s) => (
                            <button key={s} type="button" onClick={() => toggleSetorAt(s)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                                atForm.setores.includes(s)
                                  ? s === "bar" ? "bg-blue-500/20 border-blue-500/40 text-blue-300" : "bg-orange-500/20 border-orange-500/40 text-orange-300"
                                  : "bg-[#0D1117] border-[#30363D] text-[#8B949E]"
                              }`}>
                              {s === "bar" ? <GlassWater className="w-3.5 h-3.5" /> : <ChefHat className="w-3.5 h-3.5" />}
                              {s === "bar" ? "Bar" : "Cozinha"}
                            </button>
                          ))}
                        </div>
                      </div>

                      {atErr && <p className="text-red-400 text-xs flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" />{atErr}</p>}
                      {atOk  && <p className="text-[#3FB950] text-xs flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" />{atOk}</p>}
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setAtFormShow(false)} className="flex-1 py-2 rounded-xl border border-[#30363D] text-[#8B949E] text-sm">Cancelar</button>
                        <button type="submit" disabled={savingAt} className="flex-1 py-2 rounded-xl bg-[#238636] hover:bg-[#2EA043] text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                          {savingAt ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                          Criar
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              <UserList
                items={atendentes}
                loading={loadingAtendentes}
                emptyText="Nenhum atendente cadastrado"
                togglingId={togglingAt}
                deletingId={deletingAt}
                onToggle={toggleAtendente}
                onDelete={(a) => setConfirmDeleteAt(a as AtendenteUser)}
                renderBadge={(item) => {
                  const at = item as AtendenteUser;
                  return (
                    <div className="flex gap-1">
                      {at.setores?.map((s) => (
                        <span key={s} className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                          s === "bar" ? "bg-blue-500/20 text-blue-300" : "bg-orange-500/20 text-orange-300"
                        }`}>{s === "bar" ? "🍺" : "🍳"}</span>
                      ))}
                    </div>
                  );
                }}
              />
            </motion.div>
          )}

          {/* ── LOGS ─────────────────────────────────────── */}
          {tab === "logs" && (
            <motion.div key="logs" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <h2 className="text-[#E6EDF3] font-semibold">Logs do Sistema</h2>

              {loadingLogs ? (
                <div className="flex justify-center py-16"><RefreshCw className="w-6 h-6 text-[#58A6FF] animate-spin" /></div>
              ) : logs.length === 0 ? (
                <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-12 text-center">
                  <Activity className="w-8 h-8 text-[#30363D] mx-auto mb-3" />
                  <p className="text-[#8B949E] text-sm">Nenhum log registrado ainda.</p>
                </div>
              ) : (
                <div className="bg-[#161B22] border border-[#30363D] rounded-2xl overflow-hidden">
                  <div className="divide-y divide-[#21262D]">
                    {logs.map((log) => (
                      <div key={log.id} className="flex items-start gap-3 px-5 py-3 hover:bg-[#0D1117]/40 transition-colors">
                        <span className={`text-[10px] font-mono font-bold shrink-0 mt-0.5 w-36 truncate ${LOG_COLORS[log.tipo] ?? "text-[#8B949E]"}`}>
                          {log.tipo}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[#E6EDF3] text-xs">{log.mensagem}</p>
                          <p className="text-[#484F58] text-[10px] mt-0.5 font-mono">{log.ator}</p>
                        </div>
                        <span className="text-[#484F58] text-[10px] shrink-0 whitespace-nowrap">{relTime(log.criadoEm)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Confirm delete admin ───────────────────────── */}
      <ConfirmModal
        item={confirmDeleteAdmin}
        onClose={() => setConfirmDeleteAdmin(null)}
        onConfirm={() => confirmDeleteAdmin && deletarAdmin(confirmDeleteAdmin)}
        label="administrador"
      />

      {/* ── Confirm delete atendente ───────────────────── */}
      <ConfirmModal
        item={confirmDeleteAt}
        onClose={() => setConfirmDeleteAt(null)}
        onConfirm={() => confirmDeleteAt && deletarAtendente(confirmDeleteAt)}
        label="atendente"
      />
    </main>
  );
}

/* ══════════════════════════════════════════════════════════
   Sub-components
══════════════════════════════════════════════════════════ */

function StatCard({ icon: Icon, label, value, accent, highlight }: {
  icon: React.ElementType; label: string; value: string; accent: string; highlight?: boolean;
}) {
  return (
    <div className={`bg-[#161B22] border rounded-2xl p-4 space-y-2 ${highlight ? "border-[#3FB950]/30" : "border-[#30363D]"}`}>
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${accent}`} />
        <span className="text-[#8B949E] text-xs">{label}</span>
      </div>
      <p className="font-bold text-lg text-[#E6EDF3] tracking-tight">{value}</p>
    </div>
  );
}

function DevInput({ label, value, onChange, placeholder, type = "text", action }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; action?: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[#8B949E] text-xs font-medium block mb-1.5">{label}</label>
      <div className="relative">
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required
          className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl px-3 py-2.5 text-[#E6EDF3] text-sm placeholder-[#484F58] outline-none focus:border-[#58A6FF] transition-colors pr-10" />
        {action && <div className="absolute right-3 top-1/2 -translate-y-1/2">{action}</div>}
      </div>
    </div>
  );
}

interface UserListItem { id: string; nome: string; email: string; ativo: boolean; criadoEm: string | null }

function UserList({ items, loading, emptyText, togglingId, deletingId, onToggle, onDelete, renderBadge }: {
  items: UserListItem[];
  loading: boolean;
  emptyText: string;
  togglingId: string | null;
  deletingId: string | null;
  onToggle: (item: UserListItem) => void;
  onDelete: (item: UserListItem) => void;
  renderBadge: (item: UserListItem) => React.ReactNode;
}) {
  if (loading) return <div className="flex justify-center py-12"><RefreshCw className="w-5 h-5 text-[#58A6FF] animate-spin" /></div>;

  return (
    <div className="bg-[#161B22] border border-[#30363D] rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-[#21262D]">
        <span className="text-[#8B949E] text-xs font-semibold uppercase tracking-widest flex-1">Usuários</span>
        <span className="text-[#8B949E] text-xs font-mono">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="flex flex-col items-center py-12 gap-3">
          <Users className="w-8 h-8 text-[#30363D]" />
          <p className="text-[#8B949E] text-sm">{emptyText}</p>
        </div>
      ) : (
        <div className="divide-y divide-[#21262D]">
          <AnimatePresence>
            {items.map((item) => (
              <motion.div key={item.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-3 px-5 py-3.5">
                <div className="w-9 h-9 rounded-full bg-[#0D1117] border border-[#30363D] flex items-center justify-center shrink-0 font-mono font-bold text-[#58A6FF] text-sm">
                  {item.nome.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[#E6EDF3] text-sm font-semibold truncate">{item.nome}</p>
                    {renderBadge(item)}
                  </div>
                  <p className="text-[#8B949E] text-xs font-mono truncate">{item.email}</p>
                  {item.criadoEm && (
                    <p className="text-[#484F58] text-[10px]">
                      {new Date(item.criadoEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" })}
                    </p>
                  )}
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  item.ativo ? "bg-[#3FB950]/10 text-[#3FB950] border-[#3FB950]/20" : "bg-red-500/10 text-red-400 border-red-500/20"
                }`}>
                  {item.ativo ? "ativo" : "inativo"}
                </span>
                <button onClick={() => onToggle(item)} disabled={togglingId === item.id}
                  title={item.ativo ? "Desativar" : "Ativar"}
                  className={`p-1.5 rounded-lg transition-colors ${item.ativo
                    ? "text-[#8B949E] hover:text-amber-400 hover:bg-amber-400/10"
                    : "text-[#8B949E] hover:text-[#3FB950] hover:bg-[#3FB950]/10"}`}>
                  {togglingId === item.id ? <RefreshCw className="w-4 h-4 animate-spin" />
                    : item.ativo ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                </button>
                <button onClick={() => onDelete(item)} disabled={deletingId === item.id}
                  className="p-1.5 rounded-lg text-[#8B949E] hover:text-red-400 hover:bg-red-400/10 transition-colors">
                  {deletingId === item.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function ConfirmModal({ item, onClose, onConfirm, label }: {
  item: UserListItem | null;
  onClose: () => void;
  onConfirm: () => void;
  label: string;
}) {
  return (
    <AnimatePresence>
      {item && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            className="bg-[#161B22] border border-[#30363D] rounded-2xl w-full max-w-sm p-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-[#E6EDF3] font-bold">Remover {label}?</h3>
                <p className="text-[#8B949E] text-xs mt-1 leading-relaxed">
                  <strong className="text-[#E6EDF3]">{item.nome}</strong> ({item.email}) será removido
                  permanentemente do Firebase Auth e do Firestore. Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#30363D] text-[#8B949E] hover:text-[#E6EDF3] text-sm transition-colors">Cancelar</button>
              <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                <Trash2 className="w-4 h-4" /> Remover
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
