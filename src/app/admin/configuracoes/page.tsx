"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Settings, Store, Power, Save, Image as ImageIcon,
  ShieldAlert, CheckCircle2, Upload,
} from "lucide-react";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { uploadImage } from "@/lib/cloudinary";
import type { Config } from "@/types";
import toast from "react-hot-toast";

const DEFAULT: Config = {
  nomeEstabelecimento: "WillTech Pesqueiros",
  logoUrl: "",
  modoManutencao: false,
};

export default function Configuracoes() {
  const [form, setForm]       = useState<Config>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [logoFile, setLogoFile]       = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!logoFile) { setLogoPreview(null); return; }
    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  useEffect(() => {
    getDoc(doc(db, "config", "geral")).then((snap) => {
      if (snap.exists()) setForm({ ...DEFAULT, ...(snap.data() as Config) });
      setLoading(false);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      let logoUrl = form.logoUrl;
      if (logoFile) {
        logoUrl = await uploadImage(logoFile);
        setLogoFile(null);
      }
      const updated = { ...form, logoUrl };
      await setDoc(doc(db, "config", "geral"), updated);
      setForm(updated);
      toast.success("Configurações salvas!");
    } catch {
      toast.error("Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const toggleManutencao = async () => {
    const novo = { ...form, modoManutencao: !form.modoManutencao };
    setForm(novo);
    try {
      await setDoc(doc(db, "config", "geral"), novo);
      toast.success(novo.modoManutencao ? "Estabelecimento fechado para clientes." : "Estabelecimento aberto!");
    } catch {
      toast.error("Erro ao alterar status.");
      setForm(form);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-xl mx-auto">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton-pulse h-24 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold gradient-gold-text">Configurações</h1>
        <p className="text-forest-500 text-sm">Gerencie o funcionamento do estabelecimento</p>
      </div>

      {/* Status do estabelecimento */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`glass rounded-2xl p-5 border ${
          form.modoManutencao ? "border-red-500/20" : "border-forest-500/20"
        }`}
      >
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
            form.modoManutencao ? "bg-red-500/10" : "bg-forest-700/50"
          }`}>
            <Power className={`w-6 h-6 ${form.modoManutencao ? "text-red-400" : "text-forest-300"}`} />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-forest-900 text-sm">Status do estabelecimento</p>
            <div className="flex items-center gap-2 mt-0.5">
              <div className={`w-2 h-2 rounded-full ${form.modoManutencao ? "bg-red-400" : "bg-forest-400 animate-pulse"}`} />
              <p className={`text-xs font-medium ${form.modoManutencao ? "text-red-400" : "text-forest-400"}`}>
                {form.modoManutencao ? "Fechado — clientes não podem fazer pedidos" : "Aberto — aceitando pedidos"}
              </p>
            </div>
          </div>
          <button
            onClick={toggleManutencao}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              form.modoManutencao
                ? "bg-forest-700 text-forest-100 hover:bg-forest-600"
                : "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
            }`}
          >
            {form.modoManutencao ? "Abrir" : "Fechar"}
          </button>
        </div>

        {form.modoManutencao && (
          <div className="mt-4 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/5 border border-red-500/10">
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-red-300 text-xs leading-relaxed">
              O estabelecimento está fechado. Clientes que acessarem o QR Code verão uma mensagem de indisponibilidade.
            </p>
          </div>
        )}
      </motion.div>

      {/* Informações do estabelecimento */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="glass rounded-2xl p-5 space-y-4"
      >
        <div className="flex items-center gap-2 mb-1">
          <Store className="w-4 h-4 text-gold-500" />
          <h2 className="font-display font-semibold text-forest-900">Informações do estabelecimento</h2>
        </div>

        <div className="space-y-1">
          <label className="text-forest-400 text-xs font-medium">Nome do estabelecimento</label>
          <input
            value={form.nomeEstabelecimento}
            onChange={(e) => setForm({ ...form, nomeEstabelecimento: e.target.value })}
            placeholder="Ex: Pesqueiro do João"
            className="input-field"
          />
          <p className="text-forest-600 text-xs">Aparece na tela inicial do cliente.</p>
        </div>

        <div className="space-y-2">
          <label className="text-forest-400 text-xs font-medium flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5" />
            Logotipo do estabelecimento
          </label>

          {(logoPreview || form.logoUrl) && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-forest-800/40 border border-forest-700/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoPreview ?? form.logoUrl}
                alt="Logo"
                className="w-16 h-16 rounded-xl object-contain bg-forest-900 p-1 shrink-0"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-forest-200 text-xs font-medium">
                  {logoPreview ? "Novo logo (não salvo ainda)" : "Logo atual"}
                </p>
                {logoFile && (
                  <p className="text-gold-400 text-[11px] mt-0.5 truncate">{logoFile.name}</p>
                )}
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-forest-600 hover:border-gold-500 cursor-pointer transition-colors group">
            <Upload className="w-4 h-4 text-forest-400 group-hover:text-gold-500 transition-colors" />
            <span className="text-forest-300 text-sm group-hover:text-forest-100 transition-colors">
              {form.logoUrl ? "Trocar logo" : "Enviar logo"}
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <p className="text-forest-600 text-xs">
            Aparece na tela inicial dos clientes. PNG ou JPG recomendado.
          </p>
        </div>
      </motion.div>

      {/* Salvar */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <button
          onClick={save}
          disabled={saving}
          className="btn-gold w-full py-3.5 rounded-2xl disabled:opacity-60"
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-forest-900 border-t-transparent rounded-full animate-spin" />
              Salvando...
            </span>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Salvar configurações
            </>
          )}
        </button>
      </motion.div>

      {/* Zona de risco */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="glass rounded-2xl p-5 border border-white/[0.04] space-y-3"
      >
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-forest-600" />
          <h2 className="font-display font-semibold text-forest-500 text-sm">Sistema</h2>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-forest-300 text-sm">Versão do sistema</p>
            <p className="text-forest-600 text-xs">WillTech Pesqueiros v1.0</p>
          </div>
          <CheckCircle2 className="w-5 h-5 text-forest-600" />
        </div>
      </motion.div>
    </div>
  );
}
