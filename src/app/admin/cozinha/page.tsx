"use client";

import { useEffect, useRef, useState } from "react";
import { playNotification } from "@/lib/sound";
import { motion, AnimatePresence } from "framer-motion";
import { ChefHat, Clock, Flame, CheckCircle2, ChevronRight, Volume2, VolumeX } from "lucide-react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCollection, orderBy } from "@/hooks/useFirestore";
import { formatTime, getRelativeTime } from "@/lib/utils";
import type { Pedido } from "@/types";
import { STATUS_LABELS, STATUS_NEXT } from "@/types";
import toast from "react-hot-toast";

export default function Cozinha() {
  const prevCountRef = useRef(0);
  const [muted, setMuted] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const { data: todos } = useCollection<Pedido>("pedidos", [orderBy("criadoEm", "asc")]);

  // Cozinha vê: novo e em_preparo
  const pendentes  = todos.filter((p) => p.status === "novo");
  const preparo    = todos.filter((p) => p.status === "em_preparo");

  useEffect(() => {
    const novos = pendentes.length;
    if (novos > prevCountRef.current && !muted) playNotification();
    prevCountRef.current = novos;
  }, [pendentes.length, muted]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const avancar = async (pedido: Pedido) => {
    const proximo = STATUS_NEXT[pedido.status];
    if (!proximo) return;
    await updateDoc(doc(db, "pedidos", pedido.id), {
      status: proximo,
      atualizadoEm: serverTimestamp(),
    });
    toast.success(`${pedido.piqueNome} → ${STATUS_LABELS[proximo]}`);
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ChefHat className="w-6 h-6 text-gold-500" />
        <div>
          <h1 className="font-display text-2xl font-bold gradient-gold-text">Cozinha</h1>
          <p className="text-forest-500 text-sm">
            {pendentes.length} aguardando · {preparo.length} em preparo
          </p>
        </div>
        <button
          onClick={() => setMuted((v) => !v)}
          className="ml-auto btn-ghost p-2 rounded-xl"
          title={muted ? "Ativar som" : "Silenciar"}
        >
          {muted
            ? <VolumeX className="w-5 h-5 text-forest-600" />
            : <Volume2  className="w-5 h-5 text-forest-400" />}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Coluna: Novos pedidos */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gold-500" />
            <h2 className="font-semibold text-forest-900 text-sm">Aguardando preparo</h2>
            {pendentes.length > 0 && (
              <span className="badge status-novo animate-pulse-gold ml-1">{pendentes.length}</span>
            )}
          </div>

          {pendentes.length === 0 ? (
            <div className="glass rounded-2xl flex items-center justify-center py-12 text-forest-700">
              <p className="text-sm">Nenhum pedido aguardando</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {pendentes.map((pedido) => (
                <PedidoCard key={pedido.id} pedido={pedido} now={now} onAvancar={() => avancar(pedido)} urgente />
              ))}
            </AnimatePresence>
          )}
        </section>

        {/* Coluna: Em preparo */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-water-300" />
            <h2 className="font-semibold text-forest-900 text-sm">Em preparo</h2>
            {preparo.length > 0 && (
              <span className="badge status-preparo ml-1">{preparo.length}</span>
            )}
          </div>

          {preparo.length === 0 ? (
            <div className="glass rounded-2xl flex items-center justify-center py-12 text-forest-700">
              <p className="text-sm">Nada em preparo</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {preparo.map((pedido) => (
                <PedidoCard key={pedido.id} pedido={pedido} now={now} onAvancar={() => avancar(pedido)} />
              ))}
            </AnimatePresence>
          )}
        </section>
      </div>
    </div>
  );
}

function PedidoCard({
  pedido,
  now,
  onAvancar,
  urgente,
}: {
  pedido: Pedido;
  now: number;
  onAvancar: () => void;
  urgente?: boolean;
}) {
  const proximo = STATUS_NEXT[pedido.status];

  // Calcula tempo em espera
  const minutos = pedido.criadoEm
    ? Math.floor((now - pedido.criadoEm.toDate().getTime()) / 60000)
    : 0;
  const atrasado = urgente && minutos >= 10;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16, height: 0 }}
      transition={{ duration: 0.25 }}
      className={`glass rounded-2xl overflow-hidden border ${
        atrasado
          ? "border-red-500/30"
          : urgente
          ? "border-gold-500/25"
          : "border-white/[0.06]"
      }`}
    >
      {/* Header do card */}
      <div className={`flex items-center gap-3 px-4 py-3 ${
        atrasado ? "bg-red-500/5" : urgente ? "bg-gold-500/5" : ""
      }`}>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-display font-black text-sm ${
          urgente ? "bg-gold-500 text-forest-950" : "bg-forest-700 text-forest-100"
        }`}>
          {pedido.piqueNome.slice(-2)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-forest-900 text-sm">{pedido.piqueNome}</p>
          <p className="text-forest-500 text-xs">
            #{pedido.id.slice(-4).toUpperCase()}
            {pedido.criadoEm && ` · ${formatTime(pedido.criadoEm.toDate())}`}
          </p>
        </div>
        <div className="text-right shrink-0">
          {atrasado ? (
            <span className="text-red-400 font-bold text-xs">{minutos} min ⚠</span>
          ) : (
            <span className="text-forest-500 text-xs">
              {pedido.criadoEm ? getRelativeTime(pedido.criadoEm.toDate()) : "--"}
            </span>
          )}
        </div>
      </div>

      {/* Itens */}
      <div className="px-4 py-2 border-t border-white/[0.05] space-y-1">
        {pedido.itens.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className={`font-black text-sm shrink-0 w-6 text-right ${
              urgente ? "text-gold-500" : "text-water-300"
            }`}>
              {item.quantidade}×
            </span>
            <div className="flex-1 min-w-0">
              <span className="text-forest-900 text-sm font-medium">{item.nome}</span>
              {item.obs && (
                <p className="text-forest-500 text-xs italic">↳ {item.obs}</p>
              )}
            </div>
          </div>
        ))}
        {pedido.observacaoGeral && (
          <p className="text-forest-500 text-xs italic mt-1 pt-1 border-t border-white/[0.04]">
            Obs: {pedido.observacaoGeral}
          </p>
        )}
      </div>

      {/* Botão de ação */}
      {proximo && (
        <button
          onClick={onAvancar}
          className={`w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-all border-t border-white/[0.05] ${
            urgente
              ? "bg-gold-500/10 hover:bg-gold-500/20 text-gold-400"
              : "bg-forest-800/40 hover:bg-forest-700/40 text-forest-300 hover:text-forest-100"
          }`}
        >
          {STATUS_LABELS[proximo]}
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
      {!proximo && (
        <div className="w-full flex items-center justify-center gap-2 py-2.5 bg-forest-800/20 text-forest-500 text-sm border-t border-white/[0.05]">
          <CheckCircle2 className="w-4 h-4" />
          Finalizado
        </div>
      )}
    </motion.div>
  );
}
