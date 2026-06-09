"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Pencil, Trash2, Tag, X, ToggleLeft, ToggleRight,
  Percent, Fish, Zap,
} from "lucide-react";
import Image from "next/image";
import {
  addDoc, updateDoc, deleteDoc, doc, collection, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { uploadImage } from "@/lib/cloudinary";
import { useCollection, orderBy } from "@/hooks/useFirestore";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { formatCurrency } from "@/lib/utils";
import type { Promocao, Produto } from "@/types";
import toast from "react-hot-toast";

interface FormState {
  titulo: string;
  descricao: string;
  produtoId: string;
  precoOriginal: string;
  precoPromocional: string;
  fotoUrl: string;
  fotoFile: File | null;
  ativo: boolean;
}

const EMPTY: FormState = {
  titulo: "", descricao: "", produtoId: "",
  precoOriginal: "", precoPromocional: "",
  fotoUrl: "", fotoFile: null, ativo: true,
};

export default function Promocoes() {
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const { data: promocoes } = useCollection<Promocao>("promocoes", [
    orderBy("criadoEm", "desc"),
  ]);
  const { data: produtos } = useCollection<Produto>("produtos");

  const [modal, setModal]       = useState(false);
  const [editando, setEditando] = useState<Promocao | null>(null);
  const [form, setForm]         = useState<FormState>(EMPTY);
  const [saving, setSaving]     = useState(false);

  const ativas = promocoes.filter((p) => p.ativo).length;

  const openAdd = () => { setForm(EMPTY); setEditando(null); setModal(true); };

  const openEdit = (p: Promocao) => {
    setForm({
      titulo: p.titulo, descricao: p.descricao, produtoId: p.produtoId,
      precoOriginal: String(p.precoOriginal),
      precoPromocional: String(p.precoPromocional),
      fotoUrl: p.fotoUrl, fotoFile: null, ativo: p.ativo,
    });
    setEditando(p);
    setModal(true);
  };

  // Ao vincular produto, preenche os campos automaticamente
  const handleProdutoChange = (produtoId: string) => {
    const produto = produtos.find((p) => p.id === produtoId);
    setForm((prev) => ({
      ...prev,
      produtoId,
      titulo:        produto ? produto.nome    : prev.titulo,
      fotoUrl:       produto ? produto.fotoUrl : prev.fotoUrl,
      precoOriginal: produto ? String(produto.preco) : prev.precoOriginal,
    }));
  };

  const desconto = () => {
    const orig  = parseFloat(form.precoOriginal);
    const promo = parseFloat(form.precoPromocional);
    if (!orig || !promo || promo >= orig) return null;
    return Math.round((1 - promo / orig) * 100);
  };

  const handleSave = async () => {
    if (!form.titulo.trim())        return toast.error("Informe o título.");
    if (!form.precoPromocional)     return toast.error("Informe o preço promocional.");

    setSaving(true);
    try {
      let fotoUrl = form.fotoUrl;
      if (form.fotoFile) {
        fotoUrl = await uploadImage(form.fotoFile);
      }

      const payload = {
        titulo:           form.titulo.trim(),
        descricao:        form.descricao.trim(),
        produtoId:        form.produtoId,
        precoOriginal:    parseFloat(form.precoOriginal) || 0,
        precoPromocional: parseFloat(form.precoPromocional),
        fotoUrl,
        ativo: form.ativo,
      };

      if (editando) {
        await updateDoc(doc(db, "promocoes", editando.id), payload);
        toast.success("Promoção atualizada!");
      } else {
        await addDoc(collection(db, "promocoes"), {
          ...payload,
          criadoEm: serverTimestamp(),
        });
        toast.success("Promoção criada!");
      }
      setModal(false);
    } catch {
      toast.error("Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const toggleAtivo = async (p: Promocao) => {
    await updateDoc(doc(db, "promocoes", p.id), { ativo: !p.ativo });
    toast.success(p.ativo ? "Promoção pausada." : "Promoção ativada!");
  };

  const handleDelete = (p: Promocao) => {
    confirm({
      title: "Excluir promoção?",
      description: `A promoção "${p.titulo}" será removida e deixará de aparecer no cardápio.`,
      confirmLabel: "Excluir",
      variant: "danger",
      onConfirm: async () => {
        await deleteDoc(doc(db, "promocoes", p.id));
        toast.success("Promoção excluída.");
      },
    });
  };

  const pct = desconto();

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold gradient-gold-text">Promoções do Dia</h1>
          <p className="text-forest-500 text-sm">
            {ativas > 0
              ? `${ativas} ativa${ativas > 1 ? "s" : ""} agora no cardápio`
              : "Nenhuma promoção ativa"}
          </p>
        </div>
        <button onClick={openAdd} className="btn-gold px-4 py-2 rounded-xl text-sm ml-auto">
          <Plus className="w-4 h-4" /> Nova Promoção
        </button>
      </div>

      {/* Status bar */}
      {ativas > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl px-5 py-3 flex items-center gap-3 border border-gold-500/20"
        >
          <Zap className="w-5 h-5 text-gold-500 shrink-0" />
          <p className="text-forest-700 text-sm">
            <span className="text-gold-400 font-bold">{ativas}</span> promoç{ativas > 1 ? "ões" : "ão"} aparecendo
            em destaque no cardápio dos clientes agora.
          </p>
        </motion.div>
      )}

      {/* Lista */}
      <div className="space-y-3">
        {promocoes.length === 0 ? (
          <div className="glass rounded-2xl flex flex-col items-center py-16 gap-3 text-center">
            <Tag className="w-10 h-10 text-forest-700" />
            <p className="text-forest-400 font-medium">Nenhuma promoção criada</p>
            <p className="text-forest-600 text-sm">Crie uma promoção e ela aparece no topo do cardápio.</p>
          </div>
        ) : (
          promocoes.map((promo, i) => {
            const pctDesc = promo.precoOriginal > 0
              ? Math.round((1 - promo.precoPromocional / promo.precoOriginal) * 100)
              : 0;
            return (
              <motion.div
                key={promo.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`glass rounded-2xl overflow-hidden flex items-center gap-4 p-4 ${
                  promo.ativo ? "border border-gold-500/15" : "opacity-50"
                }`}
              >
                {/* Foto */}
                <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-forest-800">
                  {promo.fotoUrl ? (
                    <Image src={promo.fotoUrl} alt={promo.titulo} fill className="object-cover" sizes="64px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Tag className="w-6 h-6 text-forest-600" />
                    </div>
                  )}
                  {pctDesc > 0 && (
                    <div className="absolute top-0 right-0 bg-gold-500 text-forest-950 text-[10px] font-black px-1.5 py-0.5 rounded-bl-lg">
                      -{pctDesc}%
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-forest-900 truncate">{promo.titulo}</p>
                    {promo.ativo && (
                      <span className="badge status-novo text-[10px] shrink-0">ao vivo</span>
                    )}
                  </div>
                  {promo.descricao && (
                    <p className="text-forest-500 text-xs truncate mt-0.5">{promo.descricao}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    {promo.precoOriginal > 0 && (
                      <span className="text-forest-600 text-xs line-through">
                        {formatCurrency(promo.precoOriginal)}
                      </span>
                    )}
                    <span className="gradient-gold-text font-bold text-sm">
                      {formatCurrency(promo.precoPromocional)}
                    </span>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => toggleAtivo(promo)} className="btn-ghost p-2 rounded-lg" title={promo.ativo ? "Pausar" : "Ativar"}>
                    {promo.ativo
                      ? <ToggleRight className="w-5 h-5 text-gold-500" />
                      : <ToggleLeft  className="w-5 h-5 text-forest-700" />}
                  </button>
                  <button onClick={() => openEdit(promo)} className="btn-ghost p-2 rounded-lg">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(promo)} className="btn-ghost p-2 rounded-lg hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {modal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setModal(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="glass rounded-3xl w-full max-w-md p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold gradient-gold-text">
                  {editando ? "Editar Promoção" : "Nova Promoção"}
                </h2>
                <button onClick={() => setModal(false)} className="btn-ghost p-2 rounded-xl">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
                {/* Vincular produto existente */}
                <div className="space-y-1">
                  <label className="text-forest-400 text-xs font-medium flex items-center gap-1.5">
                    <Fish className="w-3.5 h-3.5" />
                    Vincular produto (opcional)
                  </label>
                  <select
                    value={form.produtoId}
                    onChange={(e) => handleProdutoChange(e.target.value)}
                    className="input-field"
                  >
                    <option value="">— Promoção avulsa —</option>
                    {produtos.filter((p) => p.ativo).map((p) => (
                      <option key={p.id} value={p.id}>{p.nome} — {formatCurrency(p.preco)}</option>
                    ))}
                  </select>
                  {form.produtoId && (
                    <p className="text-forest-500 text-xs">Preço e foto preenchidos automaticamente.</p>
                  )}
                </div>

                <div className="section-divider" />

                <div className="space-y-1">
                  <label className="text-forest-400 text-xs font-medium">Título da promoção *</label>
                  <input
                    value={form.titulo}
                    onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                    placeholder="Ex: Tilápia frita com 30% off!"
                    className="input-field"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-forest-400 text-xs font-medium">Descrição</label>
                  <input
                    value={form.descricao}
                    onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                    placeholder="Ex: Só hoje, enquanto durar o estoque"
                    className="input-field"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-forest-400 text-xs font-medium">Preço original (R$)</label>
                    <input
                      type="number"
                      value={form.precoOriginal}
                      onChange={(e) => setForm({ ...form, precoOriginal: e.target.value })}
                      placeholder="0.00"
                      step="0.01"
                      className="input-field"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-forest-400 text-xs font-medium">Preço promo (R$) *</label>
                    <input
                      type="number"
                      value={form.precoPromocional}
                      onChange={(e) => setForm({ ...form, precoPromocional: e.target.value })}
                      placeholder="0.00"
                      step="0.01"
                      className="input-field"
                    />
                  </div>
                </div>

                {/* Badge de desconto ao vivo */}
                {pct !== null && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gold-500/10 border border-gold-500/20"
                  >
                    <Percent className="w-4 h-4 text-gold-500" />
                    <span className="text-gold-400 font-bold text-sm">{pct}% de desconto</span>
                    <span className="text-forest-500 text-xs ml-auto">
                      Economia de {formatCurrency(
                        parseFloat(form.precoOriginal) - parseFloat(form.precoPromocional)
                      )}
                    </span>
                  </motion.div>
                )}

                <div className="space-y-1">
                  <label className="text-forest-400 text-xs font-medium">Foto (opcional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setForm({ ...form, fotoFile: e.target.files?.[0] ?? null })}
                    className="input-field text-sm file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-forest-700 file:text-forest-100 file:text-xs cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-forest-300 text-sm">Ativar agora no cardápio</span>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, ativo: !form.ativo })}
                    className={`w-12 h-6 rounded-full transition-colors ${form.ativo ? "bg-gold-500" : "bg-forest-900"}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow mx-0.5 transition-transform ${form.ativo ? "translate-x-6" : ""}`} />
                  </button>
                </div>
              </div>

              <button onClick={handleSave} disabled={saving} className="btn-gold w-full py-3 rounded-xl">
                {saving ? "Salvando..." : "Salvar Promoção"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {ConfirmDialog}
    </div>
  );
}
