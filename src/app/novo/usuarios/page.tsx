"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserPlus, UserRound, Mail, Lock, X, ShieldOff, ShieldCheck,
  KeyRound, Building2, Shield, Trash2, Eye, EyeOff, Users,
} from "lucide-react";
import { useCollection, where } from "@/hooks/useFirestore";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { adminFetch } from "@/lib/auth-api";
import type { SetorPedido, Usuario } from "@/types";
import toast from "react-hot-toast";

type RoleFilter = "todos" | "admin" | "atendente";

interface CreateForm {
  nome: string; email: string; senha: string; confirmarSenha: string;
  role: "admin" | "atendente"; setores: SetorPedido[];
}

const EMPTY_FORM: CreateForm = {
  nome: "", email: "", senha: "", confirmarSenha: "",
  role: "atendente", setores: ["cozinha", "bar"],
};

export default function UsuariosAdminPage() {
  const { data: rawUsuarios, loading } = useCollection<Usuario>("usuarios", [
    where("role", "in", ["admin", "atendente"]),
  ]);

  const sorted = [...rawUsuarios].sort((a, b) => a.nome.localeCompare(b.nome));

  const { confirm, ConfirmDialog } = useConfirmDialog();

  const [filtro, setFiltro]         = useState<RoleFilter>("todos");
  const [modal, setModal]           = useState(false);
  const [form, setForm]             = useState<CreateForm>(EMPTY_FORM);
  const [showSenha, setShowSenha]   = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving]         = useState(false);

  const [resetUid, setResetUid]     = useState<string | null>(null);
  const [novaSenha, setNovaSenha]   = useState("");
  const [showNovaSenha, setShowNovaSenha] = useState(false);

  const [editSetorUid, setEditSetorUid]   = useState<string | null>(null);
  const [editSetores, setEditSetores]     = useState<SetorPedido[]>(["cozinha", "bar"]);

  const filtered = filtro === "todos" ? sorted : sorted.filter((u) => u.role === filtro);

  const admins    = sorted.filter((u) => u.role === "admin").length;
  const atendentes = sorted.filter((u) => u.role === "atendente").length;

  const toggleSetor = (setor: SetorPedido, cur: SetorPedido[], set: (v: SetorPedido[]) => void) => {
    const has = cur.includes(setor);
    if (has && cur.length === 1) return;
    set(has ? cur.filter((s) => s !== setor) : [...cur, setor]);
  };

  /* ── Create user ──────────────────────────────────────── */
  const handleCreate = async () => {
    const nome  = form.nome.trim();
    const email = form.email.trim();
    if (!nome)                return toast.error("Informe o nome.");
    if (!email)               return toast.error("Informe o e-mail.");
    if (form.senha.length < 6)return toast.error("Senha com no mínimo 6 caracteres.");
    if (form.senha !== form.confirmarSenha) return toast.error("As senhas não conferem.");

    setSaving(true);
    try {
      await adminFetch("/api/admin/usuarios", {
        method: "POST",
        body: JSON.stringify({
          nome, email, senha: form.senha,
          role: form.role,
          setores: form.role === "atendente" ? form.setores : undefined,
        }),
      });
      toast.success(`${form.role === "admin" ? "Administrador" : "Atendente"} "${nome}" criado!`);
      setForm(EMPTY_FORM);
      setModal(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar usuário.");
    } finally { setSaving(false); }
  };

  /* ── Toggle ativo ─────────────────────────────────────── */
  const toggleAtivo = (u: Usuario) => {
    const bloquear = u.ativo;
    confirm({
      title: bloquear ? "Bloquear acesso?" : "Reativar acesso?",
      description: bloquear
        ? `${u.nome} não poderá fazer login até ser reativado.`
        : `${u.nome} voltará a acessar o sistema.`,
      confirmLabel: bloquear ? "Bloquear" : "Reativar",
      variant: "danger",
      onConfirm: async () => {
        await adminFetch(`/api/admin/usuarios/${u.id}`, {
          method: "PATCH",
          body: JSON.stringify({ ativo: !bloquear }),
        });
        toast.success(bloquear ? "Acesso bloqueado." : "Acesso reativado.");
      },
    });
  };

  /* ── Reset senha ──────────────────────────────────────── */
  const salvarNovaSenha = async () => {
    if (!resetUid) return;
    if (novaSenha.length < 6) return toast.error("Senha com no mínimo 6 caracteres.");
    setSaving(true);
    try {
      await adminFetch(`/api/admin/usuarios/${resetUid}`, {
        method: "PATCH",
        body: JSON.stringify({ senha: novaSenha }),
      });
      toast.success("Senha atualizada.");
      setResetUid(null); setNovaSenha("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro.");
    } finally { setSaving(false); }
  };

  /* ── Save setores ─────────────────────────────────────── */
  const salvarSetores = async () => {
    if (!editSetorUid) return;
    setSaving(true);
    try {
      await adminFetch(`/api/admin/usuarios/${editSetorUid}`, {
        method: "PATCH",
        body: JSON.stringify({ setores: editSetores }),
      });
      toast.success("Setores atualizados.");
      setEditSetorUid(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro.");
    } finally { setSaving(false); }
  };

  /* ── Delete ───────────────────────────────────────────── */
  const deletarUsuario = (u: Usuario) => {
    confirm({
      title: "Remover usuário?",
      description: `${u.nome} (${u.email}) será removido permanentemente do Firebase Auth e do banco de dados. Esta ação não pode ser desfeita.`,
      confirmLabel: "Remover",
      variant: "danger",
      onConfirm: async () => {
        await adminFetch(`/api/admin/usuarios/${u.id}`, { method: "DELETE" });
        toast.success("Usuário removido.");
      },
    });
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-forest-900 dark:text-forest-50">Usuários & Permissões</h1>
          <p className="text-forest-500 dark:text-forest-300 text-sm mt-0.5">
            Gerencie administradores e atendentes do sistema.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setForm(EMPTY_FORM); setShowSenha(false); setShowConfirm(false); setModal(true); }}
          className="btn-gold px-4 py-2 rounded-xl text-sm shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          Novo usuário
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          active={filtro === "todos"}
          onClick={() => setFiltro("todos")}
          icon={Users}
          label="Todos"
          value={sorted.length}
        />
        <StatCard
          active={filtro === "admin"}
          onClick={() => setFiltro("admin")}
          icon={Shield}
          label="Admins"
          value={admins}
          accent="text-purple-500 dark:text-purple-400"
          bg="bg-purple-500/10"
        />
        <StatCard
          active={filtro === "atendente"}
          onClick={() => setFiltro("atendente")}
          icon={UserRound}
          label="Atendentes"
          value={atendentes}
          accent="text-gold-600 dark:text-gold-400"
          bg="bg-gold-500/10"
        />
      </div>

      {/* Users list */}
      <div className="glass rounded-2xl overflow-hidden border border-forest-200 dark:border-forest-700">
        {loading ? (
          <div className="p-8 text-center text-forest-500 text-sm">Carregando usuários...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-14 gap-3 px-4 text-center">
            <Users className="w-10 h-10 text-forest-400" />
            <p className="font-semibold text-forest-700 dark:text-forest-200">Nenhum usuário encontrado</p>
            <p className="text-forest-500 text-sm">
              {filtro !== "todos" ? `Nenhum ${filtro} cadastrado.` : "Crie o primeiro usuário."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-forest-100 dark:divide-forest-700">
            {filtered.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                onToggleAtivo={() => toggleAtivo(u)}
                onResetSenha={() => { setResetUid(u.id); setNovaSenha(""); setShowNovaSenha(false); }}
                onEditSetores={() => { setEditSetorUid(u.id); setEditSetores(u.setores ?? ["cozinha", "bar"]); }}
                onDelete={() => deletarUsuario(u)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Create modal ──────────────────────────────────── */}
      <AnimatePresence>
        {modal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="glass rounded-2xl w-full max-w-md p-6 space-y-4 border border-forest-200 dark:border-forest-700 max-h-[90dvh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-lg text-forest-900 dark:text-forest-50">Novo usuário</h2>
                <button type="button" onClick={() => setModal(false)} className="btn-ghost p-2 rounded-xl">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Role selector */}
              <div>
                <label className="text-forest-500 text-xs font-medium block mb-1.5">Tipo de usuário</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: "atendente", label: "Atendente", icon: UserRound, desc: "Acessa o app de atendimento" },
                    { value: "admin",     label: "Administrador", icon: Shield, desc: "Acessa o painel admin" },
                  ] as const).map(({ value, label, icon: Icon, desc }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setForm({ ...form, role: value })}
                      className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-sm font-medium transition-all ${
                        form.role === value
                          ? value === "admin"
                            ? "border-purple-500/60 bg-purple-500/15 text-purple-300"
                            : "border-gold-500/60 bg-gold-500/15 text-gold-600 dark:text-gold-300"
                          : "border-forest-200 dark:border-forest-700 text-forest-500 hover:border-forest-300"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{label}</span>
                      <span className="text-[10px] opacity-70 font-normal">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <FormField label="Nome completo" icon={UserRound}>
                  <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    className="input-field" placeholder="João Silva" />
                </FormField>
                <FormField label="E-mail (login)" icon={Mail}>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="input-field" placeholder="joao@pesqueiro.com" />
                </FormField>
                <FormField label="Senha" icon={Lock}>
                  <div className="relative">
                    <input type={showSenha ? "text" : "password"} value={form.senha}
                      onChange={(e) => setForm({ ...form, senha: e.target.value })}
                      className="input-field pr-10" placeholder="Mínimo 6 caracteres" />
                    <button type="button" onClick={() => setShowSenha((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-forest-400 hover:text-forest-700 dark:hover:text-forest-200">
                      {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </FormField>
                <FormField label="Confirmar senha" icon={Lock}>
                  <div className="relative">
                    <input type={showConfirm ? "text" : "password"} value={form.confirmarSenha}
                      onChange={(e) => setForm({ ...form, confirmarSenha: e.target.value })}
                      className="input-field pr-10" />
                    <button type="button" onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-forest-400 hover:text-forest-700 dark:hover:text-forest-200">
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </FormField>

                <AnimatePresence>
                  {form.role === "atendente" && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <FormField label="Setores de atuação" icon={Building2}>
                        <div className="grid grid-cols-2 gap-2 pt-0.5">
                          {(["cozinha", "bar"] as SetorPedido[]).map((s) => (
                            <button key={s} type="button"
                              onClick={() => toggleSetor(s, form.setores, (next) => setForm({ ...form, setores: next }))}
                              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                                form.setores.includes(s)
                                  ? s === "bar" ? "border-blue-500/60 bg-blue-500/15 text-blue-300" : "border-orange-500/60 bg-orange-500/15 text-orange-300"
                                  : "border-forest-200 dark:border-forest-700 text-forest-500"
                              }`}>
                              {s === "bar" ? "🍺 Bar" : "🍳 Cozinha"}
                            </button>
                          ))}
                        </div>
                      </FormField>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button type="button" onClick={handleCreate} disabled={saving}
                className="btn-gold w-full py-3 rounded-xl disabled:opacity-60">
                {saving ? "Criando..." : `Criar ${form.role === "admin" ? "administrador" : "atendente"}`}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Reset senha modal ──────────────────────────────── */}
      <AnimatePresence>
        {resetUid && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setResetUid(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="glass rounded-2xl w-full max-w-sm p-6 space-y-4 border border-forest-200 dark:border-forest-700">
              <h2 className="font-bold text-forest-900 dark:text-forest-50">Redefinir senha</h2>
              <div className="relative">
                <input type={showNovaSenha ? "text" : "password"} value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)} className="input-field pr-10"
                  placeholder="Nova senha (mín. 6)" />
                <button type="button" onClick={() => setShowNovaSenha((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-forest-400 hover:text-forest-700 dark:hover:text-forest-200">
                  {showNovaSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setResetUid(null)} className="btn-ghost flex-1 py-2.5 rounded-xl">Cancelar</button>
                <button type="button" onClick={salvarNovaSenha} disabled={saving} className="btn-gold flex-1 py-2.5 rounded-xl disabled:opacity-60">
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Edit setores modal ─────────────────────────────── */}
      <AnimatePresence>
        {editSetorUid && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setEditSetorUid(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="glass rounded-2xl w-full max-w-xs p-6 space-y-4 border border-forest-200 dark:border-forest-700">
              <h2 className="font-bold text-forest-900 dark:text-forest-50">Setores de atuação</h2>
              <div className="grid grid-cols-2 gap-2">
                {(["cozinha", "bar"] as SetorPedido[]).map((s) => (
                  <button key={s} type="button"
                    onClick={() => toggleSetor(s, editSetores, setEditSetores)}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-all ${
                      editSetores.includes(s)
                        ? s === "bar" ? "border-blue-500/60 bg-blue-500/15 text-blue-300" : "border-orange-500/60 bg-orange-500/15 text-orange-300"
                        : "border-forest-200 dark:border-forest-700 text-forest-500"
                    }`}>
                    {s === "bar" ? "🍺 Bar" : "🍳 Cozinha"}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditSetorUid(null)} className="btn-ghost flex-1 py-2.5 rounded-xl">Cancelar</button>
                <button type="button" onClick={salvarSetores} disabled={saving} className="btn-gold flex-1 py-2.5 rounded-xl disabled:opacity-60">
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {ConfirmDialog}
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────── */

function StatCard({ active, onClick, icon: Icon, label, value, accent = "text-forest-600 dark:text-forest-300", bg = "bg-forest-500/10" }: {
  active: boolean; onClick: () => void; icon: React.ElementType;
  label: string; value: number; accent?: string; bg?: string;
}) {
  return (
    <button onClick={onClick}
      className={`glass rounded-2xl p-4 text-left transition-all border ${
        active ? "border-gold-500/40 ring-2 ring-gold-400/20" : "border-forest-200 dark:border-forest-700"
      }`}>
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${bg} mb-2`}>
        <Icon className={`w-4 h-4 ${accent}`} />
      </div>
      <p className="text-2xl font-bold text-forest-900 dark:text-forest-50">{value}</p>
      <p className="text-forest-500 dark:text-forest-300 text-xs mt-0.5">{label}</p>
    </button>
  );
}

function UserRow({ user, onToggleAtivo, onResetSenha, onEditSetores, onDelete }: {
  user: Usuario;
  onToggleAtivo: () => void;
  onResetSenha: () => void;
  onEditSetores: () => void;
  onDelete: () => void;
}) {
  const isAdmin = user.role === "admin";
  return (
    <div className="flex items-center gap-3 px-4 py-4">
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
            isAdmin
              ? "bg-purple-500/10 text-purple-500 border-purple-500/20"
              : "bg-gold-500/10 text-gold-600 dark:text-gold-400 border-gold-500/20"
          }`}>
            {isAdmin ? "admin" : "atendente"}
          </span>
        </div>
        <p className="text-xs text-forest-500 truncate flex items-center gap-1">
          <Mail className="w-3 h-3 shrink-0" />{user.email}
        </p>
        {!isAdmin && (user.setores ?? []).length > 0 && (
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            {(user.setores ?? []).map((s) => (
              <span key={s} className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                s === "bar" ? "bg-blue-500/15 text-blue-400" : "bg-orange-500/15 text-orange-400"
              }`}>
                {s === "bar" ? "🍺 Bar" : "🍳 Cozinha"}
              </span>
            ))}
          </div>
        )}
      </div>

      <span className={`badge text-[10px] shrink-0 ${
        user.ativo ? "status-entregue" : "bg-red-500/10 text-red-500 border-red-500/20"
      }`}>
        {user.ativo ? "Ativo" : "Bloqueado"}
      </span>

      <div className="flex items-center gap-0.5 shrink-0">
        {!isAdmin && (
          <button type="button" onClick={onEditSetores} className="btn-ghost p-2 rounded-lg" title="Editar setores">
            <Building2 className="w-4 h-4" />
          </button>
        )}
        <button type="button" onClick={onResetSenha} className="btn-ghost p-2 rounded-lg" title="Nova senha">
          <KeyRound className="w-4 h-4" />
        </button>
        <button type="button" onClick={onToggleAtivo}
          className={`btn-ghost p-2 rounded-lg ${user.ativo ? "hover:text-red-500" : "hover:text-emerald-500"}`}
          title={user.ativo ? "Bloquear" : "Reativar"}>
          {user.ativo ? <ShieldOff className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
        </button>
        <button type="button" onClick={onDelete} className="btn-ghost p-2 rounded-lg hover:text-red-500" title="Remover">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function FormField({ label, icon: Icon, children }: { label: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-forest-500 text-xs font-medium flex items-center gap-1">
        <Icon className="w-3 h-3" />{label}
      </label>
      {children}
    </div>
  );
}
