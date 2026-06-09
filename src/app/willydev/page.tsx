"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Terminal, Shield, UserPlus, Trash2, Eye, EyeOff,
  CheckCircle2, XCircle, RefreshCw, Lock, LogOut, AlertTriangle,
} from "lucide-react";

const STORAGE_KEY = "wt_dev_token";

interface AdminUser {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  criadoEm: string | null;
}

function devFetch(path: string, token: string, init?: RequestInit) {
  return fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-dev-token": token,
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
}

export default function WillyDevPage() {
  const [token, setToken]           = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [showToken, setShowToken]   = useState(false);
  const [authError, setAuthError]   = useState("");
  const [autenticando, setAutenticando] = useState(false);

  const [admins, setAdmins]           = useState<AdminUser[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);

  const [form, setForm]       = useState({ nome: "", email: "", senha: "" });
  const [showSenha, setShowSenha] = useState(false);
  const [criando, setCriando] = useState(false);
  const [formError, setFormError] = useState("");
  const [formOk, setFormOk]   = useState("");

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) setToken(saved);
  }, []);

  const carregarAdmins = useCallback(async (t: string) => {
    setLoadingAdmins(true);
    try {
      const res = await devFetch("/api/dev/admins", t);
      if (res.status === 401) {
        sessionStorage.removeItem(STORAGE_KEY);
        setToken("");
        return;
      }
      const data = await res.json() as { admins?: AdminUser[] };
      setAdmins(data.admins ?? []);
    } finally {
      setLoadingAdmins(false);
    }
  }, []);

  useEffect(() => {
    if (token) carregarAdmins(token);
  }, [token, carregarAdmins]);

  const autenticar = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAutenticando(true);
    try {
      const res = await devFetch("/api/dev/admins", tokenInput.trim());
      if (res.ok) {
        sessionStorage.setItem(STORAGE_KEY, tokenInput.trim());
        setToken(tokenInput.trim());
      } else {
        setAuthError("Token inválido. Verifique e tente novamente.");
        setTokenInput("");
      }
    } catch {
      setAuthError("Não foi possível conectar ao servidor.");
    } finally {
      setAutenticando(false);
    }
  };

  const criarAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormOk("");
    setCriando(true);
    try {
      const res = await devFetch("/api/dev/admins", token, {
        method: "POST",
        body: JSON.stringify(form),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) {
        setFormError(data.error ?? "Erro ao criar.");
        return;
      }
      setFormOk(`Administrador "${form.nome}" criado com sucesso.`);
      setForm({ nome: "", email: "", senha: "" });
      await carregarAdmins(token);
    } finally {
      setCriando(false);
    }
  };

  const toggleAtivo = async (admin: AdminUser) => {
    setTogglingId(admin.id);
    try {
      const res = await devFetch(`/api/dev/admins/${admin.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ ativo: !admin.ativo }),
      });
      if (res.ok) {
        setAdmins((prev) =>
          prev.map((a) => (a.id === admin.id ? { ...a, ativo: !a.ativo } : a))
        );
      }
    } finally {
      setTogglingId(null);
    }
  };

  const deletarAdmin = async (admin: AdminUser) => {
    setDeletingId(admin.id);
    setConfirmDelete(null);
    try {
      const res = await devFetch(`/api/dev/admins/${admin.id}`, token, {
        method: "DELETE",
      });
      if (res.ok) {
        setAdmins((prev) => prev.filter((a) => a.id !== admin.id));
      }
    } finally {
      setDeletingId(null);
    }
  };

  const sair = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setToken("");
    setAdmins([]);
  };

  /* ── Tela de autenticação ─────────────────────────── */
  if (!token) {
    return (
      <main className="min-h-dvh bg-[#0D1117] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          {/* Logo dev */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-[#161B22] border border-[#30363D] flex items-center justify-center">
              <Terminal className="w-5 h-5 text-[#58A6FF]" />
            </div>
            <div>
              <p className="text-white font-mono font-bold text-sm">WillyDev</p>
              <p className="text-[#8B949E] text-xs font-mono">painel de desenvolvedores</p>
            </div>
          </div>

          <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#F0883E]" />
              <p className="text-[#E6EDF3] font-semibold text-sm">Acesso restrito</p>
            </div>
            <p className="text-[#8B949E] text-xs leading-relaxed">
              Insira o token de desenvolvedor para acessar o painel de gerenciamento de administradores.
            </p>

            <form onSubmit={autenticar} className="space-y-3">
              <div className="relative">
                <input
                  type={showToken ? "text" : "password"}
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="dev-token"
                  autoFocus
                  className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl px-4 py-3 pr-11 text-[#E6EDF3] font-mono text-sm placeholder-[#484F58] outline-none focus:border-[#58A6FF] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowToken((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B949E] hover:text-[#E6EDF3] transition-colors"
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {authError && (
                <p className="text-red-400 text-xs flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5 shrink-0" /> {authError}
                </p>
              )}

              <button
                type="submit"
                disabled={!tokenInput.trim() || autenticando}
                className="w-full py-2.5 rounded-xl bg-[#238636] hover:bg-[#2EA043] text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {autenticando ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Shield className="w-4 h-4" />
                )}
                {autenticando ? "Verificando..." : "Entrar"}
              </button>
            </form>
          </div>

          <p className="text-center text-[#484F58] text-xs mt-6 font-mono">
            sistema-pesquepague · WillTech
          </p>
        </motion.div>
      </main>
    );
  }

  /* ── Painel principal ─────────────────────────────── */
  return (
    <main className="min-h-dvh bg-[#0D1117] p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#161B22] border border-[#30363D] flex items-center justify-center shrink-0">
            <Terminal className="w-5 h-5 text-[#58A6FF]" />
          </div>
          <div className="flex-1">
            <h1 className="text-[#E6EDF3] font-mono font-bold text-lg">WillyDev</h1>
            <p className="text-[#8B949E] font-mono text-xs">Gerenciamento de administradores</p>
          </div>
          <button
            onClick={() => carregarAdmins(token)}
            disabled={loadingAdmins}
            className="p-2 rounded-xl text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#161B22] transition-colors"
            title="Recarregar"
          >
            <RefreshCw className={`w-4 h-4 ${loadingAdmins ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={sair}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[#8B949E] hover:text-red-400 hover:bg-red-400/10 transition-colors text-xs font-medium border border-[#30363D]"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair
          </button>
        </div>

        {/* Criar administrador */}
        <section className="bg-[#161B22] border border-[#30363D] rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-[#30363D]">
            <UserPlus className="w-4 h-4 text-[#3FB950]" />
            <h2 className="text-[#E6EDF3] font-semibold text-sm">Novo administrador</h2>
          </div>

          <form onSubmit={criarAdmin} className="p-5 space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[#8B949E] text-xs font-medium mb-1.5">Nome completo</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="João Gerente"
                  className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl px-3 py-2.5 text-[#E6EDF3] text-sm placeholder-[#484F58] outline-none focus:border-[#58A6FF] transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-[#8B949E] text-xs font-medium mb-1.5">E-mail</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="admin@pesqueiro.com"
                  className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl px-3 py-2.5 text-[#E6EDF3] text-sm placeholder-[#484F58] outline-none focus:border-[#58A6FF] transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[#8B949E] text-xs font-medium mb-1.5">Senha de acesso</label>
              <div className="relative">
                <input
                  type={showSenha ? "text" : "password"}
                  value={form.senha}
                  onChange={(e) => setForm({ ...form, senha: e.target.value })}
                  placeholder="mínimo 6 caracteres"
                  className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl px-3 py-2.5 pr-11 text-[#E6EDF3] text-sm placeholder-[#484F58] outline-none focus:border-[#58A6FF] transition-colors"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowSenha((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B949E] hover:text-[#E6EDF3] transition-colors"
                >
                  {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {formError && (
                <motion.p
                  key="err"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-red-400 text-xs flex items-center gap-1.5"
                >
                  <XCircle className="w-3.5 h-3.5 shrink-0" /> {formError}
                </motion.p>
              )}
              {formOk && (
                <motion.p
                  key="ok"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-[#3FB950] text-xs flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> {formOk}
                </motion.p>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={criando || !form.nome || !form.email || form.senha.length < 6}
              className="w-full py-2.5 rounded-xl bg-[#238636] hover:bg-[#2EA043] text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {criando ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              {criando ? "Criando..." : "Criar administrador"}
            </button>
          </form>
        </section>

        {/* Lista de administradores */}
        <section className="bg-[#161B22] border border-[#30363D] rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-[#30363D]">
            <Shield className="w-4 h-4 text-[#58A6FF]" />
            <h2 className="text-[#E6EDF3] font-semibold text-sm">Administradores cadastrados</h2>
            <span className="ml-auto text-[#8B949E] text-xs font-mono">{admins.length}</span>
          </div>

          {loadingAdmins ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-5 h-5 text-[#58A6FF] animate-spin" />
            </div>
          ) : admins.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Shield className="w-8 h-8 text-[#30363D]" />
              <p className="text-[#8B949E] text-sm">Nenhum administrador cadastrado</p>
            </div>
          ) : (
            <div className="divide-y divide-[#21262D]">
              <AnimatePresence>
                {admins.map((admin) => (
                  <motion.div
                    key={admin.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-3 px-5 py-4"
                  >
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-[#0D1117] border border-[#30363D] flex items-center justify-center shrink-0 font-mono font-bold text-[#58A6FF] text-sm">
                      {admin.nome.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[#E6EDF3] text-sm font-semibold truncate">{admin.nome}</p>
                      <p className="text-[#8B949E] text-xs font-mono truncate">{admin.email}</p>
                      {admin.criadoEm && (
                        <p className="text-[#484F58] text-[10px] mt-0.5">
                          {new Date(admin.criadoEm).toLocaleDateString("pt-BR", {
                            day: "2-digit", month: "short", year: "numeric",
                            timeZone: "America/Sao_Paulo",
                          })}
                        </p>
                      )}
                    </div>

                    {/* Status badge */}
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      admin.ativo
                        ? "bg-[#3FB950]/10 text-[#3FB950] border-[#3FB950]/20"
                        : "bg-red-500/10 text-red-400 border-red-500/20"
                    }`}>
                      {admin.ativo ? "ativo" : "inativo"}
                    </span>

                    {/* Actions */}
                    <button
                      onClick={() => toggleAtivo(admin)}
                      disabled={togglingId === admin.id}
                      title={admin.ativo ? "Desativar acesso" : "Reativar acesso"}
                      className={`p-2 rounded-lg transition-colors ${
                        admin.ativo
                          ? "text-[#8B949E] hover:text-amber-400 hover:bg-amber-400/10"
                          : "text-[#8B949E] hover:text-[#3FB950] hover:bg-[#3FB950]/10"
                      }`}
                    >
                      {togglingId === admin.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : admin.ativo ? (
                        <XCircle className="w-4 h-4" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      onClick={() => setConfirmDelete(admin)}
                      disabled={deletingId === admin.id}
                      title="Remover administrador"
                      className="p-2 rounded-lg text-[#8B949E] hover:text-red-400 hover:bg-red-400/10 transition-colors"
                    >
                      {deletingId === admin.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>

        <p className="text-center text-[#484F58] text-xs font-mono pb-4">
          sistema-pesquepague · WillTech · /willydev
        </p>
      </div>

      {/* Modal confirmação de remoção */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setConfirmDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#161B22] border border-[#30363D] rounded-2xl w-full max-w-sm p-6 space-y-5"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-[#E6EDF3] font-bold">Remover administrador?</h3>
                  <p className="text-[#8B949E] text-xs mt-1 leading-relaxed">
                    <strong className="text-[#E6EDF3]">{confirmDelete.nome}</strong> ({confirmDelete.email}) será
                    removido permanentemente do Firebase Auth e do Firestore. Esta ação não pode ser desfeita.
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-2.5 rounded-xl border border-[#30363D] text-[#8B949E] hover:text-[#E6EDF3] text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => deletarAdmin(confirmDelete)}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
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
