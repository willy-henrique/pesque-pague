"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, Fish, Search, ToggleLeft, ToggleRight, X, ChevronDown } from "lucide-react";
import Image from "next/image";
import {
  addDoc, updateDoc, deleteDoc, doc, collection, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { uploadImage } from "@/lib/cloudinary";
import { useCollection, orderBy } from "@/hooks/useFirestore";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { formatCurrency } from "@/lib/utils";
import type { Produto, Categoria, Adicional } from "@/types";
import toast from "react-hot-toast";

interface FormState {
  nome: string;
  descricao: string;
  preco: string;
  categoriaId: string;
  estoque: string;
  ativo: boolean;
  fotoUrl: string;
  fotoFile: File | null;
  tipo: "comida" | "bebida";
  adicionais: Adicional[];
}

const EMPTY_FORM: FormState = {
  nome: "", descricao: "", preco: "", categoriaId: "", estoque: "99",
  ativo: true, fotoUrl: "", fotoFile: null, tipo: "comida",
  adicionais: [],
};

export default function Produtos() {
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const { data: produtos } = useCollection<Produto>("produtos", [orderBy("nome", "asc")]);
  const { data: cats }     = useCollection<Categoria>("categorias", [orderBy("ordem", "asc")]);

  const [busca, setBusca]   = useState("");
  const [modal, setModal]   = useState<"add" | "edit" | null>(null);
  const [editando, setEditando] = useState<Produto | null>(null);
  const [form, setForm]     = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!form.fotoFile) { setFotoPreview(null); return; }
    const url = URL.createObjectURL(form.fotoFile);
    setFotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [form.fotoFile]);

  const filtrados = produtos.filter((p) =>
    p.nome.toLowerCase().includes(busca.toLowerCase())
  );

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setEditando(null);
    setModal("add");
  };

  const openEdit = (produto: Produto) => {
    setForm({ ...produto, preco: String(produto.preco), estoque: String(produto.estoque), fotoFile: null, tipo: produto.tipo ?? "comida", adicionais: produto.adicionais ?? [] });
    setEditando(produto);
    setModal("edit");
  };

  const closeModal = () => { setModal(null); setEditando(null); };

  const handleSave = async () => {
    if (!form.nome.trim() || !form.preco) return toast.error("Preencha nome e preço.");
    setSaving(true);
    try {
      let fotoUrl = form.fotoUrl;

      if (form.fotoFile) {
        fotoUrl = await uploadImage(form.fotoFile);
      }

      const payload = {
        nome:        form.nome.trim(),
        descricao:   form.descricao.trim(),
        preco:       parseFloat(form.preco),
        categoriaId: form.categoriaId,
        estoque:     parseInt(form.estoque) || 0,
        ativo:       form.ativo,
        fotoUrl,
        tipo:        form.tipo,
        adicionais:  form.adicionais,
      };

      if (modal === "add") {
        await addDoc(collection(db, "produtos"), { ...payload, criadoEm: serverTimestamp() });
        toast.success("Produto criado!");
      } else if (editando) {
        await updateDoc(doc(db, "produtos", editando.id), payload);
        toast.success("Produto atualizado!");
      }
      closeModal();
    } catch {
      toast.error("Erro ao salvar produto.");
    } finally {
      setSaving(false);
    }
  };

  const toggleAtivo = async (produto: Produto) => {
    await updateDoc(doc(db, "produtos", produto.id), { ativo: !produto.ativo });
    toast.success(produto.ativo ? "Produto desativado." : "Produto ativado.");
  };

  const handleDelete = (produto: Produto) => {
    confirm({
      title: "Excluir produto?",
      description: `O produto "${produto.nome}" será removido permanentemente do cardápio.`,
      confirmLabel: "Excluir",
      variant: "danger",
      onConfirm: async () => {
        await deleteDoc(doc(db, "produtos", produto.id));
        toast.success("Produto excluído.");
      },
    });
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold gradient-gold-text">Produtos</h1>
          <p className="text-forest-500 text-sm">{produtos.length} cadastrados</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-forest-600" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar..."
              className="input-field pl-9 py-2 text-sm w-52"
            />
          </div>
          <button onClick={openAdd} className="btn-gold px-4 py-2 rounded-xl text-sm">
            <Plus className="w-4 h-4" /> Novo
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="glass rounded-2xl overflow-hidden">
        {filtrados.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3 text-center">
            <Fish className="w-10 h-10 text-forest-700" />
            <p className="text-forest-500 text-sm">Nenhum produto encontrado.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {filtrados.map((produto, i) => {
              const cat = cats.find((c) => c.id === produto.categoriaId);
              return (
                <motion.div
                  key={produto.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-forest-800">
                    {produto.fotoUrl ? (
                      <Image src={produto.fotoUrl} alt={produto.nome} fill className="object-cover" sizes="48px" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Fish className="w-5 h-5 text-forest-600" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm truncate ${produto.ativo ? "text-forest-900" : "text-forest-600 line-through"}`}>
                      {produto.nome}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-gold-500 font-bold text-xs">{formatCurrency(produto.preco)}</span>
                      {cat && <span className="text-forest-600 text-xs">{cat.icone} {cat.nome}</span>}
                      <span className="text-forest-600 text-xs">Est: {produto.estoque}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggleAtivo(produto)} className="btn-ghost p-2 rounded-lg" title={produto.ativo ? "Desativar" : "Ativar"}>
                      {produto.ativo
                        ? <ToggleRight className="w-5 h-5 text-forest-400" />
                        : <ToggleLeft className="w-5 h-5 text-forest-700" />}
                    </button>
                    <button onClick={() => openEdit(produto)} className="btn-ghost p-2 rounded-lg">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(produto)} className="btn-ghost p-2 rounded-lg hover:text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
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
            onClick={(e) => e.target === e.currentTarget && closeModal()}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="glass rounded-3xl w-full max-w-md p-6 space-y-4"
            >
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-display text-lg font-bold gradient-gold-text">
                  {modal === "add" ? "Novo Produto" : "Editar Produto"}
                </h2>
                <button onClick={closeModal} className="btn-ghost p-2 rounded-xl">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                <FormField label="Nome *">
                  <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Tilápia frita, Heineken, Porção..." className="input-field" />
                </FormField>
                <FormField label="Descrição">
                  <input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Detalhes do produto" className="input-field" />
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Preço (R$) *">
                    <input type="number" value={form.preco} onChange={(e) => setForm({ ...form, preco: e.target.value })} placeholder="0.00" step="0.01" className="input-field" />
                  </FormField>
                  <FormField label="Estoque">
                    <input type="number" value={form.estoque} onChange={(e) => setForm({ ...form, estoque: e.target.value })} placeholder="99" className="input-field" />
                  </FormField>
                </div>
                <FormField label="Categoria">
                  <select value={form.categoriaId} onChange={(e) => setForm({ ...form, categoriaId: e.target.value })} className="input-field">
                    <option value="">Sem categoria</option>
                    {cats.map((c) => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
                  </select>
                </FormField>
                <FormField label="Tipo">
                  <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as "comida" | "bebida" })} className="input-field">
                    <option value="comida">🍽️ Comida (cozinha)</option>
                    <option value="bebida">🥤 Bebida (bar)</option>
                  </select>
                </FormField>
                <FormField label="Adicionais opcionais (cobrados à parte)">
                  <div className="space-y-2">
                    {form.adicionais.map((ad, i) => (
                      <div key={ad.id} className="flex gap-2 items-center">
                        <input
                          value={ad.nome}
                          onChange={(e) => {
                            const next = [...form.adicionais];
                            next[i] = { ...next[i], nome: e.target.value };
                            setForm({ ...form, adicionais: next });
                          }}
                          placeholder="Ex: Molho extra, Farofa..."
                          className="input-field flex-1 text-sm py-1.5"
                        />
                        <input
                          type="number"
                          value={ad.preco}
                          step="0.50"
                          min="0"
                          onChange={(e) => {
                            const next = [...form.adicionais];
                            next[i] = { ...next[i], preco: parseFloat(e.target.value) || 0 };
                            setForm({ ...form, adicionais: next });
                          }}
                          placeholder="R$"
                          className="input-field w-20 text-sm py-1.5"
                        />
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, adicionais: form.adicionais.filter((_, j) => j !== i) })}
                          className="btn-ghost p-1.5 rounded-lg text-red-400 hover:text-red-300 shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          adicionais: [
                            ...form.adicionais,
                            { id: Date.now().toString(36), nome: "", preco: 0 },
                          ],
                        })
                      }
                      className="btn-ghost py-2 rounded-xl text-xs w-full border border-dashed border-forest-600 hover:border-gold-500 flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar opcional
                    </button>
                  </div>
                </FormField>
                <FormField label="Foto">
                  {(fotoPreview || form.fotoUrl) && (
                    <div className="relative w-full h-36 rounded-xl overflow-hidden bg-forest-800 mb-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={fotoPreview ?? form.fotoUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setForm({ ...form, fotoFile: e.target.files?.[0] ?? null })}
                    className="input-field text-sm file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-forest-700 file:text-forest-100 file:text-xs cursor-pointer"
                  />
                </FormField>
                <div className="flex items-center justify-between">
                  <span className="text-forest-300 text-sm">Ativo no cardápio</span>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, ativo: !form.ativo })}
                    className={`w-12 h-6 rounded-full transition-colors ${form.ativo ? "bg-forest-500" : "bg-forest-900"}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform mx-0.5 ${form.ativo ? "translate-x-6" : "translate-x-0"}`} />
                  </button>
                </div>
              </div>

              <button onClick={handleSave} disabled={saving} className="btn-gold w-full py-3 rounded-xl disabled:opacity-60">
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {ConfirmDialog}
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-forest-400 text-xs font-medium">{label}</label>
      {children}
    </div>
  );
}
