"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, Tags, X, GripVertical } from "lucide-react";
import { addDoc, updateDoc, deleteDoc, doc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCollection, orderBy } from "@/hooks/useFirestore";
import type { Categoria } from "@/types";
import toast from "react-hot-toast";

const ICONES = ["🎣", "🍖", "🥤", "🍺", "🍟", "🎿", "🪣", "🐟", "🦐", "🪱", "🧃", "🍕", "🍔", "🌭", "🍦", "☕", "🧊", "🔧"];

interface FormState { nome: string; icone: string; ordem: string; ativo: boolean }
const EMPTY: FormState = { nome: "", icone: "🎣", ordem: "0", ativo: true };

export default function Categorias() {
  const { data: categorias } = useCollection<Categoria>("categorias", [orderBy("ordem", "asc")]);
  const [modal, setModal]   = useState(false);
  const [editando, setEditando] = useState<Categoria | null>(null);
  const [form, setForm]     = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  const openAdd = () => { setForm(EMPTY); setEditando(null); setModal(true); };
  const openEdit = (c: Categoria) => {
    setForm({ nome: c.nome, icone: c.icone, ordem: String(c.ordem), ativo: c.ativo });
    setEditando(c);
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) return toast.error("Informe o nome.");
    setSaving(true);
    const payload = { nome: form.nome.trim(), icone: form.icone, ordem: parseInt(form.ordem) || 0, ativo: form.ativo };
    try {
      if (editando) {
        await updateDoc(doc(db, "categorias", editando.id), payload);
        toast.success("Categoria atualizada!");
      } else {
        await addDoc(collection(db, "categorias"), payload);
        toast.success("Categoria criada!");
      }
      setModal(false);
    } catch {
      toast.error("Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat: Categoria) => {
    if (!confirm(`Excluir "${cat.nome}"?`)) return;
    await deleteDoc(doc(db, "categorias", cat.id));
    toast.success("Categoria excluída.");
  };

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold gradient-gold-text">Categorias</h1>
          <p className="text-forest-500 text-sm">Organize o cardápio por categoria</p>
        </div>
        <button onClick={openAdd} className="btn-gold px-4 py-2 rounded-xl text-sm ml-auto">
          <Plus className="w-4 h-4" /> Nova
        </button>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        {categorias.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <Tags className="w-10 h-10 text-forest-700" />
            <p className="text-forest-500 text-sm">Nenhuma categoria criada.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {categorias.map((cat, i) => (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 px-4 py-3.5"
              >
                <GripVertical className="w-4 h-4 text-forest-700 cursor-grab" />
                <span className="text-2xl w-8 text-center">{cat.icone}</span>
                <div className="flex-1">
                  <p className={`font-semibold text-sm ${cat.ativo ? "text-forest-100" : "text-forest-600 line-through"}`}>
                    {cat.nome}
                  </p>
                  <p className="text-forest-600 text-xs">Ordem: {cat.ordem}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(cat)} className="btn-ghost p-2 rounded-lg">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(cat)} className="btn-ghost p-2 rounded-lg hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

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
              className="glass rounded-3xl w-full max-w-sm p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold gradient-gold-text">
                  {editando ? "Editar Categoria" : "Nova Categoria"}
                </h2>
                <button onClick={() => setModal(false)} className="btn-ghost p-2 rounded-xl">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-forest-400 text-xs font-medium">Nome *</label>
                  <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Iscas" className="input-field" />
                </div>

                <div className="space-y-1">
                  <label className="text-forest-400 text-xs font-medium">Ícone</label>
                  <div className="flex flex-wrap gap-2 p-3 glass rounded-xl">
                    {ICONES.map((ic) => (
                      <button
                        key={ic}
                        onClick={() => setForm({ ...form, icone: ic })}
                        className={`text-xl w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                          form.icone === ic ? "bg-gold-500/20 border border-gold-500/50 scale-110" : "hover:bg-forest-800"
                        }`}
                      >
                        {ic}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-forest-400 text-xs font-medium">Ordem</label>
                    <input type="number" value={form.ordem} onChange={(e) => setForm({ ...form, ordem: e.target.value })} className="input-field" />
                  </div>
                  <div className="space-y-1 flex flex-col justify-end">
                    <div className="flex items-center gap-2">
                      <span className="text-forest-300 text-sm">Ativo</span>
                      <button
                        onClick={() => setForm({ ...form, ativo: !form.ativo })}
                        className={`w-10 h-5 rounded-full transition-colors ${form.ativo ? "bg-forest-500" : "bg-forest-900"}`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white shadow mx-0.5 transition-transform ${form.ativo ? "translate-x-5" : ""}`} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <button onClick={handleSave} disabled={saving} className="btn-gold w-full py-3 rounded-xl">
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
