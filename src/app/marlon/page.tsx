"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, UserPlus, Trash2, Eye, EyeOff, CheckCircle2, XCircle,
  RefreshCw, Lock, LogOut, AlertTriangle, Users, UserRound,
  Mail, KeyRound, ShieldOff, ShieldCheck, ChefHat, GlassWater,
  LayoutDashboard, Banknote, Package, Tags, MapPin, Tag,
  BarChart2, Settings, X, Building2,
} from "lucide-react";
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged, type User,
  browserLocalPersistence, setPersistence,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import type { AdminPermissao, SetorPedido } from "@/types";
import toast from "react-hot-toast";

/* ── Permission definitions ─────────────────────────────── */
export const ALL_PERMISSOES: { key: AdminPermissao; label: string; icon: React.ElementType; group: string }[] = [
  { key: "dashboard",     label: "Dashboard",     icon: LayoutDashboard, group: "Visão geral" },
  { key: "caixa",         label: "Caixa",         icon: Banknote,        group: "Operacional" },
  { key: "cozinha",       label: "Cozinha",       icon: ChefHat,         group: "Operacional" },
  { key: "bar",           label: "Bar",           icon: GlassWater,      group: "Operacional" },
  { key: "relatorios",    label: "Relatórios",    icon: BarChart2,       group: "Análise" },
  { key: "produtos",      label: "Produtos",      icon: Package,         group: "Cardápio" },
  { key: "categorias",    label: "Categorias",    icon: Tags,            group: "Cardápio" },
  { key: "promocoes",     label: "Promoções",     icon: Tag,             group: "Cardápio" },
  { key: "piques",        label: "Mesas",         icon: MapPin,          group: "Estrutura" },
  { key: "atendentes",    label: "Atendentes",    icon: UserRound,       group: "Pessoas" },
  { key: "usuarios",      label: "Usuários",      icon: Users,           group: "Pessoas" },
  { key: "configuracoes", label: "Configurações", icon: Settings,        group: "Sistema" },
];

const GROUPS = ["Visão geral", "Operacional", "Análise", "Cardápio", "Estrutura", "Pessoas", "Sistema"];

/* ── Types ─────────────────────────────────────────────── */
interface UsuarioItem {
  id: string; nome: string; email: string; role: string;
  ativo: boolean; setores: string[]; permissoes: AdminPermissao[];
  criadoEm: string | null;
}

