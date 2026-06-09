"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, UserRound, Mail, Lock, X, ShieldOff, ShieldCheck, KeyRound, Building2,
} from "lucide-react";
import { useCollection, where } from "@/hooks/useFirestore";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { adminFetch } from "@/lib/auth-api";
import { ROLE_LABELS } from "@/lib/usuarios";
import type { SetorPedido, Usuario } from "@/types";
import toast from "react-hot-toast";

interface FormState {
  nome: string;
  email: string;
  senha: string;
  confirmarSenha: string;
  setores: SetorPedido[];
}

const EMPTY: FormState = {
  nome: "",
  email: "",
  senha: "",
  confirmarSenha: "",
  setores: ["cozinha", "bar"],
};

export default function AtendentesAdmin() {
  const { data: atendentesRaw, loading } = useCollection<Usuario>("usuarios", [
    where("role", "==", "atendente"),
  ]);
  const atendentes = [...atendentesRaw].sort((a, b) => a.nome.localeCompare(b.nome));

  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [resetUid, setResetUid] = useState<string | null>(null);
  const [novaSenha, setNovaSenha] = useState("");
  const [editSetorUid, setEditSetorUid] = useState<string | null>(null);
  const [editSetores, setEditSetores] = useState<SetorPedido[]>(["cozinha", "bar"]);

  const toggleSetor = (setor: SetorPedido, current: SetorPedido[], set: (s: SetorPedido[]) => void) => {
    const has = current.includes(setor);
    if (has && current.length === 1) return;
    set(has ? current.filter((s) => s !== setor) : [...current, setor]);
  };

  const salvarSetores = async () => {
    if (!editSetorUid) return;
    setSaving(true);
    try {
      await adminFetch(`/api/admin/atendentes/${editSetorUid}`, {
        method: "PATCH",
        body: JSON.stringify({ setores: editSetores }),
      });
      toast.success("Setor atualizado.");
      setEditSetorUid(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!form.nome.trim()) return toast.error("Informe o nome.");
    if (!form.email.trim()) return toast.error("Informe o e-mail.");
    if (form.senha.length < 6) return toast.error("Senha com no mínimo 6 caracteres.");
    if (form.senha !== form.confirmarSenha) return toast.error("As senhas não conferem.");

    setSaving(true);
    try {
      await adminFetch("/api/admin/atendentes", {
        method: "POST",
        body: JSON.stringify({
          nome: form.nome.trim(),
          email: form.email.trim(),
          senha: form.senha,
          setores: form.setores,
        }),
      });
      toast.success("Atendente cadastrado!");
      setForm(EMPTY);
      setModal(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao cadastrar.");
    } finally {
      setSaving(false);
    }
  };

  const toggleBloqueio = (u: Usuario) => {
    const bloquear = u.ativo;
    confirm({
      title: bloquear ? "Bloquear atendente?" : "Desbloquear atendente?",
      description: bloquear
        ? `${u.nome} não poderá mais entrar no app até ser desbloqueado.`
        : `${u.nome} voltará a acessar o app com o mesmo e-mail e senha.`,
      confirmLabel: bloquear ? "Bloquear" : "Desbloquear",
      variant: "danger",
      onConfirm: async () => {
        await adminFetch(`/api/admin/atendentes/${u.id}`, {
          method: "PATCH",
          body: JSON.stringify({ ativo: !bloquear }),
        });
        toast.success(bloquear ? "Atendente bloqueado." : "Atendente desbloqueado.");
      },
    });
  };

  const salvarNovaSenha = async () => {
    if (!resetUid) return;
    if (novaSenha.length < 6) return toast.error("Senha com no mínimo 6 caracteres.");
    setSaving(true);
    try {
      await adminFetch(`/api/admin/atendentes/${resetUid}`, {
        method: "PATCH",
        body: JSON.stringify({ senha: novaSenha }),
      });
      toast.success("Senha atualizada.");
      setResetUid(null);
      setNovaSenha("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao alterar senha.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div className="flex items-start gap-3">
        <div>
          <h1 className="text-2xl font-bold text-forest-900 dark:text-forest-50">Atendentes</h1>
          <p className="text-forest-500 dark:text-forest-300 text-sm mt-0.5">
            Cadastre logins para o app web do atendente (e-mail e senha).
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setForm(EMPTY); setModal(true); }}
          className="btn-gold px-4 py-2 rounded-xl text-sm ml-auto shrink-0"
        >
          <Plus className="w-4 h-4" />
          Novo atendente
        </button>
      </div>

      <div className="glass rounded-2xl overflow-hidden border border-forest-200 dark:border-forest-700">
        {loading ? (
          <div className="p-8 text-center text-forest-500 text-sm">Carregando...</div>
        ) : atendentes.length === 0 ? (
          <div className="flex flex-col items-center py-14 gap-3 px-4 text-center">
            <UserRound className="w-10 h-10 text-forest-400" />
            <p className="font-semibold text-forest-700 dark:text-forest-200">Nenhum atendente cadastrado</p>
            <p className="text-forest-500 text-sm">Crie o primeiro login para a equipe de salão.</p>
          </div>
        ) : (
          <div className="divide-y divide-forest-100 dark:divide-forest-700">
            {atendentes.map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-4 py-4">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    u.ativo ? "bg-gold-500/15" : "bg-forest-200 dark:bg-forest-800"
                  }`}
                >
                  <UserRound className={`w-5 h-5 ${u.ativo ? "text-gold-600" : "text-forest-400"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-forest-900 dark:text-forest-50 truncate">
                    {u.nome}
                  </p>
                  <p className="text-xs text-forest-500 truncate flex items-center gap-1">
                    <Mail className="w-3 h-3 shrink-0" />
                    {u.email}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                    {(u.setores ?? ["cozinha", "bar"]).map((s) => (
                      <span key={s} className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                        s === "bar" ? "bg-blue-500/15 text-blue-400" : "bg-orange-500/15 text-orange-400"
                      }`}>
                        {s === "bar" ? "🍺 Bar" : "🍳 Cozinha"}
                      </span>
                    ))}
                  </div>
                </div>
                <span
                  className={`badge text-[10px] shrink-0 ${
                    u.ativo ? "status-entregue" : "bg-red-500/10 text-red-500 border-red-500/20"
                  }`}
                >
                  {u.ativo ? "Ativo" : "Bloqueado"}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => { setEditSetorUid(u.id); setEditSetores(u.setores ?? ["cozinha", "bar"]); }}
                    className="btn-ghost p-2 rounded-lg"
                    title="Editar setor"
                  >
                    <Building2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => { setResetUid(u.id); setNovaSenha(""); }}
                    className="btn-ghost p-2 rounded-lg"
                    title="Nova senha"
                  >
                    <KeyRound className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleBloqueio(u)}
                    className={`btn-ghost p-2 rounded-lg ${
                      u.ativo ? "hover:text-red-500" : "hover:text-emerald-500"
                    }`}
                    title={u.ativo ? "Bloquear" : "Desbloquear"}
                  >
                    {u.ativo ? <ShieldOff className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-forest-500 dark:text-forest-400 leading-relaxed">
        O atendente acessa <strong className="text-forest-700 dark:text-forest-200">/atendente</strong> com o
        e-mail e senha definidos aqui. Para criar contas, configure{" "}
        <code className="text-[11px] bg-forest-100 dark:bg-forest-800 px-1 rounded">FIREBASE_SERVICE_ACCOUNT_KEY</code>{" "}
        no servidor (Vercel).
      </p>

      <AnimatePresence>
        {modal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass rounded-2xl w-full max-w-md p-6 space-y-4 border border-forest-200 dark:border-forest-700"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-lg text-forest-900 dark:text-forest-50">Novo atendente</h2>
                <button type="button" onClick={() => setModal(false)} className="btn-ghost p-2 rounded-xl">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <Field label="Nome completo" icon={UserRound}>
                  <input
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    className="input-field"
                    placeholder="Maria Silva"
                  />
                </Field>
                <Field label="E-mail (login)" icon={Mail}>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="input-field"
                    placeholder="maria@pesqueiro.com"
                  />
                </Field>
                <Field label="Senha" icon={Lock}>
                  <input
                    type="password"
                    value={form.senha}
                    onChange={(e) => setForm({ ...form, senha: e.target.value })}
                    className="input-field"
                    placeholder="Mínimo 6 caracteres"
                  />
                </Field>
                <Field label="Confirmar senha" icon={Lock}>
                  <input
                    type="password"
                    value={form.confirmarSenha}
                    onChange={(e) => setForm({ ...form, confirmarSenha: e.target.value })}
                    className="input-field"
                  />
                </Field>
                <Field label="Setor de atuação" icon={Building2}>
                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    {(["cozinha", "bar"] as SetorPedido[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleSetor(s, form.setores, (next) => setForm({ ...form, setores: next }))}
                        className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                          form.setores.includes(s)
                            ? s === "bar"
                              ? "border-blue-500/60 bg-blue-500/15 text-blue-300"
                              : "border-orange-500/60 bg-orange-500/15 text-orange-300"
                            : "border-white/10 text-forest-500 hover:bg-forest-800"
                        }`}
                      >
                        {s === "bar" ? "🍺 Bar" : "🍳 Cozinha"}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
              <button
                type="button"
                onClick={handleCreate}
                disabled={saving}
                className="btn-gold w-full py-3 rounded-xl disabled:opacity-60"
              >
                {saving ? "Cadastrando..." : "Cadastrar atendente"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {resetUid && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setResetUid(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="glass rounded-2xl w-full max-w-sm p-6 space-y-4 border border-forest-200 dark:border-forest-700"
            >
              <h2 className="font-bold text-forest-900 dark:text-forest-50">Nova senha</h2>
              <input
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                className="input-field"
                placeholder="Nova senha (mín. 6)"
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setResetUid(null)} className="btn-ghost flex-1 py-2.5 rounded-xl">
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={salvarNovaSenha}
                  disabled={saving}
                  className="btn-gold flex-1 py-2.5 rounded-xl disabled:opacity-60"
                >
                  Salvar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editSetorUid && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setEditSetorUid(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="glass rounded-2xl w-full max-w-xs p-6 space-y-4 border border-forest-200 dark:border-forest-700"
            >
              <h2 className="font-bold text-forest-900 dark:text-forest-50">Setor de atuação</h2>
              <div className="grid grid-cols-2 gap-2">
                {(["cozinha", "bar"] as SetorPedido[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSetor(s, editSetores, setEditSetores)}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-all ${
                      editSetores.includes(s)
                        ? s === "bar"
                          ? "border-blue-500/60 bg-blue-500/15 text-blue-300"
                          : "border-orange-500/60 bg-orange-500/15 text-orange-300"
                        : "border-white/10 text-forest-500 hover:bg-forest-800"
                    }`}
                  >
                    {s === "bar" ? "🍺 Bar" : "🍳 Cozinha"}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditSetorUid(null)} className="btn-ghost flex-1 py-2.5 rounded-xl">
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={salvarSetores}
                  disabled={saving}
                  className="btn-gold flex-1 py-2.5 rounded-xl disabled:opacity-60"
                >
                  Salvar
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

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-forest-500 text-xs font-medium flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {label}
      </label>
      {children}
    </div>
  );
}