/* ── API helper ─────────────────────────────────────────── */
async function marlonApi(user: User, path: string, init?: RequestInit) {
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

/* ══════════════════════════════════════════════════════════
   Page
══════════════════════════════════════════════════════════ */
export default function MarlonPage() {
  const [user, setUser]           = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Login
  const [emailIn, setEmailIn]     = useState("");
  const [senhaIn, setSenhaIn]     = useState("");
  const [showPwd, setShowPwd]     = useState(false);
  const [loginErr, setLoginErr]   = useState("");
  const [logging, setLogging]     = useState(false);


  // Data
  const [usuarios, setUsuarios]   = useState<UsuarioItem[]>([]);
  const [loading, setLoading]     = useState(false);

  // Create user
  const [createModal, setCreateModal] = useState(false);
  const [createForm, setCreateForm]   = useState({
    nome: "", email: "", senha: "", role: "admin" as "admin" | "atendente",
    setores: ["cozinha", "bar"] as string[],
    permissoes: [] as AdminPermissao[],
    senhaVis: false,
  });
  const [creating, setCreating]   = useState(false);

  // Edit permissions
  const [editUser, setEditUser]   = useState<UsuarioItem | null>(null);
  const [editPerms, setEditPerms] = useState<AdminPermissao[]>([]);
  const [editSetores, setEditSetores] = useState<string[]>([]);
  const [savingPerms, setSavingPerms] = useState(false);

  // Reset password
  const [resetUser, setResetUser] = useState<UsuarioItem | null>(null);
  const [resetSenha, setResetSenha] = useState("");
  const [resetVis, setResetVis]   = useState(false);
  const [savingReset, setSavingReset] = useState(false);

  // Confirm delete
  const [deleteTarget, setDeleteTarget] = useState<UsuarioItem | null>(null);
  const [deleting, setDeleting]   = useState(false);

  /* ── Auth ───────────────────────────────────────────────── */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const token = await u.getIdTokenResult();
        if (token.claims["role"] === "marlon") {
          setUser(u);
        } else {
          await signOut(auth);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setAuthChecked(true);
    });
    return unsub;
  }, []);

  /* ── Load users ─────────────────────────────────────────── */
  const loadUsuarios = useCallback(async (u: User) => {
    setLoading(true);
    try {
      const res  = await marlonApi(u, "/api/marlon/usuarios");
      const data = await res.json() as { usuarios: UsuarioItem[] };
      setUsuarios(data.usuarios ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (user) loadUsuarios(user);
  }, [user, loadUsuarios]);

  /* ── Login ──────────────────────────────────────────────── */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErr("");
    setLogging(true);
    try {
      await setPersistence(auth, browserLocalPersistence);
      const cred  = await signInWithEmailAndPassword(auth, emailIn, senhaIn);
      const token = await cred.user.getIdTokenResult();
      if (token.claims["role"] !== "marlon") {
        await signOut(auth);
        setLoginErr("Esta conta não tem acesso ao painel Marlon.");
      }
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
        setLoginErr("E-mail ou senha incorretos.");
      } else if (code === "auth/user-not-found") {
        setLoginErr("Conta não encontrada. Inicialize primeiro.");
      } else {
        setLoginErr("Erro ao entrar. Tente novamente.");
      }
    } finally { setLogging(false); }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setUsuarios([]);
  };

  /* ── Create user ────────────────────────────────────────── */
  const toggleCreatePerm = (key: AdminPermissao) => {
    setCreateForm((f) => ({
      ...f,
      permissoes: f.permissoes.includes(key)
        ? f.permissoes.filter((p) => p !== key)
        : [...f.permissoes, key],
    }));
  };
  const toggleCreateSetor = (s: string) => {
    setCreateForm((f) => {
      const has = f.setores.includes(s);
      if (has && f.setores.length === 1) return f;
      return { ...f, setores: has ? f.setores.filter((x) => x !== s) : [...f.setores, s] };
    });
  };

  const handleCreate = async () => {
    const { nome, email, senha, role, setores, permissoes } = createForm;
    if (!nome.trim())    return toast.error("Informe o nome.");
    if (!email.trim())   return toast.error("Informe o e-mail.");
    if (senha.length < 6) return toast.error("Senha com no mínimo 6 caracteres.");

    setCreating(true);
    try {
      const res  = await marlonApi(user!, "/api/marlon/usuarios", {
        method: "POST",
        body: JSON.stringify({ nome: nome.trim(), email: email.trim(), senha, role, setores, permissoes }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { toast.error(data.error ?? "Erro."); return; }
      toast.success(`${role === "admin" ? "Admin" : "Atendente"} "${nome}" criado!`);
      setCreateModal(false);
      setCreateForm({ nome: "", email: "", senha: "", role: "admin", setores: ["cozinha", "bar"], permissoes: [], senhaVis: false });
      await loadUsuarios(user!);
    } finally { setCreating(false); }
  };

  /* ── Edit permissions ───────────────────────────────────── */
  const openEdit = (u: UsuarioItem) => {
    setEditUser(u);
    setEditPerms([...u.permissoes]);
    setEditSetores([...(u.setores ?? ["cozinha", "bar"])]);
  };

  const toggleEditPerm = (key: AdminPermissao) => {
    setEditPerms((p) => p.includes(key) ? p.filter((x) => x !== key) : [...p, key]);
  };
  const toggleEditSetor = (s: string) => {
    setEditSetores((cur) => {
      const has = cur.includes(s);
      if (has && cur.length === 1) return cur;
      return has ? cur.filter((x) => x !== s) : [...cur, s];
    });
  };

  const selectAllPerms = () => setEditPerms(ALL_PERMISSOES.map((p) => p.key));
  const clearAllPerms  = () => setEditPerms([]);

  const savePerms = async () => {
    if (!user || !editUser) return;
    setSavingPerms(true);
    try {
      const body: Record<string, unknown> = editUser.role === "admin"
        ? { permissoes: editPerms }
        : { setores: editSetores };
      const res = await marlonApi(user, `/api/marlon/usuarios/${editUser.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (!res.ok) { toast.error("Erro ao salvar."); return; }
      toast.success("Permissões atualizadas.");
      setEditUser(null);
      await loadUsuarios(user);
    } finally { setSavingPerms(false); }
  };

  /* ── Toggle ativo ───────────────────────────────────────── */
  const toggleAtivo = async (u: UsuarioItem) => {
    if (!user) return;
    try {
      await marlonApi(user, `/api/marlon/usuarios/${u.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ativo: !u.ativo }),
      });
      setUsuarios((list) => list.map((x) => x.id === u.id ? { ...x, ativo: !u.ativo } : x));
      toast.success(u.ativo ? "Acesso bloqueado." : "Acesso reativado.");
    } catch { toast.error("Erro."); }
  };

  /* ── Reset password ─────────────────────────────────────── */
  const saveResetSenha = async () => {
    if (!user || !resetUser) return;
    if (resetSenha.length < 6) return toast.error("Senha com no mínimo 6 caracteres.");
    setSavingReset(true);
    try {
      const res = await marlonApi(user, `/api/marlon/usuarios/${resetUser.id}`, {
        method: "PATCH",
        body: JSON.stringify({ senha: resetSenha }),
      });
      if (!res.ok) { toast.error("Erro ao redefinir senha."); return; }
      toast.success("Senha redefinida.");
      setResetUser(null); setResetSenha("");
    } finally { setSavingReset(false); }
  };

  /* ── Delete ─────────────────────────────────────────────── */
  const confirmDelete = async () => {
    if (!user || !deleteTarget) return;
    setDeleting(true);
    try {
      const res = await marlonApi(user, `/api/marlon/usuarios/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) { toast.error("Erro ao remover."); return; }
      toast.success("Usuário removido.");
      setDeleteTarget(null);
      setUsuarios((list) => list.filter((x) => x.id !== deleteTarget.id));
    } finally { setDeleting(false); }
  };

  /* ════════════════════════════════════════════════════════
     LOGIN SCREEN
  ════════════════════════════════════════════════════════ */
  if (!authChecked) {
    return (
      <main className="min-h-dvh bg-forest-50 dark:bg-forest-950 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 text-forest-500 animate-spin" />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-dvh flex" style={{ background: "#F8FAFC" }}>
        {/* Left panel */}
        <div className="hidden lg:flex flex-col justify-between w-96 shrink-0 p-10" style={{ background: "#0F172A" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-gold-400" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">Admin Geral</p>
              <p className="text-slate-400 text-xs">Controle de acesso</p>
            </div>
          </div>
          <div className="space-y-4">
            <p className="text-slate-200 text-2xl font-bold leading-snug">
              Gerencie quem<br />acessa o quê.
            </p>
            <p className="text-slate-400 text-sm leading-relaxed">
              Crie usuários, defina permissões por seção e controle o acesso de toda a equipe ao sistema.
            </p>
          </div>
          <p className="text-slate-600 text-xs">sistema-pesquepague · WillTech</p>
        </div>

        {/* Login form */}
        <div className="flex-1 flex items-center justify-center p-6">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm space-y-6">
            <div className="lg:hidden flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl bg-gold-500/15 flex items-center justify-center">
                <Shield className="w-4 h-4 text-gold-600" />
              </div>
              <p className="font-bold text-forest-900">Admin Geral</p>
            </div>

            <div>
              <h1 className="text-2xl font-bold text-forest-900">Entrar</h1>
              <p className="text-forest-500 text-sm mt-1">Acesso restrito ao administrador geral.</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-3">
              <div className="space-y-1">
                <label className="text-forest-600 text-xs font-medium">E-mail</label>
                <input type="email" value={emailIn} onChange={(e) => setEmailIn(e.target.value)} required
                  className="input-field" placeholder="seu@email.com" autoFocus />
              </div>
              <div className="space-y-1">
                <label className="text-forest-600 text-xs font-medium">Senha</label>
                <div className="relative">
                  <input type={showPwd ? "text" : "password"} value={senhaIn}
                    onChange={(e) => setSenhaIn(e.target.value)} required
                    className="input-field pr-10" placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-forest-400 hover:text-forest-700">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {loginErr && (
                <p className="text-red-500 text-xs flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5 shrink-0" />{loginErr}
                </p>
              )}
              <button type="submit" disabled={logging}
                className="btn-gold w-full py-3 rounded-xl disabled:opacity-60 flex items-center justify-center gap-2">
                {logging ? <><RefreshCw className="w-4 h-4 animate-spin" /> Entrando...</> : <><Lock className="w-4 h-4" /> Entrar</>}
              </button>
            </form>
          </motion.div>
        </div>
      </main>
    );
  }

  /* ════════════════════════════════════════════════════════
     MAIN PANEL
  ════════════════════════════════════════════════════════ */
  const admins     = usuarios.filter((u) => u.role === "admin");
  const atendentes = usuarios.filter((u) => u.role === "atendente");

  return (
    <main className="min-h-dvh bg-forest-50 dark:bg-forest-950">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-forest-900 border-b border-forest-200 dark:border-forest-700 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gold-500/15 flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4 text-gold-600" />
          </div>
          <p className="font-bold text-forest-900 dark:text-forest-50 text-sm">Admin Geral</p>
          <span className="text-forest-300 dark:text-forest-600">·</span>
          <p className="text-forest-500 dark:text-forest-400 text-sm">Usuários & Permissões</p>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => loadUsuarios(user)} className="btn-ghost p-1.5 rounded-lg">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-forest-500 hover:text-red-500 hover:bg-red-500/10 transition-colors text-xs border border-forest-200 dark:border-forest-700">
              <LogOut className="w-3.5 h-3.5" /> Sair
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total",       value: usuarios.length,  icon: Users,     color: "text-forest-600 dark:text-forest-300", bg: "bg-forest-500/10" },
            { label: "Admins",      value: admins.length,    icon: Shield,    color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/10" },
            { label: "Atendentes",  value: atendentes.length,icon: UserRound, color: "text-gold-600 dark:text-gold-400",     bg: "bg-gold-500/10"   },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="glass rounded-2xl p-4 border border-forest-200 dark:border-forest-700">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${bg} mb-2`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className="text-2xl font-bold text-forest-900 dark:text-forest-50">{value}</p>
              <p className="text-forest-500 text-xs mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Users list */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="text-forest-900 dark:text-forest-50 font-semibold flex-1">Usuários</h2>
            <button onClick={() => {
              setCreateForm({ nome: "", email: "", senha: "", role: "admin", setores: ["cozinha", "bar"], permissoes: [], senhaVis: false });
              setCreateModal(true);
            }} className="btn-gold px-4 py-2 rounded-xl text-sm flex items-center gap-1.5">
              <UserPlus className="w-4 h-4" /> Novo usuário
            </button>
          </div>

          <div className="glass rounded-2xl overflow-hidden border border-forest-200 dark:border-forest-700">
            {loading ? (
              <div className="p-8 text-center text-forest-500 text-sm flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" /> Carregando...
              </div>
            ) : usuarios.length === 0 ? (
              <div className="flex flex-col items-center py-14 gap-3">
                <Users className="w-10 h-10 text-forest-300" />
                <p className="text-forest-500 text-sm">Nenhum usuário cadastrado</p>
              </div>
            ) : (
              <div className="divide-y divide-forest-100 dark:divide-forest-700">
                {usuarios.map((u) => (
                  <UsuarioRow
                    key={u.id}
                    user={u}
                    onEdit={() => openEdit(u)}
                    onToggle={() => toggleAtivo(u)}
                    onReset={() => { setResetUser(u); setResetSenha(""); setResetVis(false); }}
                    onDelete={() => setDeleteTarget(u)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Create modal ────────────────────────────────────── */}
      <AnimatePresence>
        {createModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setCreateModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="glass rounded-2xl w-full max-w-lg p-6 border border-forest-200 dark:border-forest-700 max-h-[90dvh] overflow-y-auto space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-lg text-forest-900 dark:text-forest-50">Novo usuário</h2>
                <button onClick={() => setCreateModal(false)} className="btn-ghost p-2 rounded-xl"><X className="w-4 h-4" /></button>
              </div>

              {/* Role selector */}
              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: "admin" as const,     label: "Administrador", icon: Shield,    desc: "Acesso ao painel" },
                  { value: "atendente" as const, label: "Atendente",     icon: UserRound, desc: "Acesso ao app" },
                ]).map(({ value, label, icon: Icon, desc }) => (
                  <button key={value} type="button" onClick={() => setCreateForm((f) => ({ ...f, role: value }))}
                    className={`flex flex-col items-center gap-1 py-3 rounded-xl border text-sm font-medium transition-all ${
                      createForm.role === value
                        ? value === "admin" ? "border-purple-500/60 bg-purple-500/15 text-purple-600 dark:text-purple-300" : "border-gold-500/60 bg-gold-500/15 text-gold-600 dark:text-gold-300"
                        : "border-forest-200 dark:border-forest-700 text-forest-500 hover:border-forest-300"
                    }`}>
                    <Icon className="w-5 h-5" />
                    <span>{label}</span>
                    <span className="text-[10px] opacity-60 font-normal">{desc}</span>
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <MField label="Nome"><input value={createForm.nome} onChange={(e) => setCreateForm((f) => ({ ...f, nome: e.target.value }))} className="input-field" placeholder="João Silva" /></MField>
                <MField label="E-mail"><input type="email" value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} className="input-field" placeholder="joao@email.com" /></MField>
                <MField label="Senha">
                  <div className="relative">
                    <input type={createForm.senhaVis ? "text" : "password"} value={createForm.senha}
                      onChange={(e) => setCreateForm((f) => ({ ...f, senha: e.target.value }))}
                      className="input-field pr-10" placeholder="Mínimo 6 caracteres" />
                    <button type="button" onClick={() => setCreateForm((f) => ({ ...f, senhaVis: !f.senhaVis }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-forest-400 hover:text-forest-700">
                      {createForm.senhaVis ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </MField>
              </div>

              <AnimatePresence>
                {createForm.role === "atendente" && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <MField label="Setores">
                      <div className="grid grid-cols-2 gap-2">
                        {(["cozinha", "bar"] as SetorPedido[]).map((s) => (
                          <button key={s} type="button" onClick={() => toggleCreateSetor(s)}
                            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                              createForm.setores.includes(s)
                                ? s === "bar" ? "border-blue-500/60 bg-blue-500/15 text-blue-400" : "border-orange-500/60 bg-orange-500/15 text-orange-400"
                                : "border-forest-200 dark:border-forest-700 text-forest-500"
                            }`}>
                            {s === "bar" ? <><GlassWater className="w-4 h-4" /> Bar</> : <><ChefHat className="w-4 h-4" /> Cozinha</>}
                          </button>
                        ))}
                      </div>
                    </MField>
                  </motion.div>
                )}
                {createForm.role === "admin" && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <PermissionGrid
                      selected={createForm.permissoes}
                      onToggle={toggleCreatePerm}
                      onSelectAll={() => setCreateForm((f) => ({ ...f, permissoes: ALL_PERMISSOES.map((p) => p.key) }))}
                      onClearAll={() => setCreateForm((f) => ({ ...f, permissoes: [] }))}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <button type="button" onClick={handleCreate} disabled={creating}
                className="btn-gold w-full py-3 rounded-xl disabled:opacity-60 flex items-center justify-center gap-2">
                {creating ? <><RefreshCw className="w-4 h-4 animate-spin" /> Criando...</> : <><UserPlus className="w-4 h-4" /> Criar usuário</>}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Edit permissions modal ───────────────────────────── */}
      <AnimatePresence>
        {editUser && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setEditUser(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="glass rounded-2xl w-full max-w-lg p-6 border border-forest-200 dark:border-forest-700 max-h-[90dvh] overflow-y-auto space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-forest-900 dark:text-forest-50">Permissões</h2>
                  <p className="text-forest-500 text-xs mt-0.5">{editUser.nome} · {editUser.email}</p>
                </div>
                <button onClick={() => setEditUser(null)} className="btn-ghost p-2 rounded-xl"><X className="w-4 h-4" /></button>
              </div>

              {editUser.role === "admin" ? (
                <PermissionGrid
                  selected={editPerms}
                  onToggle={toggleEditPerm}
                  onSelectAll={selectAllPerms}
                  onClearAll={clearAllPerms}
                />
              ) : (
                <div>
                  <p className="text-forest-500 text-xs font-medium mb-2">Setores de atuação</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(["cozinha", "bar"] as const).map((s) => (
                      <button key={s} type="button" onClick={() => toggleEditSetor(s)}
                        className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-all ${
                          editSetores.includes(s)
                            ? s === "bar" ? "border-blue-500/60 bg-blue-500/15 text-blue-400" : "border-orange-500/60 bg-orange-500/15 text-orange-400"
                            : "border-forest-200 dark:border-forest-700 text-forest-500"
                        }`}>
                        {s === "bar" ? <><GlassWater className="w-4 h-4" /> Bar</> : <><ChefHat className="w-4 h-4" /> Cozinha</>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {editUser.role === "admin" && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl p-3">
                  <p className="text-amber-700 dark:text-amber-400 text-xs">
                    <strong>Permissões vazias</strong> = acesso total a todas as seções. Marque seções específicas para restringir o acesso.
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setEditUser(null)} className="btn-ghost flex-1 py-2.5 rounded-xl text-sm">Cancelar</button>
                <button onClick={savePerms} disabled={savingPerms}
                  className="btn-gold flex-1 py-2.5 rounded-xl text-sm disabled:opacity-60 flex items-center justify-center gap-2">
                  {savingPerms ? <><RefreshCw className="w-4 h-4 animate-spin" /> Salvando...</> : "Salvar permissões"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Reset password modal ─────────────────────────────── */}
      <AnimatePresence>
        {resetUser && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setResetUser(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="glass rounded-2xl w-full max-w-sm p-6 space-y-4 border border-forest-200 dark:border-forest-700">
              <h2 className="font-bold text-forest-900 dark:text-forest-50">Redefinir senha</h2>
              <p className="text-forest-500 text-xs">{resetUser.nome} · {resetUser.email}</p>
              <div className="relative">
                <input type={resetVis ? "text" : "password"} value={resetSenha}
                  onChange={(e) => setResetSenha(e.target.value)} className="input-field pr-10"
                  placeholder="Nova senha (mín. 6)" />
                <button type="button" onClick={() => setResetVis((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-forest-400 hover:text-forest-700">
                  {resetVis ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setResetUser(null)} className="btn-ghost flex-1 py-2.5 rounded-xl text-sm">Cancelar</button>
                <button onClick={saveResetSenha} disabled={savingReset}
                  className="btn-gold flex-1 py-2.5 rounded-xl text-sm disabled:opacity-60">
                  {savingReset ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Confirm delete modal ─────────────────────────────── */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setDeleteTarget(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="glass rounded-2xl w-full max-w-sm p-6 space-y-4 border border-forest-200 dark:border-forest-700">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h3 className="font-bold text-forest-900 dark:text-forest-50">Remover usuário?</h3>
                  <p className="text-forest-500 text-xs mt-1 leading-relaxed">
                    <strong className="text-forest-700 dark:text-forest-200">{deleteTarget.nome}</strong> ({deleteTarget.email}) será removido permanentemente. Esta ação não pode ser desfeita.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setDeleteTarget(null)} className="btn-ghost flex-1 py-2.5 rounded-xl text-sm">Cancelar</button>
                <button onClick={confirmDelete} disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {deleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Remover
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

/* ── Sub-components ─────────────────────────────────────── */

function UsuarioRow({ user, onEdit, onToggle, onReset, onDelete }: {
  user: UsuarioItem;
  onEdit: () => void; onToggle: () => void; onReset: () => void; onDelete: () => void;
}) {
  const isAdmin    = user.role === "admin";
  const acessoTotal = isAdmin && user.permissoes.length === 0;

  return (
    <div className="px-4 py-4 space-y-3">
      {/* Header row */}
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          isAdmin ? "bg-purple-500/15" : user.ativo ? "bg-gold-500/15" : "bg-forest-200 dark:bg-forest-800"
        }`}>
          {isAdmin
            ? <Shield className={`w-5 h-5 ${user.ativo ? "text-purple-500" : "text-forest-400"}`} />
            : <UserRound className={`w-5 h-5 ${user.ativo ? "text-gold-600" : "text-forest-400"}`} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm text-forest-900 dark:text-forest-50 truncate">{user.nome}</p>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold border ${
              isAdmin ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                      : "bg-gold-500/10 text-gold-600 dark:text-gold-400 border-gold-500/20"
            }`}>{isAdmin ? "admin" : "atendente"}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold border ${
              user.ativo ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                         : "bg-red-500/10 text-red-500 border-red-500/20"
            }`}>{user.ativo ? "ativo" : "bloqueado"}</span>
          </div>
          <p className="text-xs text-forest-500 truncate flex items-center gap-1 mt-0.5">
            <Mail className="w-3 h-3 shrink-0" />{user.email}
          </p>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={onEdit} className="btn-ghost p-2 rounded-lg"
            title={isAdmin ? "Editar permissões" : "Editar setores"}>
            <Building2 className="w-4 h-4" />
          </button>
          <button onClick={onReset} className="btn-ghost p-2 rounded-lg" title="Redefinir senha">
            <KeyRound className="w-4 h-4" />
          </button>
          <button onClick={onToggle}
            className={`btn-ghost p-2 rounded-lg ${user.ativo ? "hover:text-red-500" : "hover:text-emerald-500"}`}
            title={user.ativo ? "Bloquear acesso" : "Reativar acesso"}>
            {user.ativo ? <ShieldOff className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
          </button>
          <button onClick={onDelete} className="btn-ghost p-2 rounded-lg hover:text-red-500" title="Remover usuário">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Admin: all ERP sections with granted/denied state */}
      {isAdmin && (
        <div className="pl-[52px] space-y-1.5">
          <p className="text-[10px] text-forest-400 font-semibold uppercase tracking-widest">
            {acessoTotal ? "Acesso total ao ERP" : "Acesso ao ERP"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ALL_PERMISSOES.map(({ key, label, icon: Icon }) => {
              const granted = acessoTotal || user.permissoes.includes(key);
              return (
                <span key={key} className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg font-medium border transition-colors ${
                  granted
                    ? "bg-gold-500/10 text-gold-700 dark:text-gold-300 border-gold-500/25"
                    : "bg-forest-100 dark:bg-forest-800/50 text-forest-400 dark:text-forest-500 border-forest-200 dark:border-forest-700 opacity-50"
                }`}>
                  <Icon className="w-3 h-3 shrink-0" />
                  {label}
                  {granted && <CheckCircle2 className="w-2.5 h-2.5 text-gold-500 dark:text-gold-400" />}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Atendente: setores */}
      {!isAdmin && (
        <div className="pl-[52px] space-y-1.5">
          <p className="text-[10px] text-forest-400 font-semibold uppercase tracking-widest">Setores</p>
          <div className="flex gap-1.5">
            {(["cozinha", "bar"] as const).map((s) => {
              const active = (user.setores ?? []).includes(s);
              return (
                <span key={s} className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-lg font-medium border ${
                  active
                    ? s === "bar"
                      ? "bg-blue-500/15 text-blue-500 dark:text-blue-300 border-blue-500/25"
                      : "bg-orange-500/15 text-orange-600 dark:text-orange-300 border-orange-500/25"
                    : "bg-forest-100 dark:bg-forest-800/50 text-forest-400 border-forest-200 dark:border-forest-700 opacity-50"
                }`}>
                  {s === "bar" ? <GlassWater className="w-3 h-3" /> : <ChefHat className="w-3 h-3" />}
                  {s === "bar" ? "Bar" : "Cozinha"}
                  {active && <CheckCircle2 className="w-2.5 h-2.5" />}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function PermissionGrid({ selected, onToggle, onSelectAll, onClearAll }: {
  selected: AdminPermissao[]; onToggle: (k: AdminPermissao) => void;
  onSelectAll: () => void; onClearAll: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-forest-600 dark:text-forest-300 text-xs font-semibold">
          Seções permitidas <span className="text-forest-400 font-normal">({selected.length === 0 ? "todas" : selected.length} selecionadas)</span>
        </p>
        <div className="flex gap-2">
          <button onClick={onSelectAll} className="text-[10px] text-forest-500 hover:text-forest-700 dark:hover:text-forest-200 underline underline-offset-2">Todas</button>
          <button onClick={onClearAll} className="text-[10px] text-forest-500 hover:text-forest-700 dark:hover:text-forest-200 underline underline-offset-2">Nenhuma</button>
        </div>
      </div>
      {GROUPS.map((group) => {
        const items = ALL_PERMISSOES.filter((p) => p.group === group);
        if (!items.length) return null;
        return (
          <div key={group}>
            <p className="text-forest-400 text-[10px] uppercase tracking-widest font-semibold mb-1.5">{group}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {items.map(({ key, label, icon: Icon }) => {
                const active = selected.includes(key);
                return (
                  <button key={key} type="button" onClick={() => onToggle(key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                      active
                        ? "border-gold-500/60 bg-gold-500/15 text-gold-700 dark:text-gold-300"
                        : "border-forest-200 dark:border-forest-700 text-forest-500 hover:border-forest-300"
                    }`}>
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    {label}
                    {active && <CheckCircle2 className="w-3 h-3 ml-auto text-gold-500" />}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-forest-500 text-xs font-medium">{label}</label>
      {children}
    </div>
  );
}
